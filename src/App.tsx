import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, CircleDashed, ClipboardList, Clock3, GraduationCap, House, ListFilter, PlayCircle } from 'lucide-react';
import { EXAM_FILTERS, examStatusLabel, resolveExamFeatures, type ExamCardStatus, type ExamListFilterId } from './exam/config';
import { buildLocalPedagogicalFeedback, type PedagogicalFeedback } from './exam/feedback';
import {
    buildTopicPerformance,
    createEmptyDraft,
    ensureDraft,
    evaluateQuestion,
    getQuestionProgress,
    type ExamDraftState,
    type QuestionEvaluation,
    type ToggleAnswer,
} from './exam/grading';
import { GraphFigure } from './exam/graphs';
import { EXAM_LIBRARY, type ExamDefinition } from './exam/library';
import { TOPIC_META, type GraphKey, type TopicId } from './exam/model';
import { exportExamReportPdf } from './exam/pdf';
import { buildExamReport, formatReportDateTime, type ExamReport } from './exam/report';
import {
    createEmptyAnalysis,
    createInitialPersistedExamState,
    createNextAttemptState,
    getAttemptById,
    getCurrentAttempt,
    getLatestCompletedAttempt,
    parsePersistedExamState,
    pickMostRecentExamState,
    readLocalExamState,
    updateAttempt,
    type ExamAttemptRecord,
    type PersistedExamState,
} from './exam/storage';
import { ensureTimingSnapshot, formatDuration, formatDurationLong, useExamTiming } from './exam/timing';
import { ExamModule } from './exam/ExamModule';
import { ExamReportView } from './exam/components/ExamReportView';

type AppScreen = 'dashboard' | 'exam' | 'results';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'local-only';
type ExportStatus = 'idle' | 'exporting' | 'done' | 'error';

interface AttemptSummary {
    drafts: ExamDraftState;
    evaluations: QuestionEvaluation[];
    progressByQuestion: Record<string, ReturnType<typeof getQuestionProgress>>;
    answeredCount: number;
    reviewCount: number;
    inProgressCount: number;
    status: ExamCardStatus;
    totalTimeMs: number;
}

interface ExamCardItem {
    exam: ExamDefinition;
    state: PersistedExamState;
    currentAttempt: ExamAttemptRecord | null;
    latestCompletedAttempt: ExamAttemptRecord | null;
    status: ExamCardStatus;
    answeredCount: number;
    reviewCount: number;
    inProgressCount: number;
    totalTimeMs: number;
    updatedAt: string;
}

const EXAM_APP_BASE_PATH = '/app/provas';

function isAppScreen(value: string | null): value is AppScreen {
    return value === 'dashboard' || value === 'exam' || value === 'results';
}

function buildExamAppPath(examId: string, screen: AppScreen) {
    if (screen === 'dashboard') return EXAM_APP_BASE_PATH;

    const params = new URLSearchParams();
    if (examId) params.set('examId', examId);
    params.set('screen', screen);
    return `${EXAM_APP_BASE_PATH}?${params.toString()}`;
}

function readExamRoute(search: string, exams: ExamDefinition[]) {
    const params = new URLSearchParams(search);
    const examIdParam = params.get('examId');
    const examId = examIdParam && exams.some((exam) => exam.id === examIdParam) ? examIdParam : exams[0]?.id || '';
    const screenParam = params.get('screen');
    const legacyMode = params.get('mode');

    if (isAppScreen(screenParam)) {
        return { examId, screen: screenParam };
    }

    if (legacyMode === 'simulado') {
        return { examId, screen: 'exam' as AppScreen };
    }

    return { examId, screen: 'dashboard' as AppScreen };
}

function buildEmptyDrafts(questions: ExamDefinition['questions']): ExamDraftState {
    return Object.fromEntries(questions.map((question) => [question.id, createEmptyDraft()]));
}

function mergeDrafts(questions: ExamDefinition['questions'], incoming?: ExamDraftState | null): ExamDraftState {
    const merged = buildEmptyDrafts(questions);
    if (!incoming) return merged;

    for (const question of questions) {
        merged[question.id] = ensureDraft(incoming[question.id]);
    }

    return merged;
}

