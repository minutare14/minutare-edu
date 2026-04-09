import { BarChart3, CheckCircle2, CircleDashed, Clock3, FileDown, House, PlayCircle, Sparkles, Target, XCircle } from 'lucide-react';
import { GraphFigure } from '../graphs';
import type { QuestionEvaluation } from '../grading';
import type { GraphKey } from '../model';
import { formatDurationLong } from '../timing';
import { buildTimeHighlights, formatReportDateTime, type ExamReport } from '../report';

type AiDisplayStatus = 'idle' | 'loading' | 'ready' | 'fallback' | 'error';

interface AttemptHistoryItem {
    id: string;
    label: string;
    subtitle: string;
    active: boolean;
}

interface ExamReportViewProps {
    report: ExamReport;
    evaluations: QuestionEvaluation[];
    questionGraphKeys: Record<string, GraphKey | undefined>;
    aiStatus: AiDisplayStatus;
    exportStatus: 'idle' | 'exporting' | 'done' | 'error';
    canExportPdf: boolean;
    attempts: AttemptHistoryItem[];
    onSelectAttempt: (attemptId: string) => void;
    onBackDashboard: () => void;
    onExportPdf: () => void;
    onRetry: () => void;
}

function gradeTone(ratio: number) {
    if (ratio >= 0.999) return 'strong';
    if (ratio > 0) return 'partial';
    return 'weak';
}

function ResultStatus({ evaluation }: { evaluation: QuestionEvaluation }) {
    if (evaluation.status === 'blank') return <span className="result-pill result-pill--blank"><CircleDashed size={16} />Em branco</span>;
    if (evaluation.status === 'correct') return <span className="result-pill result-pill--correct"><CheckCircle2 size={16} />Acertou</span>;
    if (evaluation.status === 'partial') return <span className="result-pill result-pill--partial"><Target size={16} />Parcial</span>;
    return <span className="result-pill result-pill--incorrect"><XCircle size={16} />Errou</span>;
}

