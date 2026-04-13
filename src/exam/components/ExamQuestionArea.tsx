import { Clock3, Expand, Flag } from 'lucide-react';
import { ContentRenderer } from '../content';
import type { QuestionDraft, ToggleAnswer } from '../grading';
import type { ExamQuestion } from '../model';
import { GraphFigure } from '../graphs';
import { formatDuration } from '../timing';
import { ExamAnswerArea } from './ExamAnswerArea';
import { ExamScratchpad } from './ExamScratchpad';

type QuestionProgress = 'unanswered' | 'in-progress' | 'answered' | 'review';

interface ExamQuestionAreaProps {
    question: ExamQuestion;
    draft: QuestionDraft;
    progress: QuestionProgress;
    questionTimeMs: number;
    totalQuestions: number;
    examSupportImageSrc?: string;
    examSupportImageAlt?: string;
    onAnswerChange: (fieldKey: string, value: string) => void;
    onMatrixChange: (rowKey: string, columnKey: string, value: ToggleAnswer) => void;
    onScratchChange: (value: string) => void;
    onToggleReview: () => void;
    onZoomGraph: (graphKey: ExamQuestion['graphKey']) => void;
    onOpenSupportImage: () => void;
}

function progressLabel(progress: QuestionProgress) {
    if (progress === 'answered') return 'Respondida';
    if (progress === 'in-progress') return 'Em andamento';
    if (progress === 'review') return 'Revisar';
    return 'Nao respondida';
}

function progressClass(progress: QuestionProgress) {
    if (progress === 'answered') return 'progress-pill progress-pill--answered';
    if (progress === 'review') return 'progress-pill progress-pill--review';
    if (progress === 'in-progress') return 'progress-pill progress-pill--in-progress';
    return 'progress-pill';
}

function difficultyLabel(value: ExamQuestion['difficulty']) {
    if (value === 'base') return 'Base';
    if (value === 'desafio') return 'Desafio';
    return 'Intermediaria';
}

export function ExamQuestionArea({
    question,
    draft,
    progress,
    questionTimeMs,
    totalQuestions,
    examSupportImageSrc,
    examSupportImageAlt,
    onAnswerChange,
    onMatrixChange,
    onScratchChange,
    onToggleReview,
    onZoomGraph,
    onOpenSupportImage,
}: ExamQuestionAreaProps) {
    return (
        <section className="question-card">
            <div className="question-card__top">
                <div>
                    <span className="question-card__eyebrow">Questao {question.number} de {totalQuestions}</span>
                    <h2>{question.title}</h2>
                    <p>Leia o enunciado com calma, registre a resposta oficial nos campos abaixo e mantenha o rascunho separado para organizar o raciocinio.</p>
                </div>
                <div className="question-card__top-actions">
                    <button
                        type="button"
                        className={`ghost-button ${draft.flagged ? 'ghost-button--flagged' : ''}`}
                        onClick={onToggleReview}
                    >
                        <Flag size={16} />
                        {draft.flagged ? 'Remover revisao' : 'Marcar para revisar'}
                    </button>
                </div>
            </div>

            <div className="question-card__status-strip">
                <span className={progressClass(progress)}>{progressLabel(progress)}</span>
                <span className="timer-pill">
                    <Clock3 size={16} />
                    Tempo na questao {formatDuration(questionTimeMs)}
                </span>
                <span className="support-chip">{difficultyLabel(question.difficulty)}</span>
            </div>

            <div className="badge-row badge-row--topics">
                {question.topics.map((topic) => (
                    <span key={topic} className="tag">
                        {topic}
                    </span>
                ))}
            </div>

            <div className="question-card__body">
                <div className={`question-card__context ${question.graphKey || examSupportImageSrc ? 'question-card__context--with-graph' : ''}`}>
                    <article className="statement-panel">
                        <div className="graph-panel__header">
                            <div>
                                <h3>Enunciado</h3>
                                <p>Use o texto abaixo como referencia principal e deixe o mapa lateral para navegacao, nao para leitura.</p>
                            </div>
                        </div>
                        <div className="content-stack">
                            <ContentRenderer blocks={question.prompt} />
                        </div>
                    </article>

                    {question.graphKey || examSupportImageSrc ? (
                        <article className="graph-panel">
                            <div className="graph-panel__header">
                                <div>
                                    <h3>Apoio visual</h3>
                                    <p>
                                        {question.graphKey
                                            ? question.graphCaption || 'Grafico de apoio para interpretar a questao.'
                                            : 'Imagem original da prova para referencia visual e conferencia do material importado.'}
                                    </p>
                                </div>
                                {question.graphKey ? (
                                    <button type="button" className="icon-button" onClick={() => onZoomGraph(question.graphKey)}>
                                        <Expand size={16} />
                                        Ampliar
                                    </button>
                                ) : null}
                            </div>
                            {question.graphKey ? <GraphFigure graphKey={question.graphKey} /> : null}
                            {examSupportImageSrc ? (
                                <div className="support-image-card">
                                    {!question.graphKey ? (
                                        <img className="support-image-card__thumb" src={examSupportImageSrc} alt={examSupportImageAlt || 'Imagem original da prova'} />
                                    ) : null}
                                    <button type="button" className="ghost-button" onClick={onOpenSupportImage}>
                                        <Expand size={16} />
                                        Ver prova original
                                    </button>
                                </div>
                            ) : null}
                        </article>
                    ) : null}
                </div>

                <div className="question-card__response-grid">
                    <article className="answer-panel">
                        <div className="answer-panel__header">
                            <div>
                                <h3>Resposta oficial</h3>
                                <p>{question.answerSchema.kind === 'matrix' ? question.answerSchema.instructions : question.answerSchema.instructions || 'Registre somente a resposta final pedida em cada campo.'}</p>
                            </div>
                        </div>
                        <ExamAnswerArea question={question} draft={draft} onAnswerChange={onAnswerChange} onMatrixChange={onMatrixChange} />
                    </article>

                    <article className="scratch-panel">
                        <div className="scratch-panel__header">
                            <h3>Rascunho e checkpoints</h3>
                            <p>Este espaco nao altera a correcao. Use para organizar conta, estrategia e duvidas antes de finalizar.</p>
                        </div>
                        <ExamScratchpad value={draft.scratch} onChange={onScratchChange} />
                    </article>
                </div>
            </div>
        </section>
    );
}
