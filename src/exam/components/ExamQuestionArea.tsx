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
    onAnswerChange: (fieldKey: string, value: string) => void;
    onMatrixChange: (rowKey: string, columnKey: string, value: ToggleAnswer) => void;
    onScratchChange: (value: string) => void;
    onToggleReview: () => void;
    onZoomGraph: (graphKey: ExamQuestion['graphKey']) => void;
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

export function ExamQuestionArea({
    question,
    draft,
    progress,
    questionTimeMs,
    totalQuestions,
    onAnswerChange,
    onMatrixChange,
    onScratchChange,
    onToggleReview,
    onZoomGraph,
}: ExamQuestionAreaProps) {
    return (
        <section className="question-card">
            <div className="question-card__top">
                <div>
                    <span className="question-card__eyebrow">Questao {question.number} de {totalQuestions}</span>
                    <h2>{question.title}</h2>
                    <p>Preencha apenas a resposta oficial nos campos abaixo. O rascunho continua separado e nao influencia a correcao imediata.</p>
                </div>
                <div className="question-card__top-actions">
                    <span className={progressClass(progress)}>{progressLabel(progress)}</span>
                    <span className="timer-pill">
                        <Clock3 size={16} />
                        {formatDuration(questionTimeMs)}
                    </span>
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

            <div className="badge-row">
                {question.topics.map((topic) => (
                    <span key={topic} className="tag">
                        {topic}
                    </span>
                ))}
                <span className="badge">{question.difficulty}</span>
            </div>

            <div className={`question-card__body ${question.graphKey ? 'question-card__body--with-graph' : ''}`}>
                <article className="statement-panel">
                    <div className="graph-panel__header">
                        <div>
                            <h3>Enunciado</h3>
                            <p>Leia com calma e use o mapa lateral para voltar em qualquer questao sem perder o progresso.</p>
                        </div>
                    </div>
                    <div className="content-stack">
                        <ContentRenderer blocks={question.prompt} />
                    </div>
                </article>

                {question.graphKey ? (
                    <article className="graph-panel">
                        <div className="graph-panel__header">
                            <div>
                                <h3>Apoio visual</h3>
                                <p>{question.graphCaption || 'Grafico de apoio para interpretar a questao.'}</p>
                            </div>
                            <button type="button" className="icon-button" onClick={() => onZoomGraph(question.graphKey)}>
                                <Expand size={16} />
                                Ampliar
                            </button>
                        </div>
                        <GraphFigure graphKey={question.graphKey} />
                    </article>
                ) : null}

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
                    <ExamScratchpad value={draft.scratch} onChange={onScratchChange} />
                </article>
            </div>
        </section>
    );
}
