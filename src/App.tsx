import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  ClipboardList,
  Clock3,
  Expand,
  FileDown,
  Flag,
  GraduationCap,
  House,
  ListFilter,
  PenTool,
  PlayCircle,
  Save,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';
import { ContentRenderer, MathText } from './exam/content';
import { EXAM_FILTERS, examStatusLabel, resolveExamFeatures, type ExamCardStatus, type ExamListFilterId } from './exam/config';
import { buildLocalPedagogicalFeedback, type PedagogicalFeedback } from './exam/feedback';
import {
  buildTopicPerformance,
  createEmptyDraft,
  ensureDraft,
  evaluateQuestion,
  getQuestionProgress,
  type ExamDraftState,
  type QuestionDraft,
  type QuestionEvaluation,
  type ToggleAnswer,
} from './exam/grading';
import { GraphFigure } from './exam/graphs';
import { EXAM_LIBRARY, type ExamDefinition } from './exam/library';
import { TOPIC_META, type ExamQuestion, type GraphKey, type TopicId } from './exam/model';
import { exportExamReportPdf } from './exam/pdf';
import { buildExamReport, buildTimeHighlights, formatReportDateTime } from './exam/report';
import {
  buildPersistedExamState,
  createInitialPersistedExamState,
  pickMostRecentExamState,
  readLocalExamState,
  type PersistedExamState,
} from './exam/storage';
import { ensureTimingSnapshot, formatDuration, formatDurationLong, useExamTiming } from './exam/timing';

type AppScreen = 'dashboard' | 'exam' | 'results';

function buildEmptyDrafts(questions: ExamQuestion[]): ExamDraftState {
  return Object.fromEntries(questions.map((question) => [question.id, createEmptyDraft()]));
}

function mergeDrafts(questions: ExamQuestion[], base: ExamDraftState, incoming?: ExamDraftState | null): ExamDraftState {
  const merged = { ...base };
  if (!incoming) return merged;
  for (const question of questions) merged[question.id] = ensureDraft(incoming[question.id]);
  return merged;
}

function progressLabel(progress: ReturnType<typeof getQuestionProgress>) {
  if (progress === 'answered') return 'Respondida';
  if (progress === 'in-progress') return 'Em andamento';
  if (progress === 'review') return 'Revisar';
  return 'Nao respondida';
}

function difficultyLabel(level: ExamQuestion['difficulty']) {
  if (level === 'desafio') return 'Desafio';
  if (level === 'intermediario') return 'Intermediaria';
  return 'Base';
}

function gradeTone(ratio: number) {
  if (ratio >= 0.999) return 'strong';
  if (ratio > 0) return 'partial';
  return 'weak';
}