export function ExamReportView({
    report,
    evaluations,
    questionGraphKeys,
    aiStatus,
    exportStatus,
    canExportPdf,
    attempts,
    onSelectAttempt,
    onBackDashboard,
    onExportPdf,
    onRetry,
}: ExamReportViewProps) {
    const timeHighlights = buildTimeHighlights(report);

    return (
        <main className="results-shell">
            <section className="results-summary">
                <div className="results-summary__headline">
                    <div>
                        <span className="hero__eyebrow hero__eyebrow--dark">Relatorio final</span>
                        <h2>Painel completo de desempenho da tentativa {report.attemptNumber}</h2>
                        <p>{report.summary.correctCount} corretas, {report.summary.partialCount} parciais, {report.summary.incorrectCount} incorretas e {(report.summary.performanceRatio * 100).toFixed(0)}% de aproveitamento.</p>
                    </div>
                    <div className="results-actions">
                        <button type="button" className="ghost-button" onClick={onBackDashboard}><House size={16} />Voltar para a lista</button>
                        <button type="button" className="ghost-button" onClick={onRetry}><PlayCircle size={16} />Refazer prova</button>
                        {canExportPdf ? (
                            <button type="button" className="primary-button" onClick={onExportPdf} disabled={exportStatus === 'exporting' || aiStatus === 'loading'}>
                                <FileDown size={16} />{exportStatus === 'exporting' ? 'Gerando PDF...' : 'Exportar PDF'}
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className="summary-grid">
                    <article className="summary-card"><span>Tentativa</span><strong>{report.attemptNumber}</strong></article>
                    <article className="summary-card"><span>Total de questoes</span><strong>{report.summary.totalQuestions}</strong></article>
                    <article className="summary-card"><span>Respondidas</span><strong>{report.summary.answeredCount}</strong></article>
                    <article className="summary-card"><span>Tempo total</span><strong>{timeHighlights.totalTimeLabel}</strong></article>
                    <article className="summary-card"><span>Tempo medio por questao</span><strong>{timeHighlights.averageTimeLabel}</strong></article>
                    <article className="summary-card"><span>Finalizada em</span><strong>{formatReportDateTime(report.summary.completedAt || report.summary.generatedAt)}</strong></article>
                </div>
            </section>

            {attempts.length > 1 ? (
                <section className="topic-performance">
                    <div className="section-heading">
                        <div>
                            <h3>Historico de tentativas</h3>
                            <p>Use as tentativas salvas para revisar relatorios antigos sem perder a nova execucao da prova.</p>
                        </div>
                    </div>
                    <div className="attempt-history">
                        {attempts.map((attempt) => (
                            <button
                                key={attempt.id}
                                type="button"
                                className={`attempt-history__item ${attempt.active ? 'attempt-history__item--active' : ''}`}
                                onClick={() => onSelectAttempt(attempt.id)}
                            >
                                <strong>{attempt.label}</strong>
                                <span>{attempt.subtitle}</span>
                            </button>
                        ))}
                    </div>
                </section>
            ) : null}

            <section className="results-slowest">
                <div className="section-heading">
                    <div>
                        <h3>Tempo e navegacao</h3>
                        <p>Veja onde houve mais esforco de leitura, conta ou interpretacao antes de planejar a revisao.</p>
                    </div>
                </div>
                <div className="results-slowest__grid">
                    <article className="dashboard-note">
                        <span className="question-card__eyebrow">Questao mais demorada</span>
                        <h3>{timeHighlights.slowestQuestionLabel}</h3>
                        <p>Isso ajuda a encontrar onde o raciocinio travou ou exigiu mais etapas de conta.</p>
                    </article>
                    <article className="dashboard-note">
                        <span className="question-card__eyebrow">Assunto mais lento</span>
                        <h3>{timeHighlights.slowestTopicLabel}</h3>
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
                            <p>{topic.correctCount} acertos, {topic.partialCount} parciais, {topic.incorrectCount} erros e {formatDurationLong(topic.totalTimeMs)} dedicados a este bloco.</p>
                            <div className="topic-bar"><span style={{ width: `${Math.max(8, topic.performanceRatio * 100)}%` }} /></div>
                            <small>{topic.blankCount} em branco | {topic.totalQuestions} questoes</small>
                        </article>
                    ))}
                </div>
            </section>

            <section className="ai-feedback">
                <div className="section-heading">
                    <div>
                        <h3>Leitura pedagogica</h3>
                        <p>
                            {aiStatus === 'ready'
                                ? 'A analise da IA desta tentativa foi reutilizada do cache salvo.'
                                : aiStatus === 'loading'
                                  ? 'Gerando a leitura pedagogica desta tentativa uma unica vez.'
                                  : aiStatus === 'fallback'
                                    ? 'A leitura abaixo usa o fallback local persistido para esta tentativa.'
                                    : 'A leitura pedagogica desta tentativa ainda nao esta disponivel.'}
                        </p>
                    </div>
                </div>
                {report.aiFeedback ? (
                    <article className="coach-card">
                        <div className="coach-card__top"><Sparkles size={18} /><p>{report.aiFeedback.overview}</p></div>
                        <div className="coach-grid">
                            <div><h4>Pontos fortes</h4><ul>{report.aiFeedback.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div>
                            <div><h4>Onde melhorar</h4><ul>{report.aiFeedback.focusAreas.map((item) => <li key={item}>{item}</li>)}</ul></div>
                            <div><h4>Padroes de erro</h4><ul>{report.aiFeedback.errorPatterns.map((item) => <li key={item}>{item}</li>)}</ul></div>
                            <div><h4>Gestao de tempo</h4><ul>{report.aiFeedback.timeInsights.map((item) => <li key={item}>{item}</li>)}</ul></div>
                        </div>
                        <div className="coach-grid coach-grid--secondary">
                            <div><h4>Plano de revisao</h4><ul>{report.aiFeedback.studyPlan.map((item) => <li key={item}>{item}</li>)}</ul></div>
                            <div><h4>Assuntos dominados</h4><ul>{report.strongestTopics.map((item) => <li key={item}>{item}</li>)}</ul></div>
                            <div><h4>Assuntos prioritarios</h4><ul>{report.weakestTopics.map((item) => <li key={item}>{item}</li>)}</ul></div>
                        </div>
                        <p className="coach-card__encouragement">{report.aiFeedback.encouragement}</p>
                    </article>
                ) : <div className="coach-loading"><CircleDashed className="spin" size={18} />Preparando feedback pedagogico...</div>}
            </section>

            <section className="results-list">
                <div className="section-heading">
                    <div>
                        <h3>Analise por questao</h3>
                        <p>Cada bloco combina tempo gasto, resposta do aluno, gabarito, resolucao e rascunho salvo.</p>
                    </div>
                </div>
                <div className="results-list__stack">
                    {report.questions.map((question) => {
                        const evaluation = evaluations.find((item) => item.questionId === question.questionId)!;
                        const graphKey = questionGraphKeys[question.questionId];

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
    );
}
