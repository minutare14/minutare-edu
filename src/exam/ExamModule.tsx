import { ChevronLeft, ChevronRight, ClipboardList, Flag, PlayCircle } from 'lucide-react';
import type { ExamDraftState, QuestionDraft, ToggleAnswer } from './grading';
import type { ExamDefinition } from './library';
import type { ExamQuestion } from './model';
import { formatDuration, formatDurationLong } from './timing';
import { ExamHeader } from './components/ExamHeader';
import { ExamQuestionArea } from './components/ExamQuestionArea';
import { ExamSidebar } from './components/ExamSidebar';

type QuestionProgress = 'unanswered' | 'in-progress' | 'answered' | 'review';

interface ExamModuleProps {
    exam: ExamDefinition;
    attemptNumber: number;
    questions: ExamQuestion[];
    drafts: ExamDraftState;
    activeQuestionId: string;
    progressByQuestion: Record<string, QuestionProgress>;
    questionElapsedMs: Record<string, number>;
    totalElapsedMs: number;
    answeredCount: number;
    reviewCount: number;
    inProgressCount: number;
    saveStatus: 'idle' | 'saving' | 'saved' | 'local-only';
    onSelectQuestion: (id: string) => void;
    onAnswerChange: (fieldKey: string, value: string) => void;
    onMatrixChange: (rowKey: string, columnKey: string, value: ToggleAnswer) => void;
    onScratchChange: (value: string) => void;
    onToggleReview: () => void;
    onPrevious: () => void;
    onNext: () => void;
    onSave: () => void;
    onFinish: () => void;
    onZoomGraph: (graphKey: ExamQuestion['graphKey']) => void;
}

export function ExamModule({
    exam,
    attemptNumber,
    questions,
    drafts,
    activeQuestionId,
    progressByQuestion,
    questionElapsedMs,
    totalElapsedMs,
    answeredCount,
    reviewCount,
    inProgressCount,
    saveStatus,
    onSelectQuestion,
    onAnswerChange,
    onMatrixChange,
    onScratchChange,
    onToggleReview,
    onPrevious,
    onNext,
    onSave,
    onFinish,
    onZoomGraph,
}: ExamModuleProps) {
    const activeIndex = questions.findIndex((question) => question.id === activeQuestionId);
    const safeIndex = activeIndex >= 0 ? activeIndex : 0;
    const activeQuestion = questions[safeIndex];
    const activeDraft: QuestionDraft = drafts[activeQuestion?.id] || { scratch: '', flagged: false, answers: {}, matrixAnswers: {} };
    const activeProgress = activeQuestion ? progressByQuestion[activeQuestion.id] || 'unanswered' : 'unanswered';
    const activeQuestionTimeMs = activeQuestion ? questionElapsedMs[activeQuestion.id] || 0 : 0;
    const canGoPrevious = safeIndex > 0;
    const canGoNext = safeIndex < questions.length - 1;

    if (!activeQuestion) return null;

    return (
        <div className="question-stage">
            <ExamHeader
                title={`${exam.subtitle} - ${exam.title}`}
                subtitle={exam.moduleLabel}
                attemptNumber={attemptNumber}
                totalMs={totalElapsedMs}
                questionMs={activeQuestionTimeMs}
                saveStatus={saveStatus}
                onSave={onSave}
            />

            <div className="workspace">
                <ExamSidebar
                    attemptNumber={attemptNumber}
                    totalQuestions={questions.length}
                    answeredCount={answeredCount}
                    reviewCount={reviewCount}
                    inProgressCount={inProgressCount}
                    totalTimeMs={totalElapsedMs}
                    activeQuestionId={activeQuestion.id}
                    questions={questions.map((question) => ({
                        id: question.id,
                        number: question.number,
                        title: question.title,
                        progress: progressByQuestion[question.id] || 'unanswered',
                        timeMs: questionElapsedMs[question.id] || 0,
                    }))}
                    onSelectQuestion={onSelectQuestion}
                />

                <div className="question-stage">
                    <ExamQuestionArea
                        question={activeQuestion}
                        draft={activeDraft}
                        progress={activeProgress}
                        questionTimeMs={activeQuestionTimeMs}
                        totalQuestions={questions.length}
                        onAnswerChange={onAnswerChange}
                        onMatrixChange={onMatrixChange}
                        onScratchChange={onScratchChange}
                        onToggleReview={onToggleReview}
                        onZoomGraph={onZoomGraph}
                    />

                    <section className="floating-actions">
                        <div className="question-actions">
                            <div className="question-actions__left">
                                <button type="button" className="ghost-button" onClick={onPrevious} disabled={!canGoPrevious}>
                                    <ChevronLeft size={16} />
                                    Questao anterior
                                </button>
                                <button
                                    type="button"
                                    className={`ghost-button ${activeDraft.flagged ? 'ghost-button--flagged' : ''}`}
                                    onClick={onToggleReview}
                                >
                                    <Flag size={16} />
                                    {activeDraft.flagged ? 'Questao marcada' : 'Marcar para revisar'}
                                </button>
                            </div>
                            <div className="question-actions__right">
                                <button type="button" className="primary-button" onClick={onNext} disabled={!canGoNext}>
                                    Proxima questao
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="finish-strip">
                        <div className="question-footer">
                            <div>
                                <span className="question-card__eyebrow">Fechamento da tentativa</span>
                                <h3>Finalize quando quiser consolidar relatorio, IA e PDF desta tentativa.</h3>
                                <p>{answeredCount} respondidas, {reviewCount} marcadas para revisar e {formatDurationLong(totalElapsedMs)} registrados ate agora.</p>
                            </div>
                            <div className="question-actions__right">
                                <span className="progress-pill progress-pill--in-progress">
                                    <ClipboardList size={16} />
                                    {inProgressCount} em andamento
                                </span>
                                <button
                                    type="button"
                                    className="primary-button primary-button--finish"
                                    onClick={() => {
                                        if (window.confirm('Finalizar esta tentativa agora? O relatorio sera gerado com base nas respostas salvas.')) {
                                            onFinish();
                                        }
                                    }}
                                >
                                    <PlayCircle size={16} />
                                    Finalizar tentativa
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
