import { startTransition, useEffect, useMemo, useState } from 'react';
import {
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    CircleDashed,
    ClipboardList,
    Clock3,
    Expand,
    Flag,
    GraduationCap,
    House,
    MessageCircleMore,
    PenTool,
    Save,
    Sparkles,
    Target,
    XCircle,
} from 'lucide-react';
import { ContentRenderer, MathText } from './exam/content';
import { EXAM_QUESTIONS } from './exam/data';
import { buildLocalPedagogicalFeedback, type PedagogicalFeedback } from './exam/feedback';
import { GraphFigure } from './exam/graphs';
import { EXAM_LIBRARY, LISTA1_EXAM } from './exam/library';
import {
    buildTopicPerformance,
    createEmptyDraft,
    ensureDraft,
    evaluateQuestion,
    getQuestionProgress,
    type ExamDraftState,
    type QuestionDraft,
    type ToggleAnswer,
} from './exam/grading';
import { TOPIC_META, type ContentBlock, type ExamQuestion, type GraphKey, type TopicId } from './exam/model';
import { TutorPanel, type TutorQuickAction } from './tutor';

const STORAGE_KEY = 'ctia03-lista1-interactive-exam-v1';
const SERVER_STATE_KEY = 'lista1InteractiveExam';

type PersistedState = {
    version: 1;
    updatedAt: string;
    activeQuestionId: string;
    finished: boolean;
    drafts: ExamDraftState;
};

type AppScreen = 'dashboard' | 'exam' | 'results';
type ExamCardStatus = 'not-started' | 'in-progress' | 'completed';

function buildEmptyDrafts(): ExamDraftState {
    return Object.fromEntries(EXAM_QUESTIONS.map((question) => [question.id, createEmptyDraft()]));
}

function mergeDrafts(base: ExamDraftState, incoming?: ExamDraftState | null): ExamDraftState {
    const merged = { ...base };
    if (!incoming) return merged;
    for (const question of EXAM_QUESTIONS) merged[question.id] = ensureDraft(incoming[question.id]);
    return merged;
}

function parsePersistedState(value: unknown): PersistedState | null {
    if (!value || typeof value !== 'object') return null;
    const data = value as Partial<PersistedState>;
    if (!data.updatedAt || !data.activeQuestionId || !data.drafts) return null;
    return {
        version: 1,
        updatedAt: data.updatedAt,
        activeQuestionId: data.activeQuestionId,
        finished: Boolean(data.finished),
        drafts: data.drafts as ExamDraftState,
    };
}

function readLocalState(): PersistedState | null {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? parsePersistedState(JSON.parse(raw)) : null;
    } catch {
        return null;
    }
}

function buildPersistedState(activeQuestionId: string, finished: boolean, drafts: ExamDraftState): PersistedState {
    return { version: 1, updatedAt: new Date().toISOString(), activeQuestionId, finished, drafts };
}

function examStatusLabel(status: ExamCardStatus) {
    return status === 'completed' ? 'Concluida' : status === 'in-progress' ? 'Em andamento' : 'Nao iniciada';
}

function progressLabel(progress: ReturnType<typeof getQuestionProgress>) {
    return progress === 'answered' ? 'Respondida' : progress === 'in-progress' ? 'Em andamento' : progress === 'review' ? 'Revisar' : 'Nao respondida';
}

function difficultyLabel(level: ExamQuestion['difficulty']) {
    return level === 'desafio' ? 'Desafio' : level === 'intermediario' ? 'Intermediario' : 'Base';
}

function gradeTone(ratio: number) {
    return ratio >= 0.999 ? 'strong' : ratio > 0 ? 'partial' : 'weak';
}

function contentBlocksToPlainText(blocks: ContentBlock[]) {
    return blocks
        .map((block) => (block.type === 'bullets' ? block.items.map((item) => `- ${item}`).join('\n') : block.text))
        .join('\n')
        .trim();
}