function normalizeTypeLabel(value: string) {
    return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function matchesExamFilter(item: ExamCardItem, filterId: ExamListFilterId) {
    if (filterId === 'all') return true;
    if (filterId === 'not-started' || filterId === 'in-progress' || filterId === 'completed') {
        return item.status === filterId;
    }

    return normalizeTypeLabel(item.exam.typeLabel).includes(filterId);
}

function ensureExamState(exam: ExamDefinition, state: PersistedExamState | null | undefined) {
    return state || createInitialPersistedExamState(exam, buildEmptyDrafts(exam.questions));
}

function summarizeAttempt(exam: ExamDefinition, attempt: ExamAttemptRecord | null | undefined): AttemptSummary {
    const drafts = mergeDrafts(exam.questions, attempt?.drafts);
    const evaluations = exam.questions.map((question) => evaluateQuestion(question, drafts[question.id]));
    const progressByQuestion = Object.fromEntries(
        exam.questions.map((question) => [question.id, getQuestionProgress(question, drafts[question.id])]),
    ) as Record<string, ReturnType<typeof getQuestionProgress>>;
    const answeredCount = evaluations.filter((evaluation) => evaluation.answered).length;
    const reviewCount = Object.values(progressByQuestion).filter((progress) => progress === 'review').length;
    const inProgressCount = Object.values(progressByQuestion).filter((progress) => progress === 'in-progress').length;
    const status: ExamCardStatus =
        attempt?.finished ? 'completed' : answeredCount || reviewCount || inProgressCount ? 'in-progress' : 'not-started';

    return {
        drafts,
        evaluations,
        progressByQuestion,
        answeredCount,
        reviewCount,
        inProgressCount,
        status,
        totalTimeMs: attempt?.timing.totalElapsedMs || 0,
    };
}

function buildAiRequestPayload(report: ExamReport) {
    const slowestTopics = [...report.topics]
        .sort((left, right) => right.totalTimeMs - left.totalTimeMs)
        .slice(0, 3)
        .map((topic) => ({
            label: topic.label,
            timeLabel: formatDurationLong(topic.totalTimeMs),
        }));

    return {
        summary: {
            totalQuestions: report.summary.totalQuestions,
            correctCount: report.summary.correctCount,
            incorrectCount: report.summary.incorrectCount,
            answeredCount: report.summary.answeredCount,
            performanceRatio: report.summary.performanceRatio,
            totalTimeMs: report.summary.totalTimeMs,
            averageTimePerQuestionMs: report.summary.averageTimePerQuestionMs,
        },
        topicPerformance: report.topics.map((topic) => ({
            label: topic.label,
            ratio: topic.performanceRatio,
            totalTimeMs: topic.totalTimeMs,
        })),
        wrongQuestions: report.questions
            .filter((question) => question.status !== 'correct')
            .slice(0, 8)
            .map((question) => ({
                number: question.questionNumber,
                title: question.title,
                topics: question.topics,
                studyTip: question.studyTip,
                answerSummary: question.correctAnswer,
            })),
        timingHighlights: {
            slowestQuestions: report.slowestQuestions.map((question) => ({
                number: question.questionNumber,
                title: question.title,
                timeLabel: question.timeLabel,
            })),
            slowestTopics,
        },
    };
}

export default function App() {
    const exams = useMemo(() => EXAM_LIBRARY.filter((exam) => exam.active), []);
    const topicLabels = useMemo(
        () => Object.fromEntries(Object.entries(TOPIC_META).map(([key, value]) => [key, value.label])) as Record<TopicId, string>,
        [],
    );

    const [screen, setScreen] = useState<AppScreen>('dashboard');
    const [selectedExamId, setSelectedExamId] = useState(exams[0]?.id || '');
    const [selectedFilter, setSelectedFilter] = useState<ExamListFilterId>('all');
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
    const [viewedAttemptId, setViewedAttemptId] = useState<string | null>(null);
    const [zoomedGraph, setZoomedGraph] = useState<GraphKey | null>(null);
    const [serverState, setServerState] = useState<Record<string, unknown>>({});
    const [examStates, setExamStates] = useState<Record<string, PersistedExamState>>({});

    const examStatesRef = useRef(examStates);
    const serverStateRef = useRef(serverState);
    const lastTimingPersistSecondRef = useRef<number | null>(null);
    const previousScreenRef = useRef<AppScreen>('dashboard');

    useEffect(() => {
        examStatesRef.current = examStates;
    }, [examStates]);

    useEffect(() => {
        serverStateRef.current = serverState;
    }, [serverState]);

    useEffect(() => {
        const syncFromLocation = () => {
            const nextRoute = readExamRoute(window.location.search, exams);
            setSelectedExamId(nextRoute.examId);
            setScreen(nextRoute.screen);
        };

        syncFromLocation();
        window.addEventListener('popstate', syncFromLocation);
        return () => window.removeEventListener('popstate', syncFromLocation);
    }, [exams]);

    const syncRoute = useCallback(
        (examId: string, nextScreen: AppScreen, historyMode: 'push' | 'replace' = 'replace') => {
            const normalizedExamId = examId || exams[0]?.id || '';
            const nextPath = buildExamAppPath(normalizedExamId, nextScreen);
            const currentPath = `${window.location.pathname}${window.location.search}`;

            if (currentPath === nextPath) return;

            if (historyMode === 'push') {
                window.history.pushState(null, '', nextPath);
                return;
            }

            window.history.replaceState(null, '', nextPath);
        },
        [exams],
    );

    const navigateToScreen = useCallback(
        (nextScreen: AppScreen, examId?: string, historyMode: 'push' | 'replace' = 'push') => {
            const nextExamId = examId || selectedExamId || exams[0]?.id || '';
            if (nextExamId) setSelectedExamId(nextExamId);
            setScreen(nextScreen);
            syncRoute(nextExamId, nextScreen, historyMode);
        },
        [exams, selectedExamId, syncRoute],
    );

    const activeExam = useMemo(() => exams.find((exam) => exam.id === selectedExamId) || exams[0] || null, [exams, selectedExamId]);
    const activeQuestions = activeExam?.questions || [];
    const questionIds = useMemo(() => activeQuestions.map((question) => question.id), [activeQuestions]);
    const features = useMemo(() => resolveExamFeatures(activeExam?.features), [activeExam]);

    const activeExamState = useMemo(
        () => (activeExam ? examStates[activeExam.id] || ensureExamState(activeExam, null) : null),
        [activeExam, examStates],
    );
    const currentAttempt = useMemo(() => getCurrentAttempt(activeExamState), [activeExamState]);
    const activeQuestionId = currentAttempt?.activeQuestionId || activeQuestions[0]?.id || '';

    const timing = useExamTiming({
        questionIds,
        initialSnapshot: currentAttempt?.timing || null,
        activeQuestionId,
        running: Boolean(activeExam && currentAttempt && screen === 'exam' && !loading && !currentAttempt.finished),
    });

    useEffect(() => {
        let cancelled = false;

        async function loadState() {
            try {
                const response = await fetch('/api/state');
                if (!response.ok) throw new Error('state unavailable');

                const payload = await response.json();
                const nextServerState = (payload?.state || {}) as Record<string, unknown>;
                const nextExamStates = Object.fromEntries(
                    exams.map((exam) => {
                        const remoteState = parsePersistedExamState(nextServerState[exam.stateKey], exam);
                        const localState = readLocalExamState(exam);
                        return [exam.id, ensureExamState(exam, pickMostRecentExamState(localState, remoteState))];
                    }),
                ) as Record<string, PersistedExamState>;

                if (cancelled) return;
                setServerState(nextServerState);
                setExamStates(nextExamStates);
            } catch {
                if (cancelled) return;

                const fallbackStates = Object.fromEntries(
                    exams.map((exam) => {
                        const localState = readLocalExamState(exam);
                        return [exam.id, ensureExamState(exam, localState)];
                    }),
                ) as Record<string, PersistedExamState>;

                setExamStates(fallbackStates);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void loadState();
        return () => {
            cancelled = true;
        };
    }, [exams]);

    useEffect(() => {
        if (!currentAttempt) return;
        timing.hydrate(currentAttempt.timing);
        lastTimingPersistSecondRef.current = null;
    }, [currentAttempt?.id, timing]);

    useEffect(() => {
        if (!activeExam) return;
        syncRoute(activeExam.id, screen, 'replace');
    }, [activeExam, screen, syncRoute]);

    useEffect(() => {
        if (saveStatus === 'idle') return undefined;
        const timeout = window.setTimeout(() => setSaveStatus('idle'), 2200);
        return () => window.clearTimeout(timeout);
    }, [saveStatus]);

    useEffect(() => {
        if (exportStatus === 'idle') return undefined;
        const timeout = window.setTimeout(() => setExportStatus('idle'), 2600);
        return () => window.clearTimeout(timeout);
    }, [exportStatus]);

    const persistExamStateLocal = useCallback((exam: ExamDefinition, nextState: PersistedExamState) => {
        const examFeatures = resolveExamFeatures(exam.features);
        if (!examFeatures.persistProgress) return;
        window.localStorage.setItem(exam.storageKey, JSON.stringify(nextState));
    }, []);

    const syncPersistedState = useCallback(
        async (exam: ExamDefinition, nextState: PersistedExamState) => {
            setSaveStatus('saving');

            const nextServerState = {
                ...serverStateRef.current,
                [exam.stateKey]: nextState,
            };

            try {
                const response = await fetch('/api/state', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ state: nextServerState }),
                });

                if (!response.ok) throw new Error('save unavailable');

                const payload = await response.json();
                const savedServerState = (payload?.state || nextServerState) as Record<string, unknown>;
                serverStateRef.current = savedServerState;
                setServerState(savedServerState);
                setSaveStatus('saved');
            } catch {
                serverStateRef.current = nextServerState;
                setServerState(nextServerState);
                setSaveStatus('local-only');
            }
        },
        [],
    );

    const mutateExamState = useCallback(
        (
            exam: ExamDefinition,
            updater: (state: PersistedExamState) => PersistedExamState,
            options?: { syncServer?: boolean; status?: SaveStatus },
        ) => {
            const baseState = examStatesRef.current[exam.id] || ensureExamState(exam, null);
            const nextState = updater(baseState);
            const nextExamStates = {
                ...examStatesRef.current,
                [exam.id]: nextState,
            };

            examStatesRef.current = nextExamStates;
            setExamStates(nextExamStates);
            persistExamStateLocal(exam, nextState);

            if (options?.syncServer) {
                void syncPersistedState(exam, nextState);
            } else if (options?.status) {
                setSaveStatus(options.status);
            }

            return nextState;
        },
        [persistExamStateLocal, syncPersistedState],
    );

    const liveTimingSnapshot = useMemo(
        () =>
            ensureTimingSnapshot(
                {
                    ...timing.snapshot,
                    totalElapsedMs: timing.totalElapsedMs,
                    questionElapsedMs: timing.questionElapsedMs,
                },
                questionIds,
            ),
        [questionIds, timing.questionElapsedMs, timing.snapshot, timing.totalElapsedMs],
    );

    const currentAttemptView = useMemo(() => {
        if (!currentAttempt) return null;
        if (screen !== 'exam' || currentAttempt.finished) return currentAttempt;
        return {
            ...currentAttempt,
            timing: liveTimingSnapshot,
        };
    }, [currentAttempt, liveTimingSnapshot, screen]);

    const currentSummary = useMemo(
        () => (activeExam && currentAttemptView ? summarizeAttempt(activeExam, currentAttemptView) : null),
        [activeExam, currentAttemptView],
    );
    const currentDrafts = currentSummary?.drafts || buildEmptyDrafts(activeQuestions);
    const progressByQuestion = currentSummary?.progressByQuestion || {};
    const answeredCount = currentSummary?.answeredCount || 0;
    const reviewCount = currentSummary?.reviewCount || 0;
    const inProgressCount = currentSummary?.inProgressCount || 0;
    const currentStatus = currentSummary?.status || 'not-started';
    const activeIndex = activeQuestions.findIndex((question) => question.id === activeQuestionId);

    const latestCompletedAttempt = useMemo(() => getLatestCompletedAttempt(activeExamState), [activeExamState]);

    const examCards = useMemo(
        () =>
            exams.map((exam) => {
                const state = examStates[exam.id] || ensureExamState(exam, null);
                const baseAttempt = getCurrentAttempt(state);
                const cardAttempt =
                    exam.id === activeExam?.id && currentAttemptView && currentAttemptView.id === baseAttempt?.id ? currentAttemptView : baseAttempt;
                const summary = summarizeAttempt(exam, cardAttempt);

                return {
                    exam,
                    state,
                    currentAttempt: cardAttempt,
                    latestCompletedAttempt: getLatestCompletedAttempt(state),
                    status: summary.status,
                    answeredCount: summary.answeredCount,
                    reviewCount: summary.reviewCount,
                    inProgressCount: summary.inProgressCount,
                    totalTimeMs: cardAttempt?.timing.totalElapsedMs || 0,
                    updatedAt: cardAttempt?.updatedAt || exam.createdAt,
                } satisfies ExamCardItem;
            }),
        [activeExam?.id, currentAttemptView, examStates, exams],
    );

    const filteredExamCards = useMemo(
        () => examCards.filter((item) => matchesExamFilter(item, selectedFilter)),
        [examCards, selectedFilter],
    );

    const reportAttempt = useMemo(() => {
        if (!activeExamState) return null;

        const viewedAttempt = getAttemptById(activeExamState, viewedAttemptId);
        if (screen === 'results' && viewedAttempt?.finished) return viewedAttempt;
        if (latestCompletedAttempt) return latestCompletedAttempt;
        return currentAttempt?.finished ? currentAttempt : null;
    }, [activeExamState, currentAttempt, latestCompletedAttempt, screen, viewedAttemptId]);

    const reportEvaluations = useMemo(
        () =>
            reportAttempt
                ? activeQuestions.map((question) => evaluateQuestion(question, ensureDraft(reportAttempt.drafts[question.id])))
                : [],
        [activeQuestions, reportAttempt],
    );

    const reportTopicPerformance = useMemo(
        () => (reportAttempt ? buildTopicPerformance(activeQuestions, reportEvaluations, topicLabels) : []),
        [activeQuestions, reportAttempt, reportEvaluations, topicLabels],
    );

    const reportCore = useMemo(
        () =>
            activeExam && reportAttempt
                ? buildExamReport({
                      exam: activeExam,
                      attemptId: reportAttempt.id,
                      attemptNumber: reportAttempt.attemptNumber,
                      questions: activeQuestions,
                      evaluations: reportEvaluations,
                      drafts: mergeDrafts(activeQuestions, reportAttempt.drafts),
                      topicPerformance: reportTopicPerformance,
                      timing: reportAttempt.timing,
                      topicLabels,
                      aiFeedback: null,
                      generatedAt: reportAttempt.analysis.generatedAt || reportAttempt.timing.completedAt || reportAttempt.updatedAt,
                  })
                : null,
        [activeExam, activeQuestions, reportAttempt, reportEvaluations, reportTopicPerformance, topicLabels],
    );

    const fallbackFeedback = useMemo(() => {
        if (!reportCore) return null;

        const slowestTopics = [...reportCore.topics]
            .sort((left, right) => right.totalTimeMs - left.totalTimeMs)
            .slice(0, 3)
            .map((topic) => ({
                label: topic.label,
                timeLabel: formatDurationLong(topic.totalTimeMs),
            }));

        return buildLocalPedagogicalFeedback({
            questions: activeQuestions,
            evaluations: reportEvaluations,
            topicPerformance: reportTopicPerformance,
            slowestQuestions: reportCore.slowestQuestions.map((question) => ({
                number: question.questionNumber,
                title: question.title,
                timeLabel: question.timeLabel,
            })),
            slowestTopics,
        });
    }, [activeQuestions, reportCore, reportEvaluations, reportTopicPerformance]);

    const report = useMemo(
        () => (reportCore ? { ...reportCore, aiFeedback: reportAttempt?.analysis.feedback || null } : null),
        [reportAttempt?.analysis.feedback, reportCore],
    );

    const reportHistory = useMemo(
        () =>
            activeExamState
                ? [...activeExamState.attempts]
                      .filter((attempt) => attempt.finished)
                      .sort((left, right) => right.attemptNumber - left.attemptNumber)
                      .map((attempt) => ({
                          id: attempt.id,
                          label: `Tentativa ${attempt.attemptNumber}`,
                          subtitle: `${formatDurationLong(attempt.timing.totalElapsedMs)} | ${formatReportDateTime(attempt.timing.completedAt || attempt.updatedAt)}`,
                          active: attempt.id === reportAttempt?.id,
                      }))
                : [],
        [activeExamState, reportAttempt?.id],
    );

    const questionGraphKeys = useMemo(
        () => Object.fromEntries(activeQuestions.map((question) => [question.id, question.graphKey])) as Record<string, GraphKey | undefined>,
        [activeQuestions],
    );

    const persistLiveCurrentAttempt = useCallback(
        (options?: { syncServer?: boolean; status?: SaveStatus }) => {
            if (!activeExam || !currentAttempt) return null;

            return mutateExamState(
                activeExam,
                (state) =>
                    updateAttempt(state, currentAttempt.id, (attempt) => ({
                        ...attempt,
                        activeQuestionId,
                        drafts: mergeDrafts(activeQuestions, attempt.drafts),
                        timing: liveTimingSnapshot,
                    })),
                {
                    syncServer: options?.syncServer,
                    status: options?.status || 'local-only',
                },
            );
        },
        [activeExam, activeQuestionId, activeQuestions, currentAttempt, liveTimingSnapshot, mutateExamState],
    );

    const openExam = useCallback(
        (examId: string) => {
            setViewedAttemptId(null);
            navigateToScreen('exam', examId);
        },
        [navigateToScreen],
    );

    const openReport = useCallback(
        (examId: string, attemptId?: string | null) => {
            const exam = exams.find((item) => item.id === examId);
            if (!exam) return;

            const state = examStatesRef.current[examId] || ensureExamState(exam, null);
            const nextAttempt = attemptId ? getAttemptById(state, attemptId) : getLatestCompletedAttempt(state);

            if (!nextAttempt?.finished) {
                openExam(examId);
                return;
            }

            setViewedAttemptId(nextAttempt.id);
            navigateToScreen('results', examId);
        },
        [exams, navigateToScreen, openExam],
    );

    const startNewAttempt = useCallback(
        (examId: string) => {
            const exam = exams.find((item) => item.id === examId);
            if (!exam) return;

            const blankDrafts = buildEmptyDrafts(exam.questions);
            const nextState = mutateExamState(
                exam,
                (state) => createNextAttemptState(state, exam, blankDrafts),
                { syncServer: true, status: 'saving' },
            );

            const nextAttempt = getCurrentAttempt(nextState);
            if (examId === activeExam?.id) {
                timing.reset();
            }

            setViewedAttemptId(nextAttempt?.id || null);
            setExportStatus('idle');
            navigateToScreen('exam', examId);
        },
        [activeExam?.id, exams, mutateExamState, navigateToScreen, timing],
    );

    const handleSelectQuestion = useCallback(
        (questionId: string) => {
            if (!activeExam || !currentAttempt || questionId === activeQuestionId) return;

            mutateExamState(
                activeExam,
                (state) =>
                    updateAttempt(state, currentAttempt.id, (attempt) => ({
                        ...attempt,
                        activeQuestionId: questionId,
                        timing: liveTimingSnapshot,
                    })),
                { status: 'local-only' },
            );
        },
        [activeExam, activeQuestionId, currentAttempt, liveTimingSnapshot, mutateExamState],
    );

    const handleAnswerChange = useCallback(
        (fieldKey: string, value: string) => {
            if (!activeExam || !currentAttempt || !activeQuestionId) return;

            mutateExamState(
                activeExam,
                (state) =>
                    updateAttempt(state, currentAttempt.id, (attempt) => {
                        const currentDraft = ensureDraft(attempt.drafts[activeQuestionId]);
                        return {
                            ...attempt,
                            timing: liveTimingSnapshot,
                            drafts: {
                                ...attempt.drafts,
                                [activeQuestionId]: {
                                    ...currentDraft,
                                    answers: {
                                        ...currentDraft.answers,
                                        [fieldKey]: value,
                                    },
                                    savedAt: new Date().toISOString(),
                                },
                            },
                        };
                    }),
                { status: 'local-only' },
            );
        },
        [activeExam, activeQuestionId, currentAttempt, liveTimingSnapshot, mutateExamState],
    );

    const handleMatrixChange = useCallback(
        (rowKey: string, columnKey: string, value: ToggleAnswer) => {
            if (!activeExam || !currentAttempt || !activeQuestionId) return;

            mutateExamState(
                activeExam,
                (state) =>
                    updateAttempt(state, currentAttempt.id, (attempt) => {
                        const currentDraft = ensureDraft(attempt.drafts[activeQuestionId]);
                        const currentRow = currentDraft.matrixAnswers[rowKey] || {};
                        return {
                            ...attempt,
                            timing: liveTimingSnapshot,
                            drafts: {
                                ...attempt.drafts,
                                [activeQuestionId]: {
                                    ...currentDraft,
                                    matrixAnswers: {
                                        ...currentDraft.matrixAnswers,
                                        [rowKey]: {
                                            ...currentRow,
                                            [columnKey]: value,
                                        },
                                    },
                                    savedAt: new Date().toISOString(),
                                },
                            },
                        };
                    }),
                { status: 'local-only' },
            );
        },
        [activeExam, activeQuestionId, currentAttempt, liveTimingSnapshot, mutateExamState],
    );

    const handleScratchChange = useCallback(
        (value: string) => {
            if (!activeExam || !currentAttempt || !activeQuestionId) return;

            mutateExamState(
                activeExam,
                (state) =>
                    updateAttempt(state, currentAttempt.id, (attempt) => {
                        const currentDraft = ensureDraft(attempt.drafts[activeQuestionId]);
                        return {
                            ...attempt,
                            timing: liveTimingSnapshot,
                            drafts: {
                                ...attempt.drafts,
                                [activeQuestionId]: {
                                    ...currentDraft,
                                    scratch: value,
                                    savedAt: new Date().toISOString(),
                                },
                            },
                        };
                    }),
                { status: 'local-only' },
            );
        },
        [activeExam, activeQuestionId, currentAttempt, liveTimingSnapshot, mutateExamState],
    );

    const handleToggleReview = useCallback(() => {
        if (!activeExam || !currentAttempt || !activeQuestionId) return;

        mutateExamState(
            activeExam,
            (state) =>
                updateAttempt(state, currentAttempt.id, (attempt) => {
                    const currentDraft = ensureDraft(attempt.drafts[activeQuestionId]);
                    return {
                        ...attempt,
                        timing: liveTimingSnapshot,
                        drafts: {
                            ...attempt.drafts,
                            [activeQuestionId]: {
                                ...currentDraft,
                                flagged: !currentDraft.flagged,
                                savedAt: new Date().toISOString(),
                            },
                        },
                    };
                }),
            { status: 'local-only' },
        );
    }, [activeExam, activeQuestionId, currentAttempt, liveTimingSnapshot, mutateExamState]);

    const handleSave = useCallback(() => {
        void persistLiveCurrentAttempt({ syncServer: true, status: 'saving' });
    }, [persistLiveCurrentAttempt]);

    const handleFinish = useCallback(() => {
        if (!activeExam || !currentAttempt) return;

        const finalTiming = timing.finish();
        mutateExamState(
            activeExam,
            (state) =>
                updateAttempt(state, currentAttempt.id, (attempt) => ({
                    ...attempt,
                    activeQuestionId,
                    finished: true,
                    timing: finalTiming,
                    analysis:
                        attempt.analysis.status === 'ready' || attempt.analysis.status === 'fallback'
                            ? attempt.analysis
                            : createEmptyAnalysis(),
                })),
            { syncServer: true, status: 'saving' },
        );

        setViewedAttemptId(currentAttempt.id);
        setExportStatus('idle');
        navigateToScreen('results', activeExam.id);
    }, [activeExam, activeQuestionId, currentAttempt, mutateExamState, navigateToScreen, timing]);

    const handleRetry = useCallback(() => {
        if (!activeExam) return;
        startNewAttempt(activeExam.id);
    }, [activeExam, startNewAttempt]);

    const handleExportReport = useCallback(async () => {
        if (!report || !features.exportPdf) return;

        setExportStatus('exporting');
        try {
            await exportExamReportPdf(report);
            setExportStatus('done');
        } catch {
            setExportStatus('error');
        }
    }, [features.exportPdf, report]);

    useEffect(() => {
        if (screen !== 'exam' || !activeExam || !currentAttempt || currentAttempt.finished) return;

        const totalSeconds = Math.floor(liveTimingSnapshot.totalElapsedMs / 1000);
        if (!totalSeconds || totalSeconds % 5 !== 0) return;
        if (lastTimingPersistSecondRef.current === totalSeconds) return;

        lastTimingPersistSecondRef.current = totalSeconds;
        persistLiveCurrentAttempt({ status: 'local-only' });
    }, [activeExam, currentAttempt, liveTimingSnapshot.totalElapsedMs, persistLiveCurrentAttempt, screen]);

    useEffect(() => {
        if (!activeExam || !currentAttempt || previousScreenRef.current !== 'exam' || screen === 'exam' || currentAttempt.finished) {
            previousScreenRef.current = screen;
            return;
        }

        persistLiveCurrentAttempt({ status: 'local-only' });
        previousScreenRef.current = screen;
    }, [activeExam, currentAttempt, persistLiveCurrentAttempt, screen]);

    useEffect(() => {
        if (screen !== 'results') return;
        if (reportAttempt?.id && viewedAttemptId !== reportAttempt.id) {
            setViewedAttemptId(reportAttempt.id);
        }
    }, [reportAttempt?.id, screen, viewedAttemptId]);

    useEffect(() => {
        if (loading || screen !== 'results' || reportAttempt || !activeExam) return;
        navigateToScreen('dashboard', activeExam.id, 'replace');
    }, [activeExam, loading, navigateToScreen, reportAttempt, screen]);

    useEffect(() => {
        if (!activeExam || !reportAttempt || !reportCore || !fallbackFeedback) return;
        if (!reportAttempt.finished) return;

        const analysis = reportAttempt.analysis;
        const attemptId = reportAttempt.id;
        const examId = activeExam.id;
        if (analysis.status === 'ready' || analysis.status === 'fallback') return;

        const requestedAtMs = analysis.requestedAt ? new Date(analysis.requestedAt).getTime() : 0;
        if (analysis.status === 'loading' && Date.now() - requestedAtMs < 30000) return;

        const requestedAt = new Date().toISOString();

        mutateExamState(
            activeExam,
            (state) =>
                updateAttempt(state, attemptId, (attempt) => ({
                    ...attempt,
                    analysis: {
                        ...attempt.analysis,
                        status: 'loading',
                        requestedAt,
                    },
                })),
            { status: 'local-only' },
        );

        async function generateFeedback() {
            try {
                const response = await fetch('/api/exam/pedagogical-feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(buildAiRequestPayload(reportCore)),
                });

                if (!response.ok) throw new Error('ai unavailable');

                const payload = await response.json();
                const feedback = payload?.feedback as PedagogicalFeedback | undefined;
                if (!feedback) throw new Error('invalid ai feedback');

                mutateExamState(
                    exams.find((item) => item.id === examId) || activeExam,
                    (state) =>
                        updateAttempt(state, attemptId, (attempt) => ({
                            ...attempt,
                            analysis: {
                                status: 'ready',
                                source: 'ai',
                                requestedAt,
                                generatedAt: new Date().toISOString(),
                                feedback,
                            },
                        })),
                    { syncServer: true, status: 'saving' },
                );
            } catch {
                mutateExamState(
                    exams.find((item) => item.id === examId) || activeExam,
                    (state) =>
                        updateAttempt(state, attemptId, (attempt) => ({
                            ...attempt,
                            analysis: {
                                status: 'fallback',
                                source: 'local',
                                requestedAt,
                                generatedAt: new Date().toISOString(),
                                feedback: fallbackFeedback,
                            },
                        })),
                    { syncServer: true, status: 'saving' },
                );
            }
        }

        void generateFeedback();
    }, [activeExam, exams, fallbackFeedback, mutateExamState, reportAttempt, reportCore]);

    const topbarSecondaryLabel =
        currentStatus === 'completed' ? 'Relatorio final' : currentStatus === 'in-progress' ? 'Continuar prova' : 'Abrir prova';

    if (!activeExam) {
        return (
            <div className="loading-shell">
                <CircleDashed className="spin" size={22} />
                <span>Nenhuma prova ativa foi cadastrada no sistema.</span>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="loading-shell">
                <CircleDashed className="spin" size={22} />
                <span>Preparando o novo modulo de provas...</span>
            </div>
        );
    }

    return (
        <div className="app-shell">
            <div className="app-topbar">
                <div className="app-topbar__brand">
                    <span>MINUTARE</span>
                    <strong>CTIA03 - Bases Matematicas</strong>
                </div>
                <div className="app-topbar__actions">
                    <button
                        type="button"
                        className={`topbar-link ${screen === 'dashboard' ? 'topbar-link--active' : ''}`}
                        onClick={() => {
                            if (screen === 'exam') persistLiveCurrentAttempt({ status: 'local-only' });
                            navigateToScreen('dashboard', activeExam.id);
                        }}
                    >
                        <House size={16} />
                        Painel de provas
                    </button>
                    <button
                        type="button"
                        className={`topbar-link ${screen !== 'dashboard' ? 'topbar-link--active' : ''}`}
                        onClick={() => {
                            if (screen === 'exam') persistLiveCurrentAttempt({ status: 'local-only' });
                            if (currentStatus === 'completed' && latestCompletedAttempt) {
                                openReport(activeExam.id, latestCompletedAttempt.id);
                                return;
                            }
                            openExam(activeExam.id);
                        }}
                    >
                        {currentStatus === 'completed' ? <BarChart3 size={16} /> : <ClipboardList size={16} />}
                        {topbarSecondaryLabel}
                    </button>
                </div>
            </div>

            {screen === 'dashboard' ? (
                <>
                    <header className="hero hero--dashboard">
                        <div className="hero__copy">
                            <span className="hero__eyebrow">UFBA - Bases Matematicas - Avaliacoes</span>
                            <h1>Painel de provas coerente com o produto, com status claro, retomada limpa e relatorio reutilizavel.</h1>
                            <p>As provas usam tentativa atual, historico concluido, retomada segura e exportacao real em PDF sem depender de asset estatico nem de relatorio recalculado a cada render.</p>
                        </div>
                        <div className="hero__stats">
                            <div className="stat-card"><span>Provas ativas</span><strong>{examCards.length}</strong></div>
                            <div className="stat-card"><span>Em andamento</span><strong>{examCards.filter((item) => item.status === 'in-progress').length}</strong></div>
                            <div className="stat-card"><span>Concluidas</span><strong>{examCards.filter((item) => item.status === 'completed').length}</strong></div>
                        </div>
                    </header>

                    <main className="dashboard-shell">
                        <section className="dashboard-section">
                            <div className="section-heading">
                                <div>
                                    <h3>Simulados e provas</h3>
                                    <p>Inicie, continue, revise relatorios antigos ou abra uma nova tentativa sem corromper a execucao anterior.</p>
                                </div>
                            </div>

                            <div className="exam-filter-bar" role="toolbar" aria-label="Filtros de provas">
                                <span className="exam-filter-bar__label"><ListFilter size={16} />Filtrar</span>
                                {EXAM_FILTERS.map((filter) => (
                                    <button
                                        key={filter.id}
                                        type="button"
                                        className={`filter-chip ${selectedFilter === filter.id ? 'filter-chip--active' : ''}`}
                                        onClick={() => setSelectedFilter(filter.id)}
                                    >
                                        {filter.label}
                                    </button>
                                ))}
                            </div>

                            <div className="exam-library">
                                {filteredExamCards.map((item) => {
                                    const cardFeatures = resolveExamFeatures(item.exam.features);
                                    const primaryLabel =
                                        item.status === 'completed' ? 'Ver relatorio' : item.status === 'in-progress' ? 'Continuar prova' : 'Iniciar prova';

                                    return (
                                        <article key={item.exam.id} className="exam-library-card">
                                            <div className="exam-library-card__header">
                                                <div>
                                                    <span className="question-card__eyebrow">{item.exam.category}</span>
                                                    <h3>{item.exam.subtitle} - {item.exam.title}</h3>
                                                    <p>{item.exam.description}</p>
                                                </div>
                                                <span className={`exam-status-pill exam-status-pill--${item.status}`}>{examStatusLabel(item.status)}</span>
                                            </div>

                                            <div className="badge-row">
                                                {item.exam.topics.slice(0, 6).map((topic) => (
                                                    <span key={topic} className="tag">{TOPIC_META[topic].short}</span>
                                                ))}
                                            </div>

                                            <div className="exam-library-card__meta">
                                                <div className="exam-library-card__meta-item">
                                                    <ClipboardList size={16} />
                                                    <div>
                                                        <strong>{item.exam.questionCount} questoes</strong>
                                                        <span>{item.exam.typeLabel} | {item.exam.difficultyLabel}</span>
                                                    </div>
                                                </div>
                                                <div className="exam-library-card__meta-item">
                                                    <Clock3 size={16} />
                                                    <div>
                                                        <strong>{item.exam.estimatedMinutes} min sugeridos</strong>
                                                        <span>{item.totalTimeMs ? `${formatDurationLong(item.totalTimeMs)} registrados` : 'Sem tempo registrado ainda'}</span>
                                                    </div>
                                                </div>
                                                <div className="exam-library-card__meta-item">
                                                    <GraduationCap size={16} />
                                                    <div>
                                                        <strong>{item.answeredCount} respondidas</strong>
                                                        <span>{item.reviewCount} marcadas para revisao</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="exam-library-card__support">
                                                <span className="support-chip">{cardFeatures.allowHints ? 'Com dicas' : 'Sem dicas durante a prova'}</span>
                                                <span className="support-chip">{cardFeatures.allowTutor ? 'Tutor liberado' : 'Tutor bloqueado no modo prova'}</span>
                                                <span className="support-chip">{cardFeatures.exportPdf ? 'PDF disponivel' : 'Sem PDF'}</span>
                                            </div>

                                            <div className="exam-library-card__footer">
                                                <div className="exam-library-card__footer-copy">
                                                    <strong>{item.currentAttempt ? `Tentativa ${item.currentAttempt.attemptNumber}` : item.exam.semester}</strong>
                                                    <span>Atualizado em {formatReportDateTime(item.updatedAt)}</span>
                                                </div>
                                                <div className="exam-library-card__actions">
                                                    <button
                                                        type="button"
                                                        className="primary-button"
                                                        onClick={() =>
                                                            item.status === 'completed' && item.latestCompletedAttempt
                                                                ? openReport(item.exam.id, item.latestCompletedAttempt.id)
                                                                : openExam(item.exam.id)
                                                        }
                                                    >
                                                        <PlayCircle size={16} />
                                                        {primaryLabel}
                                                    </button>
                                                    {item.latestCompletedAttempt && item.status !== 'completed' ? (
                                                        <button type="button" className="ghost-button" onClick={() => openReport(item.exam.id, item.latestCompletedAttempt?.id)}>
                                                            <BarChart3 size={16} />
                                                            Ver relatorio
                                                        </button>
                                                    ) : null}
                                                    {item.status !== 'not-started' ? (
                                                        <button
                                                            type="button"
                                                            className="ghost-button"
                                                            onClick={() => {
                                                                if (window.confirm('Criar uma nova tentativa limpa para esta prova? As tentativas anteriores serao mantidas.')) {
                                                                    startNewAttempt(item.exam.id);
                                                                }
                                                            }}
                                                        >
                                                            <PlayCircle size={16} />
                                                            {item.status === 'completed' ? 'Refazer prova' : 'Nova tentativa'}
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="dashboard-grid">
                            <article className="dashboard-note">
                                <span className="question-card__eyebrow">Tentativas controladas</span>
                                <h3>Continuar, finalizar e refazer sem travar o estado</h3>
                                <p>Cada prova agora guarda tentativa atual, tentativas concluidas e analise por tentativa, evitando mistura entre historico e nova execucao.</p>
                            </article>
                            <article className="dashboard-note">
                                <span className="question-card__eyebrow">IA com cache</span>
                                <h3>Analise reutilizada no relatorio</h3>
                                <p>A leitura pedagogica e gerada uma vez por tentativa concluida e depois fica persistida para reabertura, PDF e navegacao futura.</p>
                            </article>
                        </section>
                    </main>
                </>
            ) : screen === 'results' && report ? (
                <>
                    <header className="hero hero--results">
                        <div className="hero__copy">
                            <span className="hero__eyebrow">{activeExam.subtitle} - {activeExam.title}</span>
                            <h1>Relatorio forte, legivel e reutilizavel por tentativa.</h1>
                            <p>O relatorio combina desempenho, tempo, leitura pedagogica persistida e revisao por questao, com exportacao PDF sem depender do DOM de impressao.</p>
                        </div>
                        <div className="hero__stats">
                            <div className="stat-card"><span>Aproveitamento</span><strong>{(report.summary.performanceRatio * 100).toFixed(0)}%</strong></div>
                            <div className="stat-card"><span>Tempo total</span><strong>{formatDuration(report.summary.totalTimeMs)}</strong></div>
                            <div className="stat-card"><span>Tentativa</span><strong>{report.attemptNumber}</strong></div>
                        </div>
                    </header>

                    <ExamReportView
                        report={report}
                        evaluations={reportEvaluations}
                        questionGraphKeys={questionGraphKeys}
                        aiStatus={reportAttempt?.analysis.status || 'idle'}
                        exportStatus={exportStatus}
                        canExportPdf={features.exportPdf}
                        attempts={reportHistory}
                        onSelectAttempt={setViewedAttemptId}
                        onBackDashboard={() => navigateToScreen('dashboard', activeExam.id)}
                        onExportPdf={() => {
                            void handleExportReport();
                        }}
                        onRetry={handleRetry}
                    />
                </>
            ) : (
                <>
                    <header className="hero hero--exam">
                        <div className="hero__copy">
                            <span className="hero__eyebrow">{activeExam.subtitle} - {activeExam.title}</span>
                            <h1>Experiencia de prova focada, legivel e pronta para continuar ou revisar.</h1>
                            <p>Enunciado amplo, resposta oficial separada do rascunho, mapa de questoes claro e tempos visiveis sem quebrar a experiencia principal da plataforma.</p>
                        </div>
                        <div className="hero__stats">
                            <div className="stat-card"><span>Respondidas</span><strong>{answeredCount}/{activeQuestions.length}</strong></div>
                            <div className="stat-card"><span>Tempo total</span><strong>{features.showTotalTimer ? formatDuration(liveTimingSnapshot.totalElapsedMs) : '--:--'}</strong></div>
                            <div className="stat-card"><span>Para revisar</span><strong>{reviewCount}</strong></div>
                        </div>
                    </header>

                    <ExamModule
                        exam={activeExam}
                        attemptNumber={currentAttemptView?.attemptNumber || 1}
                        questions={activeQuestions}
                        drafts={currentDrafts}
                        activeQuestionId={activeQuestionId}
                        progressByQuestion={progressByQuestion}
                        questionElapsedMs={liveTimingSnapshot.questionElapsedMs}
                        totalElapsedMs={liveTimingSnapshot.totalElapsedMs}
                        answeredCount={answeredCount}
                        reviewCount={reviewCount}
                        inProgressCount={inProgressCount}
                        saveStatus={saveStatus}
                        onSelectQuestion={handleSelectQuestion}
                        onAnswerChange={handleAnswerChange}
                        onMatrixChange={handleMatrixChange}
                        onScratchChange={handleScratchChange}
                        onToggleReview={handleToggleReview}
                        onPrevious={() => {
                            if (activeIndex > 0) handleSelectQuestion(activeQuestions[activeIndex - 1].id);
                        }}
                        onNext={() => {
                            if (activeIndex >= 0 && activeIndex < activeQuestions.length - 1) handleSelectQuestion(activeQuestions[activeIndex + 1].id);
                        }}
                        onSave={handleSave}
                        onFinish={handleFinish}
                        onZoomGraph={(graphKey) => {
                            if (graphKey) setZoomedGraph(graphKey);
                        }}
                    />
                </>
            )}

            {zoomedGraph ? (
                <div className="graph-modal" role="dialog" aria-modal="true" onClick={() => setZoomedGraph(null)}>
                    <div className="graph-modal__content" onClick={(event) => event.stopPropagation()}>
                        <button type="button" className="graph-modal__close" onClick={() => setZoomedGraph(null)}>Fechar</button>
                        <GraphFigure graphKey={zoomedGraph} />
                    </div>
                </div>
            ) : null}
        </div>
    );
}
