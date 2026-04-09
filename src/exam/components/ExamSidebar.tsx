import { Clock3 } from 'lucide-react';
import { formatDuration } from '../timing';

type QuestionProgress = 'unanswered' | 'in-progress' | 'answered' | 'review';

interface SidebarQuestionItem {
    id: string;
    number: number;
    title: string;
    progress: QuestionProgress;
    timeMs: number;
}

interface ExamSidebarProps {
    attemptNumber: number;
    totalQuestions: number;
    answeredCount: number;
    reviewCount: number;
    inProgressCount: number;
    totalTimeMs: number;
    activeQuestionId: string;
    questions: SidebarQuestionItem[];
    onSelectQuestion: (id: string) => void;
}

function progressLabel(progress: QuestionProgress) {
    if (progress === 'answered') return 'Respondida';
    if (progress === 'in-progress') return 'Em andamento';
    if (progress === 'review') return 'Revisar';
    return 'Nao respondida';
}

function progressClass(progress: QuestionProgress) {
    if (progress === 'answered') return 'rail-item rail-item--answered';
    if (progress === 'review') return 'rail-item rail-item--review';
    return 'rail-item';
}

export function ExamSidebar({
    attemptNumber,
    totalQuestions,
    answeredCount,
    reviewCount,
    inProgressCount,
    totalTimeMs,
    activeQuestionId,
    questions,
    onSelectQuestion,
}: ExamSidebarProps) {
    return (
        <aside className="question-rail">
            <div className="question-rail__header">
                <h2>Mapa da prova</h2>
                <p>Acompanhe a tentativa atual, retome qualquer questao e identifique rapidamente os pontos marcados para revisao.</p>
            </div>

            <div className="question-rail__summary">
                <div className="rail-summary-card">
                    <span>Tentativa</span>
                    <strong>{attemptNumber}</strong>
                </div>
                <div className="rail-summary-card">
                    <span>Respondidas</span>
                    <strong>{answeredCount}/{totalQuestions}</strong>
                </div>
                <div className="rail-summary-card">
                    <span>Tempo total</span>
                    <strong>{formatDuration(totalTimeMs)}</strong>
                </div>
            </div>

            <div className="question-rail__summary">
                <div className="metric-chip">
                    <span>Em andamento</span>
                    <strong>{inProgressCount}</strong>
                </div>
                <div className="metric-chip">
                    <span>Revisar</span>
                    <strong>{reviewCount}</strong>
                </div>
                <div className="metric-chip">
                    <span>Pendentes</span>
                    <strong>{Math.max(0, totalQuestions - answeredCount - inProgressCount - reviewCount)}</strong>
                </div>
            </div>

            <div className="question-rail__list">
                {questions.map((question) => {
                    const active = question.id === activeQuestionId;
                    return (
                        <button
                            key={question.id}
                            type="button"
                            className={`${progressClass(question.progress)} ${active ? 'rail-item--active' : ''}`}
                            onClick={() => onSelectQuestion(question.id)}
                        >
                            <span className="rail-item__number">{question.number}</span>
                            <span className="rail-item__content">
                                <span className="rail-item__label">{question.title}</span>
                                <span className="rail-item__meta">{progressLabel(question.progress)}</span>
                            </span>
                            <span className="timer-pill">
                                <Clock3 size={14} />
                                {formatDuration(question.timeMs)}
                            </span>
                        </button>
                    );
                })}
            </div>
        </aside>
    );
}