function truncateText(text: string, maxLength: number) {
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function summarizeDraftForTutor(question: ExamQuestion, draft: QuestionDraft) {
    const items: string[] = [];
    if (question.answerSchema.kind === 'groups') {
        for (const group of question.answerSchema.groups) {
            for (const field of group.fields) {
                const value = draft.answers[field.key]?.trim();
                if (value) items.push(`${field.label}: ${value}`);
                if (items.length >= 6) return items.join(' | ');
            }
        }
        return items.join(' | ');
    }
    for (const row of question.answerSchema.rows) {
        for (const column of question.answerSchema.columns) {
            const value = draft.matrixAnswers[row.key]?.[column.key];
            if (value) items.push(`${row.label} x ${column.label}: ${value}`);
            if (items.length >= 6) return items.join(' | ');
        }
    }
    return items.join(' | ');
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
                    {schema.columns.map((column) => <div key={column.key} className="matrix-cell matrix-cell--head"><MathText text={column.label} /></div>)}
                </div>
                {schema.rows.map((row) => (
                    <div key={row.key} className="matrix-row">
                        <div className="matrix-cell matrix-cell--label"><MathText text={row.label} /></div>
                        {schema.columns.map((column) => {
                            const current = draft.matrixAnswers[row.key]?.[column.key] || '';
                            return <div key={`${row.key}-${column.key}`} className="matrix-cell"><div className="toggle-set toggle-set--matrix"><button type="button" className={`toggle-chip ${current === 'sim' ? 'toggle-chip--active' : ''}`} onClick={() => onChange(row.key, column.key, 'sim')}>{schema.trueLabel}</button><button type="button" className={`toggle-chip toggle-chip--alt ${current === 'nao' ? 'toggle-chip--active-alt' : ''}`} onClick={() => onChange(row.key, column.key, 'nao')}>{schema.falseLabel}</button></div></div>;
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
                            const expectsBoolean =
                                field.input === 'toggle' &&
                                field.checker.type === 'exact' &&
                                ['v', 'f'].includes(field.checker.accepted[0].toLowerCase());
                            return (
                                <label key={field.key} className="field-card">
                                    <span className="field-card__label">{field.label}</span>
                                    {field.helpText ? <span className="field-card__help">{field.helpText}</span> : null}
                                    {field.input === 'textarea' ? (
                                        <textarea rows={field.rows || 4} value={value} placeholder={field.placeholder} onChange={(event) => onAnswerChange(field.key, event.target.value)} />
                                    ) : field.input === 'toggle' ? (
                                        <div className="toggle-set">
                                            <button type="button" className={`toggle-chip ${value === (expectsBoolean ? 'V' : 'sim') ? 'toggle-chip--active' : ''}`} onClick={() => onAnswerChange(field.key, expectsBoolean ? 'V' : 'sim')}>
                                                {expectsBoolean ? 'V' : 'Sim'}
                                            </button>
                                            <button type="button" className={`toggle-chip toggle-chip--alt ${value === (expectsBoolean ? 'F' : 'nao') ? 'toggle-chip--active-alt' : ''}`} onClick={() => onAnswerChange(field.key, expectsBoolean ? 'F' : 'nao')}>
                                                {expectsBoolean ? 'F' : 'Nao'}
                                            </button>
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

function ResultStatus({ ratio, answered }: { ratio: number; answered: boolean }) {
    if (!answered) return <span className="result-pill result-pill--blank"><CircleDashed size={16} />Em branco</span>;
    if (ratio >= 0.999) return <span className="result-pill result-pill--correct"><CheckCircle2 size={16} />Acertou</span>;
    if (ratio > 0) return <span className="result-pill result-pill--partial"><Target size={16} />Parcial</span>;
    return <span className="result-pill result-pill--incorrect"><XCircle size={16} />Errou</span>;
}

export default function App() {
    const emptyDrafts = useMemo(() => buildEmptyDrafts(), []);
    const topicLabels = useMemo(
        () => Object.fromEntries(Object.entries(TOPIC_META).map(([key, value]) => [key, value.label])) as Record<TopicId, string>,
        [],
    );
    const [drafts, setDrafts] = useState<ExamDraftState>(emptyDrafts);
    const [screen, setScreen] = useState<AppScreen>('dashboard');
    const [activeQuestionId, setActiveQuestionId] = useState(EXAM_QUESTIONS[0].id);
    const [finished, setFinished] = useState(false);
    const [loading, setLoading] = useState(true);
    const [serverState, setServerState] = useState<Record<string, unknown>>({});
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'local-only'>('idle');
    const [zoomedGraph, setZoomedGraph] = useState<GraphKey | null>(null);
    const [aiFeedback, setAiFeedback] = useState<PedagogicalFeedback | null>(null);
    const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
    const [tutorOpenRequest, setTutorOpenRequest] = useState(0);

    useEffect(() => {
        const local = readLocalState();
        async function loadState() {
            try {
                const response = await fetch('/api/state');
                if (!response.ok) throw new Error('state unavailable');
                const payload = await response.json();
                const state = (payload?.state || {}) as Record<string, unknown>;
                setServerState(state);
                const remote = parsePersistedState(state[SERVER_STATE_KEY]);
                const best =
                    local && remote
                        ? new Date(local.updatedAt).getTime() >= new Date(remote.updatedAt).getTime()
                            ? local
                            : remote
                        : local || remote;
                if (best) {
                    setDrafts(mergeDrafts(emptyDrafts, best.drafts));
                    setActiveQuestionId(best.activeQuestionId);
                    setFinished(best.finished);
                } else {
                    setDrafts(emptyDrafts);
                }
            } catch {
                if (local) {
                    setDrafts(mergeDrafts(emptyDrafts, local.drafts));
                    setActiveQuestionId(local.activeQuestionId);
                    setFinished(local.finished);
                } else {
                    setDrafts(emptyDrafts);
                }
            } finally {
                setLoading(false);
            }
        }
        void loadState();
    }, [emptyDrafts]);

    const persistedState = useMemo(() => buildPersistedState(activeQuestionId, finished, drafts), [activeQuestionId, drafts, finished]);

    useEffect(() => {
        if (!loading) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
    }, [loading, persistedState]);

    useEffect(() => {
        if (saveStatus === 'idle') return;
        const timeout = window.setTimeout(() => setSaveStatus('idle'), 2200);
        return () => window.clearTimeout(timeout);
    }, [saveStatus]);

    const evaluations = useMemo(() => EXAM_QUESTIONS.map((question) => evaluateQuestion(question, drafts[question.id])), [drafts]);
    const topicPerformance = useMemo(() => buildTopicPerformance(EXAM_QUESTIONS, evaluations, topicLabels), [evaluations, topicLabels]);
    const answeredCount = evaluations.filter((item) => item.answered).length;
    const correctCount = evaluations.filter((item) => item.ratio >= 0.999).length;
    const incorrectCount = evaluations.filter((item) => item.answered && item.ratio < 0.999).length;
    const overallScore = evaluations.reduce((sum, item) => sum + item.score, 0);
    const overallMax = evaluations.reduce((sum, item) => sum + item.maxScore, 0);
    const overallRatio = overallMax ? overallScore / overallMax : 0;
    const weakestTopic = [...topicPerformance].sort((left, right) => left.ratio - right.ratio)[0];
    const strongestTopic = topicPerformance[0];
    const progressByQuestion = useMemo(
        () => Object.fromEntries(EXAM_QUESTIONS.map((question) => [question.id, getQuestionProgress(question, drafts[question.id])])),
        [drafts],
    ) as Record<string, ReturnType<typeof getQuestionProgress>>;
    const reviewCount = Object.values(progressByQuestion).filter((status) => status === 'review').length;
    const inProgressCount = Object.values(progressByQuestion).filter((status) => status === 'in-progress').length;
    const examStatus: ExamCardStatus = finished ? 'completed' : answeredCount || inProgressCount || reviewCount ? 'in-progress' : 'not-started';

    useEffect(() => {
        if (!finished) {
            setAiStatus('idle');
            setAiFeedback(null);
            return;
        }
        const fallback = buildLocalPedagogicalFeedback({ questions: EXAM_QUESTIONS, evaluations, topicPerformance });
        let cancelled = false;
        async function loadFeedback() {
            setAiStatus('loading');
            try {
                const response = await fetch('/api/exam/pedagogical-feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        summary: { totalQuestions: EXAM_QUESTIONS.length, correctCount, incorrectCount, answeredCount, performanceRatio: overallRatio },
                        topicPerformance,
                        wrongQuestions: evaluations
                            .filter((item) => item.ratio < 0.999)
                            .map((item) => {
                                const question = EXAM_QUESTIONS.find((entry) => entry.id === item.questionId)!;
                                return {
                                    number: question.number,
                                    title: question.title,
                                    topics: question.topics.map((topic) => TOPIC_META[topic].label),
                                    studyTip: question.solution.studyTip,
                                    answerSummary: question.solution.answerSummary,
                                };
                            }),
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
    }, [answeredCount, correctCount, evaluations, finished, incorrectCount, overallRatio, topicPerformance]);

    const activeIndex = EXAM_QUESTIONS.findIndex((question) => question.id === activeQuestionId);
    const activeQuestion = EXAM_QUESTIONS[activeIndex] || EXAM_QUESTIONS[0];
    const activeDraft = ensureDraft(drafts[activeQuestion.id]);
    const activeEvaluation = evaluations.find((item) => item.questionId === activeQuestion.id);
    const activeQuestionPrompt = useMemo(() => contentBlocksToPlainText(activeQuestion.prompt), [activeQuestion.prompt]);
    const activeTutorContext = useMemo(
        () =>
            truncateText(
                [
                    `Voce esta ajudando um aluno na prova "${LISTA1_EXAM.subtitle} - ${LISTA1_EXAM.title}".`,
                    `Questao atual: ${activeQuestion.number} - ${activeQuestion.title}.`,
                    `Assuntos: ${activeQuestion.topics.map((topic) => TOPIC_META[topic].label).join(', ')}.`,
                    `Enunciado da questao: ${activeQuestionPrompt}.`,
                    activeQuestion.graphCaption ? `Elemento visual da questao: ${activeQuestion.graphCaption}.` : '',
                    summarizeDraftForTutor(activeQuestion, activeDraft) ? `Resposta oficial digitada ate agora: ${summarizeDraftForTutor(activeQuestion, activeDraft)}.` : '',
                    activeDraft.scratch.trim() ? `Rascunho atual do aluno: ${truncateText(activeDraft.scratch.trim(), 420)}.` : '',
                    'Responda em portugues do Brasil com blocos curtos e orientacao pedagogica antes do resultado final.',
                ]
                    .filter(Boolean)
                    .join('\n'),
                2200,
            ),
        [activeDraft, activeQuestion, activeQuestionPrompt],
    );
    const resultsTutorContext = useMemo(
        () =>
            truncateText(
                [
                    `Voce esta analisando a correcao final da prova "${LISTA1_EXAM.subtitle} - ${LISTA1_EXAM.title}".`,
                    `O aluno acertou ${correctCount} questoes, errou total ou parcialmente ${incorrectCount} e tem ${(overallRatio * 100).toFixed(0)}% de aproveitamento.`,
                    strongestTopic ? `Assunto mais forte: ${strongestTopic.label}.` : '',
                    weakestTopic ? `Assunto com mais necessidade de revisao: ${weakestTopic.label}.` : '',
                    'Explique padroes de erro, proximos passos e sugestoes de estudo objetivas.',
                ]
                    .filter(Boolean)
                    .join('\n'),
                1600,
            ),
        [correctCount, incorrectCount, overallRatio, strongestTopic, weakestTopic],
    );
    const dashboardTutorContext = useMemo(
        () =>
            truncateText(
                [
                    `Voce esta no painel principal do aluno para a prova "${LISTA1_EXAM.subtitle} - ${LISTA1_EXAM.title}".`,
                    `A prova tem ${LISTA1_EXAM.questionCount} questoes e trabalha: ${LISTA1_EXAM.topics.map((topic) => TOPIC_META[topic].label).join(', ')}.`,
                    `Status atual: ${examStatusLabel(examStatus)}. Respondidas: ${answeredCount}. Marcadas para revisao: ${reviewCount}.`,
                    'Ajude o aluno a planejar o estudo, decidir por onde comecar e entender como usar tutor, rascunho e resposta oficial.',
                ].join('\n'),
                1600,
            ),
        [answeredCount, examStatus, reviewCount],
    );
    const tutorContextLabel = screen === 'dashboard' ? 'Painel principal' : screen === 'results' ? 'Correcao final da prova' : `Questao ${activeQuestion.number}`;
    const tutorContextSummary =
        screen === 'dashboard'
            ? 'Ajuda rapida para escolher a prova e planejar a resolucao.'
            : screen === 'results'
                ? 'Use o tutor para transformar o resultado em plano de estudo.'
                : 'Tire duvidas sobre a questao atual sem travar a tela.';
    const tutorContextPrompt = screen === 'dashboard' ? dashboardTutorContext : screen === 'results' ? resultsTutorContext : activeTutorContext;
    const tutorQuickActions = useMemo<TutorQuickAction[]>(
        () =>
            screen === 'dashboard'
                ? [
                      { id: 'dashboard-plan', label: 'Como comecar', description: 'Peca um plano curto para entrar na prova com estrategia.', prompt: 'Monte um plano curto para eu comecar esta prova sem me perder.', tone: 'primary' },
                      { id: 'dashboard-topics', label: 'Assuntos-chave', description: 'Descubra os temas que merecem mais atencao antes de resolver.', prompt: 'Quais assuntos desta prova eu devo revisar primeiro antes de responder?', tone: 'secondary' },
                      { id: 'dashboard-usage', label: 'Como usar a prova', description: 'Entenda como aproveitar rascunho, resposta oficial e revisao.', prompt: 'Explique como usar bem o rascunho, a resposta oficial e a marcacao para revisar.', tone: 'ghost' },
                  ]
                : screen === 'results'
                    ? [
                          { id: 'results-errors', label: 'Ler meus erros', description: 'Peca uma leitura didatica dos padroes de erro.', prompt: 'Explique meus principais padroes de erro a partir desta correcao final.', tone: 'primary' },
                          { id: 'results-review', label: 'Plano de revisao', description: 'Monte os proximos estudos em uma ordem objetiva.', prompt: 'Monte um plano de revisao curto com ordem de estudo e prioridade.', tone: 'secondary' },
                          { id: 'results-confidence', label: 'Ganhar confianca', description: 'Descubra como revisar sem ficar preso so no gabarito.', prompt: 'Como eu posso revisar esta prova e ganhar confianca sem decorar respostas?', tone: 'ghost' },
                      ]
                    : [
                          { id: 'question-explain', label: 'Explicar questao', description: 'Receba uma explicacao simples antes da conta.', prompt: 'Explique a questao atual de forma simples e sem entregar a resposta completa de imediato.', tone: 'primary' },
                          { id: 'question-step', label: 'Passo a passo', description: 'Monte uma sequencia curta de passos para eu tentar sozinho.', prompt: 'Monte um passo a passo curto para eu resolver a questao atual sozinho.', tone: 'secondary' },
                          { id: 'question-graph', label: activeQuestion.graphKey ? 'Ler o grafico' : 'O que observar', description: activeQuestion.graphKey ? 'Peca ajuda para interpretar o elemento visual da questao.' : 'Descubra por onde comecar e o que observar primeiro.', prompt: activeQuestion.graphKey ? 'Explique como interpretar o grafico desta questao antes de resolver.' : 'Aponte o que eu devo observar primeiro para resolver a questao atual.', tone: 'ghost' },
                      ],
        [activeQuestion.graphKey, screen],
    );

    function updateQuestionDraft(questionId: string, updater: (draft: QuestionDraft) => QuestionDraft) {
        setDrafts((current) => ({ ...current, [questionId]: updater(ensureDraft(current[questionId])) }));
    }

    function handleSave() {
        setSaveStatus('saving');
        const nextServerState = { ...serverState, [SERVER_STATE_KEY]: persistedState };
        fetch('/api/state', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: nextServerState }),
        })
            .then(async (response) => {
                if (!response.ok) throw new Error('save failed');
                const payload = await response.json();
                setServerState((payload?.state || nextServerState) as Record<string, unknown>);
                setSaveStatus('saved');
            })
            .catch(() => setSaveStatus('local-only'));
    }

    function goToQuestion(nextIndex: number) {
        const safeIndex = Math.max(0, Math.min(EXAM_QUESTIONS.length - 1, nextIndex));
        startTransition(() => setActiveQuestionId(EXAM_QUESTIONS[safeIndex].id));
    }

    function openExamView() {
        setScreen(finished ? 'results' : 'exam');
    }

    function reopenExamQuestions() {
        setFinished(false);
        setScreen('exam');
    }

    if (loading) return <div className="loading-shell"><CircleDashed className="spin" size={22} /><span>Preparando a experiencia interativa da prova...</span></div>;

    const dashboardView = (
        <main className="dashboard-shell">
            <section className="dashboard-section">
                <div className="section-heading"><div><h3>Simulados e provas</h3><p>As avaliacoes cadastradas aparecem aqui com status real de progresso, assunto e atalho direto para entrar na resolucao.</p></div></div>
                <div className="exam-library">
                    {EXAM_LIBRARY.map((exam) => {
                        const cardStatus = exam.id === LISTA1_EXAM.id ? examStatus : 'not-started';
                        return (
                            <article key={exam.id} className="exam-library-card">
                                <div className="exam-library-card__header">
                                    <div>
                                        <span className="question-card__eyebrow">{exam.category}</span>
                                        <h3>{exam.subtitle} - {exam.title}</h3>
                                        <p>{exam.description}</p>
                                    </div>
                                    <span className={`exam-status-pill exam-status-pill--${cardStatus}`}>{examStatusLabel(cardStatus)}</span>
                                </div>
                                <div className="badge-row">{exam.topics.slice(0, 6).map((topic) => <span key={topic} className="tag">{TOPIC_META[topic].short}</span>)}</div>
                                <div className="exam-library-card__meta">
                                    <div className="exam-library-card__meta-item"><ClipboardList size={16} /><div><strong>{exam.questionCount} questoes</strong><span>Resolucao por blocos individuais</span></div></div>
                                    <div className="exam-library-card__meta-item"><Clock3 size={16} /><div><strong>{exam.estimatedMinutes} min</strong><span>Tempo sugerido para prova completa</span></div></div>
                                    <div className="exam-library-card__meta-item"><GraduationCap size={16} /><div><strong>{answeredCount} respondidas</strong><span>{reviewCount} marcadas para revisar</span></div></div>
                                </div>
                                <div className="exam-library-card__actions">
                                    {cardStatus === 'completed' ? (
                                        <>
                                            <button type="button" className="primary-button" onClick={() => setScreen('results')}>Ver correcao</button>
                                            <button type="button" className="ghost-button" onClick={reopenExamQuestions}>Reabrir questoes</button>
                                        </>
                                    ) : (
                                        <>
                                            <button type="button" className="primary-button" onClick={openExamView}>{cardStatus === 'in-progress' ? 'Continuar prova' : 'Iniciar prova'}</button>
                                            <button type="button" className="ghost-button" onClick={() => setTutorOpenRequest((value) => value + 1)}>Abrir tutor</button>
                                        </>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>
            <section className="dashboard-grid">
                <article className="dashboard-note"><span className="question-card__eyebrow">Status atual</span><h3>Como a prova esta neste momento</h3><p>Status: <strong>{examStatusLabel(examStatus)}</strong>. Voce ja respondeu {answeredCount} questoes, tem {inProgressCount} em andamento e {reviewCount} marcadas para revisar.</p></article>
                <article className="dashboard-note"><span className="question-card__eyebrow">Tutor IA</span><h3>Ajuda sem areas mortas de clique</h3><p>O tutor abre como painel proprio, com input fixo, acoes rapidas clicaveis, envio real e funcionamento em desktop e mobile.</p></article>
            </section>
        </main>
    );

    const examView = (
        <div className="workspace">
            <aside className="question-rail">
                <div className="question-rail__header"><h2>Questoes</h2><p>Desktop e mobile com status visiveis por numero.</p></div>
                <div className="question-rail__list">
                    {EXAM_QUESTIONS.map((question, index) => {
                        const progress = progressByQuestion[question.id];
                        return <button key={question.id} type="button" className={`rail-item ${question.id === activeQuestionId ? 'rail-item--active' : ''} rail-item--${progress}`} onClick={() => goToQuestion(index)}><span className="rail-item__number">{question.number}</span><span className="rail-item__label">{progressLabel(progress)}</span></button>;
                    })}
                </div>
            </aside>
            <main className="question-stage">
                <section className="question-card">
                    <div className="question-card__top">
                        <div>
                            <span className="question-card__eyebrow">Questao {activeQuestion.number}</span>
                            <h2>{activeQuestion.title}</h2>
                            <div className="badge-row"><span className="badge">{difficultyLabel(activeQuestion.difficulty)}</span>{activeQuestion.topics.map((topic) => <span key={topic} className="tag">{TOPIC_META[topic].short}</span>)}</div>
                        </div>
                        <div className="question-card__top-actions">
                            {activeEvaluation ? <ResultStatus ratio={activeEvaluation.ratio} answered={activeEvaluation.answered} /> : null}
                            <button type="button" className="icon-button" onClick={() => setTutorOpenRequest((value) => value + 1)}><MessageCircleMore size={16} />Tutor</button>
                        </div>
                    </div>
                    <div className={`question-card__body ${activeQuestion.graphKey ? 'question-card__body--with-graph' : ''}`}>
                        <div className="statement-panel"><ContentRenderer blocks={activeQuestion.prompt} />{activeQuestion.hint ? <details className="hint-box"><summary>Dica opcional</summary><p>{activeQuestion.hint}</p></details> : null}</div>
                        {activeQuestion.graphKey ? <aside className="graph-panel"><div className="graph-panel__header"><div><h3>Elemento visual da questao</h3><p>{activeQuestion.graphCaption}</p></div><button type="button" className="icon-button" onClick={() => setZoomedGraph(activeQuestion.graphKey!)}><Expand size={16} />Ampliar</button></div><GraphFigure graphKey={activeQuestion.graphKey} /></aside> : null}
                    </div>
                    <section className="answer-panel"><div className="answer-panel__header"><div><h3>Resposta oficial</h3><p>Preencha o que vale para correcao. O rascunho fica logo abaixo.</p></div></div>{activeQuestion.answerSchema.kind === 'matrix' ? <MatrixResponse question={activeQuestion} draft={activeDraft} onChange={(rowKey, columnKey, value) => updateQuestionDraft(activeQuestion.id, (draft) => ({ ...draft, matrixAnswers: { ...draft.matrixAnswers, [rowKey]: { ...(draft.matrixAnswers[rowKey] || {}), [columnKey]: value } } }))} /> : <FieldResponse question={activeQuestion} draft={activeDraft} onAnswerChange={(fieldKey, value) => updateQuestionDraft(activeQuestion.id, (draft) => ({ ...draft, answers: { ...draft.answers, [fieldKey]: value } }))} />}</section>
                    <section className="scratch-panel"><div className="scratch-panel__header"><div><h3>Rascunho da questao</h3><p>Espaco livre para conta, esquema, teste de intervalos, justificativa e estrategia.</p></div><PenTool size={18} /></div><textarea rows={8} value={activeDraft.scratch} onChange={(event) => updateQuestionDraft(activeQuestion.id, (draft) => ({ ...draft, scratch: event.target.value }))} placeholder="Use este campo para desenhar o raciocinio em texto: contas, valores de teste, observacoes sobre o grafico, contraexemplos, etc." /></section>
                </section>
            </main>
        </div>
    );

    const resultsView = (
        <main className="results-shell">
            <section className="results-summary">
                <div className="results-summary__headline">
                    <div><span className="hero__eyebrow hero__eyebrow--dark">Correcao final</span><h2>Panorama completo do desempenho</h2><p>{correctCount} questoes totalmente corretas, {incorrectCount} com erro total ou parcial e {(overallRatio * 100).toFixed(0)}% de aproveitamento global.</p></div>
                    <button type="button" className="ghost-button" onClick={reopenExamQuestions}><ChevronLeft size={16} />Voltar para revisar</button>
                </div>
                <div className="summary-grid"><article className="summary-card"><span>Total de questoes</span><strong>{EXAM_QUESTIONS.length}</strong></article><article className="summary-card"><span>Acertos totais</span><strong>{correctCount}</strong></article><article className="summary-card"><span>Erros ou parciais</span><strong>{incorrectCount}</strong></article><article className="summary-card"><span>Assunto mais forte</span><strong>{strongestTopic?.label || 'Aguardando'}</strong></article><article className="summary-card"><span>Assunto que pede mais revisao</span><strong>{weakestTopic?.label || 'Aguardando'}</strong></article></div>
            </section>
            <section className="topic-performance"><div className="section-heading"><div><h3>Analise por assunto</h3><p>O aproveitamento considera pontuacao parcial por campo e distribui o peso pelas habilidades mapeadas em cada questao.</p></div></div><div className="topic-grid">{topicPerformance.map((topic) => <article key={topic.topic} className={`topic-card topic-card--${gradeTone(topic.ratio)}`}><header><span>{topic.label}</span><strong>{(topic.ratio * 100).toFixed(0)}%</strong></header><p>{TOPIC_META[topic.topic].summary}</p><div className="topic-bar"><span style={{ width: `${Math.max(8, topic.ratio * 100)}%` }} /></div><small>{TOPIC_META[topic.topic].studyTips[0]}</small></article>)}</div></section>
            <section className="ai-feedback"><div className="section-heading"><div><h3>Leitura pedagogica</h3><p>{aiStatus === 'ready' ? 'Bloco gerado com apoio da IA do app.' : aiStatus === 'loading' ? 'Consultando a IA para sintetizar seus padroes de erro...' : 'Fallback local didatico montado com base no desempenho por questao e por assunto.'}</p></div></div>{aiFeedback ? <article className="coach-card"><div className="coach-card__top"><Sparkles size={18} /><p>{aiFeedback.overview}</p></div><div className="coach-grid"><div><h4>Pontos fortes</h4><ul>{aiFeedback.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h4>Onde melhorar</h4><ul>{aiFeedback.focusAreas.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h4>Padroes de erro</h4><ul>{aiFeedback.errorPatterns.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h4>Plano de revisao</h4><ul>{aiFeedback.studyPlan.map((item) => <li key={item}>{item}</li>)}</ul></div></div><p className="coach-card__encouragement">{aiFeedback.encouragement}</p></article> : <div className="coach-loading"><CircleDashed className="spin" size={18} />Preparando feedback pedagogico...</div>}</section>
            <section className="results-list"><div className="section-heading"><div><h3>Resultado por questao</h3><p>Cada bloco mostra seu status, sua resposta registrada, o gabarito esperado e uma explicacao curta da resolucao.</p></div></div><div className="results-list__stack">{EXAM_QUESTIONS.map((question) => { const evaluation = evaluations.find((item) => item.questionId === question.id)!; const draft = ensureDraft(drafts[question.id]); return <article key={question.id} className={`review-card review-card--${gradeTone(evaluation.ratio)}`}><div className="review-card__header"><div><span className="question-card__eyebrow">Questao {question.number}</span><h4>{question.title}</h4><div className="badge-row">{question.topics.map((topic) => <span key={topic} className="tag">{TOPIC_META[topic].short}</span>)}</div></div><ResultStatus ratio={evaluation.ratio} answered={evaluation.answered} /></div>{question.graphKey ? <div className="review-card__graph"><GraphFigure graphKey={question.graphKey} /></div> : null}<div className="review-card__meta"><div><span>Sua pontuacao</span><strong>{evaluation.score.toFixed(1)} / {evaluation.maxScore}</strong></div><div><span>Resposta correta</span><strong>{question.solution.answerSummary}</strong></div></div><details className="review-card__details"><summary>Ver respostas e resolucao</summary><div className="review-card__body"><div className="review-card__answers">{evaluation.fields.map((field) => <div key={field.key} className="review-answer-row"><div><span>{field.label}</span><strong>{field.studentAnswer || 'Em branco'}</strong></div><div><span>Esperado</span><strong>{field.expectedAnswer}</strong></div></div>)}</div><div className="review-card__solution"><h5>Como resolver</h5><ul>{question.solution.steps.map((step) => <li key={step}>{step}</li>)}</ul>{question.solution.graphComment ? <p>{question.solution.graphComment}</p> : null}<p className="review-card__tip"><strong>O que revisar:</strong> {question.solution.studyTip}</p>{draft.scratch.trim() ? <div className="scratch-recall"><h6>Seu rascunho salvo</h6><p>{draft.scratch}</p></div> : null}</div></div></details></article>; })}</div></section>
        </main>
    );

    return (
        <div className="app-shell">
            <div className="app-topbar">
                <div className="app-topbar__brand"><span>MINUTARE</span><strong>CTIA03 - Bases Matematicas</strong></div>
                <div className="app-topbar__actions">
                    <button type="button" className={`topbar-link ${screen === 'dashboard' ? 'topbar-link--active' : ''}`} onClick={() => setScreen('dashboard')}><House size={16} />Painel</button>
                    <button type="button" className={`topbar-link ${screen !== 'dashboard' ? 'topbar-link--active' : ''}`} onClick={openExamView}><ClipboardList size={16} />{finished ? 'Correcao' : examStatus === 'in-progress' ? 'Continuar prova' : 'Abrir prova'}</button>
                    <button type="button" className="topbar-link topbar-link--accent" onClick={() => setTutorOpenRequest((value) => value + 1)}><MessageCircleMore size={16} />Tutor</button>
                </div>
            </div>
            {screen === 'dashboard' ? <header className="hero hero--dashboard"><div className="hero__copy"><span className="hero__eyebrow">UFBA - Bases Matematicas - Painel do aluno</span><h1>Simulados e provas em um painel claro, com acesso direto e tutor funcional.</h1><p>O aluno entra pelo painel principal, enxerga as provas cadastradas no sistema, acompanha status e segue para a resolucao completa com feedback no final.</p></div><div className="hero__stats"><div className="stat-card"><span>Provas disponiveis</span><strong>{EXAM_LIBRARY.length}</strong></div><div className="stat-card"><span>Em andamento</span><strong>{examStatus === 'in-progress' ? 1 : 0}</strong></div><div className="stat-card"><span>Concluidas</span><strong>{examStatus === 'completed' ? 1 : 0}</strong></div></div></header> : <header className="hero"><div className="hero__copy"><span className="hero__eyebrow">UFBA - Bases Matematicas - {LISTA1_EXAM.title}</span><h1>{screen === 'results' ? 'Correcao pedagogica por questao, com leitura por assunto e proximo passo.' : 'Prova interativa, questao por questao, com navegacao clara e tutor usavel.'}</h1><p>{screen === 'results' ? 'Veja acertos, erros, explicacoes e recomendacoes de estudo em um fluxo unico, sem voltar ao PDF bruto.' : 'Cada questao tem enunciado estruturado, rascunho, resposta oficial, graficos em SVG e suporte do tutor ao lado.'}</p><div className="hero__actions"><button type="button" className="ghost-button ghost-button--light" onClick={() => setScreen('dashboard')}><House size={16} />Painel principal</button><button type="button" className="ghost-button ghost-button--light" onClick={() => setTutorOpenRequest((value) => value + 1)}><MessageCircleMore size={16} />Abrir tutor</button></div></div><div className="hero__stats"><div className="stat-card"><span>Respondidas</span><strong>{answeredCount}/{EXAM_QUESTIONS.length}</strong></div><div className="stat-card"><span>Aproveitamento</span><strong>{(overallRatio * 100).toFixed(0)}%</strong></div><div className="stat-card"><span>Para revisar</span><strong>{reviewCount}</strong></div></div></header>}
            {screen === 'dashboard' ? dashboardView : screen === 'results' ? resultsView : examView}
            {screen === 'exam' ? <section className="floating-actions"><div className="question-actions"><div className="question-actions__left"><button type="button" className="ghost-button" onClick={() => goToQuestion(activeIndex - 1)} disabled={activeIndex === 0}><ChevronLeft size={16} />Anterior</button><button type="button" className="ghost-button" onClick={() => goToQuestion(activeIndex + 1)} disabled={activeIndex === EXAM_QUESTIONS.length - 1}>Proxima<ChevronRight size={16} /></button></div><div className="question-actions__right"><button type="button" className={`ghost-button ${activeDraft.flagged ? 'ghost-button--flagged' : ''}`} onClick={() => updateQuestionDraft(activeQuestion.id, (draft) => ({ ...draft, flagged: !draft.flagged }))}><Flag size={16} />{activeDraft.flagged ? 'Remover revisao' : 'Marcar para revisar'}</button><button type="button" className="ghost-button" onClick={() => updateQuestionDraft(activeQuestion.id, () => ({ ...createEmptyDraft() }))}>Limpar questao</button><button type="button" className="primary-button" onClick={handleSave}><Save size={16} />Salvar resposta</button><button type="button" className="primary-button primary-button--finish" onClick={() => { startTransition(() => setFinished(true)); setScreen('results'); handleSave(); }}><GraduationCap size={18} />Finalizar prova</button></div></div><div className="question-footer"><span>Estado atual: <strong>{progressLabel(progressByQuestion[activeQuestion.id])}</strong></span><span>{saveStatus === 'saving' ? 'Sincronizando...' : saveStatus === 'saved' ? 'Salvo localmente e sincronizado com o servidor.' : saveStatus === 'local-only' ? 'Salvo localmente. A sincronizacao remota falhou.' : 'Os rascunhos tambem ficam guardados localmente no navegador.'}</span></div></section> : null}
            {zoomedGraph ? <div className="graph-modal" role="dialog" aria-modal="true" onClick={() => setZoomedGraph(null)}><div className="graph-modal__content" onClick={(event) => event.stopPropagation()}><button type="button" className="graph-modal__close" onClick={() => setZoomedGraph(null)}>Fechar</button><GraphFigure graphKey={zoomedGraph} /></div></div> : null}
            <TutorPanel contextLabel={tutorContextLabel} contextSummary={tutorContextSummary} contextPrompt={tutorContextPrompt} quickActions={tutorQuickActions} openRequestToken={tutorOpenRequest} />
        </div>
    );
}