function normalizeTypeLabel(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function summarizeExamState(questions: ExamQuestion[], drafts: ExamDraftState, finished: boolean) {
  const evaluations = questions.map((question) => evaluateQuestion(question, drafts[question.id]));
  const progressByQuestion = Object.fromEntries(
    questions.map((question) => [question.id, getQuestionProgress(question, drafts[question.id])]),
  ) as Record<string, ReturnType<typeof getQuestionProgress>>;
  const answeredCount = evaluations.filter((evaluation) => evaluation.answered).length;
  const reviewCount = Object.values(progressByQuestion).filter((progress) => progress === 'review').length;
  const inProgressCount = Object.values(progressByQuestion).filter((progress) => progress === 'in-progress').length;
  const status: ExamCardStatus = finished ? 'completed' : answeredCount || reviewCount || inProgressCount ? 'in-progress' : 'not-started';
  return { answeredCount, reviewCount, inProgressCount, status };
}

function buildExamCardState(exam: ExamDefinition, remoteState: PersistedExamState | null, currentState?: PersistedExamState | null) {
  const baseDrafts = buildEmptyDrafts(exam.questions);
  const bestState = currentState ?? pickMostRecentExamState(readLocalExamState(exam), remoteState);
  const mergedDrafts = mergeDrafts(exam.questions, baseDrafts, bestState?.drafts);
  const summary = summarizeExamState(exam.questions, mergedDrafts, bestState?.finished ?? false);
  return {
    exam,
    state: bestState,
    status: summary.status,
    answeredCount: summary.answeredCount,
    reviewCount: summary.reviewCount,
    inProgressCount: summary.inProgressCount,
    totalTimeMs: bestState?.timing.totalElapsedMs || 0,
    updatedAt: bestState?.updatedAt || exam.createdAt,
  };
}

function matchesExamFilter(item: { exam: ExamDefinition; status: ExamCardStatus }, filterId: ExamListFilterId) {
  if (filterId === 'all') return true;
  if (filterId === 'not-started' || filterId === 'in-progress' || filterId === 'completed') return item.status === filterId;
  return normalizeTypeLabel(item.exam.typeLabel).includes(filterId);
}

function MatrixResponse({ question, draft, onChange }: { question: ExamQuestion; draft: QuestionDraft; onChange: (rowKey: string, columnKey: string, value: ToggleAnswer) => void }) {
  if (question.answerSchema.kind !== 'matrix') return null;
  const schema = question.answerSchema;
  return (
    <div className="matrix-wrapper">
      <div className="matrix-header">{schema.instructions}</div>
      <div className="matrix-table">
        <div className="matrix-row matrix-row--head">
          <div className="matrix-cell matrix-cell--label">Intervalo</div>
          {schema.columns.map((column) => (
            <div key={column.key} className="matrix-cell matrix-cell--head"><MathText text={column.label} /></div>
          ))}
        </div>
        {schema.rows.map((row) => (
          <div key={row.key} className="matrix-row">
            <div className="matrix-cell matrix-cell--label"><MathText text={row.label} /></div>
            {schema.columns.map((column) => {
              const current = draft.matrixAnswers[row.key]?.[column.key] || '';
              return (
                <div key={`${row.key}-${column.key}`} className="matrix-cell">
                  <div className="toggle-set toggle-set--matrix">
                    <button type="button" className={`toggle-chip ${current === 'sim' ? 'toggle-chip--active' : ''}`} onClick={() => onChange(row.key, column.key, 'sim')}>{schema.trueLabel}</button>
                    <button type="button" className={`toggle-chip toggle-chip--alt ${current === 'nao' ? 'toggle-chip--active-alt' : ''}`} onClick={() => onChange(row.key, column.key, 'nao')}>{schema.falseLabel}</button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldResponse({ question, draft, onAnswerChange }: { question: ExamQuestion; draft: QuestionDraft; onAnswerChange: (fieldKey: string, value: string) => void }) {
  if (question.answerSchema.kind !== 'groups') return null;
  return (
    <div className="groups-grid">
      {question.answerSchema.groups.map((group) => (
        <section key={group.key} className={`answer-group ${group.compact ? 'answer-group--compact' : ''}`}>
          <div className="answer-group__title">
            <span>{group.label}</span>
            {group.prompt ? <small><MathText text={group.prompt} /></small> : null}
          </div>
          <div className={`field-stack ${group.fields.length > 1 ? 'field-stack--multi' : ''}`}>
            {group.fields.map((field) => {
              const value = draft.answers[field.key] || '';
              const expectsBoolean = field.input === 'toggle' && field.checker.type === 'exact' && ['v', 'f'].includes(field.checker.accepted[0].toLowerCase());
              return (
                <label key={field.key} className="field-card">
                  <span className="field-card__label">{field.label}</span>
                  {field.helpText ? <span className="field-card__help">{field.helpText}</span> : null}
                  {field.input === 'textarea' ? (
                    <textarea rows={field.rows || 4} value={value} placeholder={field.placeholder} onChange={(event) => onAnswerChange(field.key, event.target.value)} />
                  ) : field.input === 'toggle' ? (
                    <div className="toggle-set">
                      <button type="button" className={`toggle-chip ${value === (expectsBoolean ? 'V' : 'sim') ? 'toggle-chip--active' : ''}`} onClick={() => onAnswerChange(field.key, expectsBoolean ? 'V' : 'sim')}>{expectsBoolean ? 'V' : 'Sim'}</button>
                      <button type="button" className={`toggle-chip toggle-chip--alt ${value === (expectsBoolean ? 'F' : 'nao') ? 'toggle-chip--active-alt' : ''}`} onClick={() => onAnswerChange(field.key, expectsBoolean ? 'F' : 'nao')}>{expectsBoolean ? 'F' : 'Nao'}</button>
                    </div>
                  ) : (
                    <input type="text" value={value} placeholder={field.placeholder} onChange={(event) => onAnswerChange(field.key, event.target.value)} />
                  )}
                </label>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function ResultStatus({ evaluation }: { evaluation: QuestionEvaluation }) {
  if (evaluation.status === 'blank') return <span className="result-pill result-pill--blank"><CircleDashed size={16} />Em branco</span>;
  if (evaluation.status === 'correct') return <span className="result-pill result-pill--correct"><CheckCircle2 size={16} />Acertou</span>;
  if (evaluation.status === 'partial') return <span className="result-pill result-pill--partial"><Target size={16} />Parcial</span>;
  return <span className="result-pill result-pill--incorrect"><XCircle size={16} />Errou</span>;
}

function parseRemoteState(serverState: Record<string, unknown>, exam: ExamDefinition) {
  const rawState = serverState[exam.stateKey];
  if (!rawState || typeof rawState !== 'object') return null;
  const candidate = rawState as Partial<PersistedExamState>;
  if (!candidate.updatedAt || !candidate.activeQuestionId || !candidate.drafts) return null;
  return {
    version: 2,
    examId: candidate.examId || exam.id,
    updatedAt: candidate.updatedAt,
    activeQuestionId: candidate.activeQuestionId,
    finished: Boolean(candidate.finished),
    drafts: candidate.drafts as ExamDraftState,
    timing: ensureTimingSnapshot(candidate.timing, exam.questions.map((question) => question.id)),
  } satisfies PersistedExamState;
}

export default function App() {
  const exams = useMemo(() => EXAM_LIBRARY.filter((exam) => exam.active), []);
  const topicLabels = useMemo(
    () => Object.fromEntries(Object.entries(TOPIC_META).map(([key, value]) => [key, value.label])) as Record<TopicId, string>,
    [],
  );

  const [screen, setScreen] = useState<AppScreen>('dashboard');
  const [selectedExamId, setSelectedExamId] = useState(exams[0]?.id || '');
  const [drafts, setDrafts] = useState<ExamDraftState>({});
  const [activeQuestionId, setActiveQuestionId] = useState('');
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [examReady, setExamReady] = useState(false);
  const [remoteExamStates, setRemoteExamStates] = useState<Record<string, PersistedExamState | null>>({});
  const [serverState, setServerState] = useState<Record<string, unknown>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'local-only'>('idle');
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'done' | 'error'>('idle');
  const [zoomedGraph, setZoomedGraph] = useState<GraphKey | null>(null);
  const [aiFeedback, setAiFeedback] = useState<PedagogicalFeedback | null>(null);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
  const [selectedFilter, setSelectedFilter] = useState<ExamListFilterId>('all');

  const activeExam = useMemo(() => exams.find((exam) => exam.id === selectedExamId) || exams[0] || null, [exams, selectedExamId]);
  const activeQuestions = activeExam?.questions || [];
  const questionIds = useMemo(() => activeQuestions.map((question) => question.id), [activeQuestions]);
  const features = useMemo(() => resolveExamFeatures(activeExam?.features), [activeExam]);

  const timing = useExamTiming({
    questionIds,
    initialSnapshot: null,
    activeQuestionId: activeQuestionId || activeQuestions[0]?.id || '',
    running: Boolean(activeExam && screen === 'exam' && !finished && !loading && examReady),
  });

  useEffect(() => {
    let cancelled = false;
    async function loadState() {
      try {
        const response = await fetch('/api/state');
        if (!response.ok) throw new Error('state unavailable');
        const payload = await response.json();
        const nextServerState = (payload?.state || {}) as Record<string, unknown>;
        if (cancelled) return;
        setServerState(nextServerState);
        setRemoteExamStates(Object.fromEntries(exams.map((exam) => [exam.id, parseRemoteState(nextServerState, exam)])) as Record<string, PersistedExamState | null>);
      } catch {
        if (!cancelled) setRemoteExamStates(Object.fromEntries(exams.map((exam) => [exam.id, null])) as Record<string, PersistedExamState | null>);
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
    if (loading || !activeExam) return;
    setExamReady(false);
    const baseDrafts = buildEmptyDrafts(activeExam.questions);
    const bestState = pickMostRecentExamState(readLocalExamState(activeExam), remoteExamStates[activeExam.id] || null) || createInitialPersistedExamState(activeExam, baseDrafts);
    const nextQuestionId = activeExam.questions.some((question) => question.id === bestState.activeQuestionId) ? bestState.activeQuestionId : activeExam.questions[0]?.id || '';
    setDrafts(mergeDrafts(activeExam.questions, baseDrafts, bestState.drafts));
    setActiveQuestionId(nextQuestionId);
    setFinished(bestState.finished);
    timing.hydrate(bestState.timing);
    setAiFeedback(null);
    setAiStatus('idle');
    setExportStatus('idle');
    setExamReady(true);
  }, [activeExam, loading, remoteExamStates, timing]);

  const timingSnapshot = useMemo(
        () => ensureTimingSnapshot({ ...timing.snapshot, totalElapsedMs: timing.totalElapsedMs, questionElapsedMs: timing.questionElapsedMs }, questionIds),
    [activeQuestions, timing.questionElapsedMs, timing.snapshot, timing.totalElapsedMs],
  );

  const persistedState = useMemo(() => {
    if (!activeExam) return null;
    return buildPersistedExamState({ exam: activeExam, activeQuestionId: activeQuestionId || activeQuestions[0]?.id || '', finished, drafts, timing: timingSnapshot });
  }, [activeExam, activeQuestionId, activeQuestions, drafts, finished, timingSnapshot]);

  useEffect(() => {
    if (!activeExam || !persistedState || loading || !examReady || !features.persistProgress) return;
    window.localStorage.setItem(activeExam.storageKey, JSON.stringify(persistedState));
  }, [activeExam, examReady, features.persistProgress, loading, persistedState]);

  useEffect(() => {
    if (saveStatus === 'idle') return;
    const timeout = window.setTimeout(() => setSaveStatus('idle'), 2200);
    return () => window.clearTimeout(timeout);
  }, [saveStatus]);

  useEffect(() => {
    if (exportStatus === 'idle') return;
    const timeout = window.setTimeout(() => setExportStatus('idle'), 2600);
    return () => window.clearTimeout(timeout);
  }, [exportStatus]);

  const evaluations = useMemo(() => activeQuestions.map((question) => evaluateQuestion(question, drafts[question.id])), [activeQuestions, drafts]);
  const topicPerformance = useMemo(() => buildTopicPerformance(activeQuestions, evaluations, topicLabels), [activeQuestions, evaluations, topicLabels]);
  const answeredCount = evaluations.filter((item) => item.answered).length;
  const overallScore = evaluations.reduce((sum, item) => sum + item.score, 0);
  const overallMax = evaluations.reduce((sum, item) => sum + item.maxScore, 0);
  const overallRatio = overallMax ? overallScore / overallMax : 0;
  const progressByQuestion = useMemo(
    () => Object.fromEntries(activeQuestions.map((question) => [question.id, getQuestionProgress(question, drafts[question.id])])) as Record<string, ReturnType<typeof getQuestionProgress>>,
    [activeQuestions, drafts],
  );
  const reviewCount = Object.values(progressByQuestion).filter((status) => status === 'review').length;
  const inProgressCount = Object.values(progressByQuestion).filter((status) => status === 'in-progress').length;
  const examStatus: ExamCardStatus = finished ? 'completed' : answeredCount || reviewCount || inProgressCount ? 'in-progress' : 'not-started';
  const activeIndex = activeQuestions.findIndex((question) => question.id === activeQuestionId);
  const activeQuestion = activeQuestions[activeIndex] || activeQuestions[0] || null;
  const activeDraft = activeQuestion ? ensureDraft(drafts[activeQuestion.id]) : createEmptyDraft();
  const activeQuestionProgress = activeQuestion ? progressByQuestion[activeQuestion.id] || 'unanswered' : 'unanswered';
  const activeQuestionTimeMs = activeQuestion ? timing.questionElapsedMs[activeQuestion.id] || 0 : 0;

  const report = useMemo(() => {
    if (!activeExam) return null;
    return buildExamReport({ exam: activeExam, questions: activeQuestions, evaluations, drafts, topicPerformance, timing: timingSnapshot, topicLabels, aiFeedback });
  }, [activeExam, activeQuestions, aiFeedback, drafts, evaluations, timingSnapshot, topicLabels, topicPerformance]);

  const timeHighlights = useMemo(() => (report ? buildTimeHighlights(report) : null), [report]);
  const slowestTopics = useMemo(
    () => report ? [...report.topics].sort((left, right) => right.totalTimeMs - left.totalTimeMs).slice(0, 3).map((topic) => ({ label: topic.label, timeLabel: formatDurationLong(topic.totalTimeMs) })) : [],
    [report],
  );
  useEffect(() => {
    if (!finished || !activeExam || !report) {
      setAiStatus('idle');
      setAiFeedback(null);
      return;
    }

    const fallback = buildLocalPedagogicalFeedback({
      questions: activeQuestions,
      evaluations,
      topicPerformance,
      slowestQuestions: report.slowestQuestions.map((question) => ({ number: question.questionNumber, title: question.title, timeLabel: question.timeLabel })),
      slowestTopics,
    });

    let cancelled = false;
    async function loadFeedback() {
      setAiStatus('loading');
      try {
        const response = await fetch('/api/exam/pedagogical-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: {
              totalQuestions: report.summary.totalQuestions,
              correctCount: report.summary.correctCount,
              incorrectCount: report.summary.incorrectCount + report.summary.partialCount,
              answeredCount: report.summary.answeredCount,
              performanceRatio: report.summary.performanceRatio,
              totalTimeMs: report.summary.totalTimeMs,
              averageTimePerQuestionMs: report.summary.averageTimePerQuestionMs,
            },
            topicPerformance: report.topics.map((topic) => ({ topic: topic.label, label: topic.label, ratio: topic.performanceRatio, totalTimeMs: topic.totalTimeMs })),
            wrongQuestions: report.questions
              .filter((question) => question.status !== 'correct')
              .map((question) => ({
                number: question.questionNumber,
                title: question.title,
                topics: question.topics,
                studyTip: question.studyTip,
                answerSummary: question.correctAnswer,
              })),
            timingHighlights: {
              slowestQuestions: report.slowestQuestions.map((question) => ({ number: question.questionNumber, title: question.title, timeLabel: question.timeLabel })),
              slowestTopics,
            },
          }),
        });
        if (!response.ok) throw new Error('feedback unavailable');
        const payload = await response.json();
        if (!cancelled) {
          setAiFeedback(payload.feedback as PedagogicalFeedback);
          setAiStatus('ready');
        }
      } catch {
        if (!cancelled) {
          setAiFeedback(fallback);
          setAiStatus('fallback');
        }
      }
    }
    void loadFeedback();
    return () => {
      cancelled = true;
    };
  }, [activeExam, activeQuestions, evaluations, finished, report, slowestTopics, topicPerformance]);

  const examCards = useMemo(
    () => exams.map((exam) => buildExamCardState(exam, remoteExamStates[exam.id] || null, activeExam?.id === exam.id && persistedState ? persistedState : null)),
    [activeExam?.id, exams, persistedState, remoteExamStates],
  );
  const filteredExamCards = useMemo(() => examCards.filter((item) => matchesExamFilter(item, selectedFilter)), [examCards, selectedFilter]);

  async function syncPersistedState(nextState: PersistedExamState) {
    if (!activeExam || !features.persistProgress) return;
    setSaveStatus('saving');
    const nextServerState = { ...serverState, [activeExam.stateKey]: nextState };
    try {
      const response = await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: nextServerState }),
      });
      if (!response.ok) throw new Error('save failed');
      const payload = await response.json();
      setServerState((payload?.state || nextServerState) as Record<string, unknown>);
      setRemoteExamStates((current) => ({ ...current, [activeExam.id]: nextState }));
      setSaveStatus('saved');
    } catch {
      setRemoteExamStates((current) => ({ ...current, [activeExam.id]: nextState }));
      setSaveStatus('local-only');
    }
  }

  function updateQuestionDraft(questionId: string, updater: (draft: QuestionDraft) => QuestionDraft) {
    setDrafts((current) => ({ ...current, [questionId]: updater(ensureDraft(current[questionId])) }));
  }

  function goToQuestion(nextIndex: number) {
    const safeIndex = Math.max(0, Math.min(activeQuestions.length - 1, nextIndex));
    const nextQuestion = activeQuestions[safeIndex];
    if (!nextQuestion) return;
    setActiveQuestionId(nextQuestion.id);
  }

  function openExam(examId: string, target: AppScreen) {
    setSelectedExamId(examId);
    setScreen(target);
  }

  function handleSave() {
    if (!persistedState) return;
    void syncPersistedState(persistedState);
  }

  function handleFinish() {
    if (!activeExam) return;
    const finishedTiming = timing.finish();
    const nextState = buildPersistedExamState({
      exam: activeExam,
      activeQuestionId: activeQuestionId || activeQuestions[0]?.id || '',
      finished: true,
      drafts,
      timing: finishedTiming,
    });
    setFinished(true);
    setScreen('results');
    setRemoteExamStates((current) => ({ ...current, [activeExam.id]: nextState }));
    if (features.persistProgress) {
      window.localStorage.setItem(activeExam.storageKey, JSON.stringify(nextState));
      void syncPersistedState(nextState);
    }
  }

  async function handleExportReport() {
    if (!report || aiStatus === 'loading' || !aiFeedback) return;
    setExportStatus('exporting');
    try {
      await exportExamReportPdf(report);
      setExportStatus('done');
    } catch {
      setExportStatus('error');
    }
  }

  if (!activeExam) {
    return <div className="loading-shell"><CircleDashed className="spin" size={22} /><span>Nenhuma prova ativa foi cadastrada no sistema.</span></div>;
  }

  if (loading || !examReady) {
    return <div className="loading-shell"><CircleDashed className="spin" size={22} /><span>Preparando a experiencia interativa da prova...</span></div>;
  }

  const dashboardView = (
    <main className="dashboard-shell">
      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <h3>Simulados e provas</h3>
            <p>Escolha a avaliacao, acompanhe o progresso salvo e entre no modo prova sem dicas, tutor ou correcao imediata.</p>
          </div>
        </div>

        <div className="exam-filter-bar" role="toolbar" aria-label="Filtros de provas">
          <span className="exam-filter-bar__label"><ListFilter size={16} />Filtrar</span>
          {EXAM_FILTERS.map((filter) => (
            <button key={filter.id} type="button" className={`filter-chip ${selectedFilter === filter.id ? 'filter-chip--active' : ''}`} onClick={() => setSelectedFilter(filter.id)}>
              {filter.label}
            </button>
          ))}
        </div>

        <div className="exam-library">
          {filteredExamCards.map((item) => {
            const cardFeatures = resolveExamFeatures(item.exam.features);
            const primaryActionLabel = item.status === 'completed' ? 'Ver relatorio' : item.status === 'in-progress' ? 'Continuar prova' : 'Iniciar prova';
            const primaryActionTarget: AppScreen = item.status === 'completed' ? 'results' : 'exam';
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
                  {item.exam.topics.slice(0, 6).map((topic) => <span key={topic} className="tag">{TOPIC_META[topic].short}</span>) }
                </div>

                <div className="exam-library-card__meta">
                  <div className="exam-library-card__meta-item">
                    <ClipboardList size={16} />
                    <div>
                      <strong>{item.exam.questionCount} questoes</strong>
                      <span>{item.exam.typeLabel} · {item.exam.difficultyLabel}</span>
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
                  <span className="support-chip">{cardFeatures.exportPdf ? 'Relatorio em PDF' : 'Sem exportacao PDF'}</span>
                </div>

                <div className="exam-library-card__footer">
                  <div className="exam-library-card__footer-copy">
                    <strong>{item.exam.semester}</strong>
                    <span>Atualizado em {formatReportDateTime(item.updatedAt)}</span>
                  </div>
                  <div className="exam-library-card__actions">
                    <button type="button" className="primary-button" onClick={() => openExam(item.exam.id, primaryActionTarget)}>
                      <PlayCircle size={16} />{primaryActionLabel}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-note">
          <span className="question-card__eyebrow">Modo prova</span>
          <h3>Regras ativas da avaliacao</h3>
          <p>Durante a resolucao, o sistema salva respostas e cronometra tempos por questao, mas segura dicas, tutor e correcao ate a finalizacao.</p>
        </article>
        <article className="dashboard-note">
          <span className="question-card__eyebrow">Escalavel</span>
          <h3>Estrutura pronta para novas provas</h3>
          <p>A listagem usa metadados por prova, status persistido e filtros simples para crescer sem refazer o restante da plataforma.</p>
        </article>
      </section>
    </main>
  );

  const examView = activeQuestion ? (
    <div className="workspace">
      <aside className="question-rail">
        <div className="question-rail__header">
          <h2>Mapa da prova</h2>
          <p>Navegue entre as questoes sem perder o tempo acumulado de cada bloco.</p>
        </div>

        <div className="question-rail__summary">
          <div className="rail-summary-card"><span>Tempo total</span><strong>{features.showTotalTimer ? formatDuration(timing.totalElapsedMs) : '--:--'}</strong></div>
          <div className="rail-summary-card"><span>Respondidas</span><strong>{answeredCount}/{activeQuestions.length}</strong></div>
          <div className="rail-summary-card"><span>Para revisar</span><strong>{reviewCount}</strong></div>
        </div>

        <div className="question-rail__list">
          {activeQuestions.map((question, index) => {
            const progress = progressByQuestion[question.id];
            return (
              <button key={question.id} type="button" className={`rail-item ${question.id === activeQuestionId ? 'rail-item--active' : ''} rail-item--${progress}`} onClick={() => goToQuestion(index)}>
                <span className="rail-item__number">{question.number}</span>
                <span className="rail-item__content">
                  <span className="rail-item__label">{progressLabel(progress)}</span>
                  {features.showQuestionTimers ? <span className="rail-item__meta">{formatDuration(timing.questionElapsedMs[question.id] || 0)}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="question-stage">
        <section className="question-card">
          <div className="question-card__top">
            <div>
              <span className="question-card__eyebrow">Questao {activeQuestion.number} · {activeExam.moduleLabel}</span>
              <h2>{activeQuestion.title}</h2>
              <div className="badge-row">
                <span className="badge">{difficultyLabel(activeQuestion.difficulty)}</span>
                {activeQuestion.topics.map((topic) => <span key={topic} className="tag">{TOPIC_META[topic].short}</span>)}
              </div>
            </div>
            <div className="question-card__top-actions">
              <span className={`progress-pill progress-pill--${activeQuestionProgress}`}>{progressLabel(activeQuestionProgress)}</span>
              {features.showQuestionTimers ? <span className="timer-pill"><Clock3 size={16} />{formatDuration(activeQuestionTimeMs)}</span> : null}
            </div>
          </div>

          <div className="question-card__metrics">
            <div className="metric-chip"><span>Tempo da questao</span><strong>{features.showQuestionTimers ? formatDurationLong(activeQuestionTimeMs) : '--'}</strong></div>
            <div className="metric-chip"><span>Tempo total</span><strong>{features.showTotalTimer ? formatDurationLong(timing.totalElapsedMs) : '--'}</strong></div>
            <div className="metric-chip"><span>Regras ativas</span><strong>Sem apoio durante a resolucao</strong></div>
          </div>

          <div className={`question-card__body ${activeQuestion.graphKey ? 'question-card__body--with-graph' : ''}`}>
            <div className="statement-panel"><ContentRenderer blocks={activeQuestion.prompt} /></div>
            {activeQuestion.graphKey ? (
              <aside className="graph-panel">
                <div className="graph-panel__header">
                  <div><h3>Elemento visual da questao</h3><p>{activeQuestion.graphCaption}</p></div>
                  <button type="button" className="icon-button" onClick={() => setZoomedGraph(activeQuestion.graphKey!)}><Expand size={16} />Ampliar</button>
                </div>
                <GraphFigure graphKey={activeQuestion.graphKey} />
              </aside>
            ) : null}
          </div>

          <section className="answer-panel">
            <div className="answer-panel__header">
              <div>
                <h3>Resposta oficial</h3>
                <p>O sistema apenas registra sua resposta agora. A correcao aparece somente no relatorio final.</p>
              </div>
            </div>
            {activeQuestion.answerSchema.kind === 'matrix' ? (
              <MatrixResponse question={activeQuestion} draft={activeDraft} onChange={(rowKey, columnKey, value) => updateQuestionDraft(activeQuestion.id, (draft) => ({ ...draft, matrixAnswers: { ...draft.matrixAnswers, [rowKey]: { ...(draft.matrixAnswers[rowKey] || {}), [columnKey]: value } } }))} />
            ) : (
              <FieldResponse question={activeQuestion} draft={activeDraft} onAnswerChange={(fieldKey, value) => updateQuestionDraft(activeQuestion.id, (draft) => ({ ...draft, answers: { ...draft.answers, [fieldKey]: value } }))} />
            )}
          </section>

          <section className="scratch-panel">
            <div className="scratch-panel__header">
              <div>
                <h3>Rascunho da questao</h3>
                <p>Espaco livre para conta, estrategia, testes e leitura do grafico sem receber pistas do sistema.</p>
              </div>
              <PenTool size={18} />
            </div>
            <textarea rows={8} value={activeDraft.scratch} onChange={(event) => updateQuestionDraft(activeQuestion.id, (draft) => ({ ...draft, scratch: event.target.value }))} placeholder="Use este campo para escrever contas, valores de teste, observacoes e caminho de resolucao." />
          </section>
        </section>
      </main>
    </div>
  ) : null;
  const resultsView = report ? (
    <main className="results-shell">
      <section className="results-summary">
        <div className="results-summary__headline">
          <div>
            <span className="hero__eyebrow hero__eyebrow--dark">Relatorio final</span>
            <h2>Painel completo de desempenho</h2>
            <p>{report.summary.correctCount} corretas, {report.summary.partialCount} parciais, {report.summary.incorrectCount} incorretas e {(report.summary.performanceRatio * 100).toFixed(0)}% de aproveitamento.</p>
          </div>
          <div className="results-actions">
            <button type="button" className="ghost-button" onClick={() => setScreen('dashboard')}><House size={16} />Voltar para a lista</button>
            {features.exportPdf ? (
              <button type="button" className="primary-button" onClick={() => void handleExportReport()} disabled={aiStatus === 'loading' || !aiFeedback}>
                <FileDown size={16} />{exportStatus === 'exporting' ? 'Preparando PDF...' : 'Exportar relatorio em PDF'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="summary-grid">
          <article className="summary-card"><span>Total de questoes</span><strong>{report.summary.totalQuestions}</strong></article>
          <article className="summary-card"><span>Respondidas</span><strong>{report.summary.answeredCount}</strong></article>
          <article className="summary-card"><span>Corretas</span><strong>{report.summary.correctCount}</strong></article>
          <article className="summary-card"><span>Tempo total</span><strong>{timeHighlights?.totalTimeLabel || '--'}</strong></article>
          <article className="summary-card"><span>Tempo medio por questao</span><strong>{timeHighlights?.averageTimeLabel || '--'}</strong></article>
          <article className="summary-card"><span>Finalizada em</span><strong>{formatReportDateTime(report.summary.completedAt || report.summary.generatedAt)}</strong></article>
        </div>
      </section>

      <section className="results-slowest">
        <div className="section-heading">
          <div>
            <h3>Tempo e navegacao</h3>
            <p>Veja onde houve mais esforco de leitura, conta ou interpretacao antes de montar o proximo estudo.</p>
          </div>
        </div>
        <div className="results-slowest__grid">
          <article className="dashboard-note">
            <span className="question-card__eyebrow">Questao mais demorada</span>
            <h3>{timeHighlights?.slowestQuestionLabel || 'Nao registrado'}</h3>
            <p>Questoes mais demoradas costumam apontar onde o raciocinio travou ou exigiu mais etapas de conta.</p>
          </article>
          <article className="dashboard-note">
            <span className="question-card__eyebrow">Assunto mais lento</span>
            <h3>{timeHighlights?.slowestTopicLabel || 'Nao registrado'}</h3>
            <p>O tempo por assunto ajuda a separar dificuldade conceitual de simples oscilacao de atencao.</p>
          </article>
        </div>
        <div className="results-slowest__stack">
          {report.slowestQuestions.map((question) => (
            <article key={question.questionNumber} className="review-card review-card--weak">
              <div className="review-card__header">
                <div>
                  <span className="question-card__eyebrow">Questao {question.questionNumber}</span>
                  <h4>{question.title}</h4>
                </div>
                <span className="timer-pill"><Clock3 size={16} />{question.timeLabel}</span>
              </div>
              <div className="badge-row">{question.topics.map((topic) => <span key={topic} className="tag">{topic}</span>)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="topic-performance">
        <div className="section-heading">
          <div>
            <h3>Analise por assunto</h3>
            <p>O desempenho combina acerto, erro e tempo gasto para mostrar quais temas parecem dominados e quais pedem reforco.</p>
          </div>
        </div>
        <div className="topic-grid">
          {report.topics.map((topic) => (
            <article key={topic.topic} className={`topic-card topic-card--${gradeTone(topic.performanceRatio)}`}>
              <header><span>{topic.label}</span><strong>{(topic.performanceRatio * 100).toFixed(0)}%</strong></header>
              <p>{TOPIC_META[topic.topic].summary}</p>
              <div className="topic-bar"><span style={{ width: `${Math.max(8, topic.performanceRatio * 100)}%` }} /></div>
              <small>{topic.correctCount} acertos · {topic.partialCount} parciais · {topic.incorrectCount} erros · {formatDurationLong(topic.totalTimeMs)}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="ai-feedback">
        <div className="section-heading">
          <div>
            <h3>Leitura pedagogica</h3>
            <p>{aiStatus === 'ready' ? 'Bloco gerado com apoio da IA do app.' : aiStatus === 'loading' ? 'Consultando a IA para sintetizar desempenho e gestao de tempo...' : 'Fallback local didatico montado com base no desempenho e no uso do tempo por questao.'}</p>
          </div>
        </div>
        {aiFeedback ? (
          <article className="coach-card">
            <div className="coach-card__top"><Sparkles size={18} /><p>{aiFeedback.overview}</p></div>
            <div className="coach-grid">
              <div><h4>Pontos fortes</h4><ul>{aiFeedback.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div><h4>Onde melhorar</h4><ul>{aiFeedback.focusAreas.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div><h4>Padroes de erro</h4><ul>{aiFeedback.errorPatterns.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div><h4>Gestao de tempo</h4><ul>{aiFeedback.timeInsights.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </div>
            <div className="coach-grid coach-grid--secondary">
              <div><h4>Plano de revisao</h4><ul>{aiFeedback.studyPlan.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div><h4>Assuntos dominados</h4><ul>{report.strongestTopics.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div><h4>Assuntos prioritarios</h4><ul>{report.weakestTopics.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </div>
            <p className="coach-card__encouragement">{aiFeedback.encouragement}</p>
          </article>
        ) : <div className="coach-loading"><CircleDashed className="spin" size={18} />Preparando feedback pedagogico...</div>}
      </section>

      <section className="results-list">
        <div className="section-heading">
          <div>
            <h3>Analise por questao</h3>
            <p>Cada bloco combina tempo gasto, resposta do aluno, resposta correta e explicacao da resolucao.</p>
          </div>
        </div>
        <div className="results-list__stack">
          {report.questions.map((question) => {
            const evaluation = evaluations.find((item) => item.questionId === question.questionId)!;
            const graphKey = activeQuestions.find((item) => item.id === question.questionId)?.graphKey;
            return (
              <article key={question.questionId} className={`review-card review-card--${gradeTone(evaluation.ratio)}`}>
                <div className="review-card__header">
                  <div>
                    <span className="question-card__eyebrow">Questao {question.questionNumber}</span>
                    <h4>{question.title}</h4>
                    <div className="badge-row">{question.topics.map((topic) => <span key={topic} className="tag">{topic}</span>)}</div>
                  </div>
                  <div className="review-card__status">
                    <ResultStatus evaluation={evaluation} />
                    <span className="timer-pill"><Clock3 size={16} />{question.timeLabel}</span>
                  </div>
                </div>

                <div className="review-card__meta">
                  <div><span>Resposta do aluno</span><strong>{question.studentAnswer}</strong></div>
                  <div><span>Resposta correta</span><strong>{question.correctAnswer}</strong></div>
                </div>

                {graphKey ? <div className="review-card__graph"><GraphFigure graphKey={graphKey} /></div> : null}

                <details className="review-card__details">
                  <summary>Ver resolucao e observacoes</summary>
                  <div className="review-card__body">
                    <div className="review-card__solution">
                      <h5>Passo a passo</h5>
                      <ul>{question.explanationSteps.map((step) => <li key={step}>{step}</li>)}</ul>
                      {question.graphComment ? <p>{question.graphComment}</p> : null}
                      <p className="review-card__tip"><strong>O que revisar:</strong> {question.studyTip}</p>
                      {question.scratchpad ? <div className="scratch-recall"><h6>Seu rascunho salvo</h6><p>{question.scratchpad}</p></div> : null}
                    </div>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  ) : null;

  return (
    <div className="app-shell">
      <div className="app-topbar">
        <div className="app-topbar__brand"><span>MINUTARE</span><strong>CTIA03 - Bases Matematicas</strong></div>
        <div className="app-topbar__actions">
          <button type="button" className={`topbar-link ${screen === 'dashboard' ? 'topbar-link--active' : ''}`} onClick={() => { timing.pause(); setScreen('dashboard'); }}><House size={16} />Painel de provas</button>
          <button type="button" className={`topbar-link ${screen !== 'dashboard' ? 'topbar-link--active' : ''}`} onClick={() => setScreen(finished ? 'results' : 'exam')}>
            {finished ? <BarChart3 size={16} /> : <ClipboardList size={16} />}
            {finished ? 'Relatorio final' : examStatus === 'in-progress' ? 'Continuar prova' : 'Abrir prova'}
          </button>
        </div>
      </div>

      {screen === 'dashboard' ? (
        <header className="hero hero--dashboard">
          <div className="hero__copy">
            <span className="hero__eyebrow">UFBA - Bases Matematicas - Avaliacoes</span>
            <h1>Modo prova controlado, com tempo total, tempo por questao e relatorio final exportavel.</h1>
            <p>A listagem segue modular, preparada para muitas provas e sem tocar na experiencia principal de estudo da plataforma.</p>
          </div>
          <div className="hero__stats">
            <div className="stat-card"><span>Provas ativas</span><strong>{examCards.length}</strong></div>
            <div className="stat-card"><span>Em andamento</span><strong>{examCards.filter((item) => item.status === 'in-progress').length}</strong></div>
            <div className="stat-card"><span>Concluidas</span><strong>{examCards.filter((item) => item.status === 'completed').length}</strong></div>
          </div>
        </header>
      ) : (
        <header className="hero">
          <div className="hero__copy">
            <span className="hero__eyebrow">{activeExam.subtitle} - {activeExam.title}</span>
            <h1>{screen === 'results' ? 'Relatorio final com desempenho, tempo e leitura pedagogica.' : 'Resolva a prova sem ajuda durante o percurso e receba a analise completa no final.'}</h1>
            <p>{screen === 'results' ? 'O relatorio combina acertos, erros, tempo por questao, analise por assunto e leitura pedagogica para orientar os proximos estudos.' : 'Cada questao tem enunciado estruturado, grafico responsivo, resposta oficial e rascunho. O sistema registra o tempo, mas so corrige ao finalizar.'}</p>
          </div>
          <div className="hero__stats">
            <div className="stat-card"><span>Respondidas</span><strong>{answeredCount}/{activeQuestions.length}</strong></div>
            <div className="stat-card"><span>Tempo total</span><strong>{features.showTotalTimer ? formatDuration(timing.totalElapsedMs) : '--:--'}</strong></div>
            <div className="stat-card"><span>Para revisar</span><strong>{reviewCount}</strong></div>
          </div>
        </header>
      )}

      {screen === 'dashboard' ? dashboardView : screen === 'results' ? resultsView : examView}

      {screen === 'exam' && activeQuestion ? (
        <section className="floating-actions">
          <div className="question-actions">
            <div className="question-actions__left">
              <button type="button" className="ghost-button" onClick={() => goToQuestion(activeIndex - 1)} disabled={activeIndex <= 0}><ChevronLeft size={16} />Anterior</button>
              <button type="button" className="ghost-button" onClick={() => goToQuestion(activeIndex + 1)} disabled={activeIndex === activeQuestions.length - 1}>Proxima<ChevronRight size={16} /></button>
            </div>
            <div className="question-actions__right">
              <button type="button" className={`ghost-button ${activeDraft.flagged ? 'ghost-button--flagged' : ''}`} onClick={() => updateQuestionDraft(activeQuestion.id, (draft) => ({ ...draft, flagged: !draft.flagged }))}><Flag size={16} />{activeDraft.flagged ? 'Remover revisao' : 'Marcar para revisar'}</button>
              <button type="button" className="ghost-button" onClick={() => updateQuestionDraft(activeQuestion.id, () => createEmptyDraft())}>Limpar questao</button>
              <button type="button" className="primary-button" onClick={handleSave}><Save size={16} />Salvar progresso</button>
              <button type="button" className="primary-button primary-button--finish" onClick={handleFinish}><GraduationCap size={18} />Finalizar prova</button>
            </div>
          </div>
          <div className="question-footer">
            <span>Estado atual: <strong>{progressLabel(activeQuestionProgress)}</strong></span>
            <span>{saveStatus === 'saving' ? 'Sincronizando progresso...' : saveStatus === 'saved' ? 'Progresso salvo localmente e sincronizado com o servidor.' : saveStatus === 'local-only' ? 'Progresso salvo localmente. A sincronizacao remota falhou.' : 'Modo prova: apoio e correcao sao liberados apenas no relatorio final.'}</span>
          </div>
        </section>
      ) : null}

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











