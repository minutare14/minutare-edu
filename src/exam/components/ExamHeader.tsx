import { Clock3, Save } from 'lucide-react';
import { formatDuration } from '../timing';

interface ExamHeaderProps {
    title: string;
    subtitle: string;
    attemptNumber: number;
    totalMs: number;
    questionMs: number;
    saveStatus: 'idle' | 'saving' | 'saved' | 'local-only';
    onSave: () => void;
}

function saveStatusLabel(saveStatus: ExamHeaderProps['saveStatus']) {
    if (saveStatus === 'saving') return 'Salvando progresso...';
    if (saveStatus === 'saved') return 'Progresso sincronizado';
    if (saveStatus === 'local-only') return 'Salvo localmente';
    return 'Progresso local continuo';
}

export function ExamHeader({ title, subtitle, attemptNumber, totalMs, questionMs, saveStatus, onSave }: ExamHeaderProps) {
    return (
        <section className="floating-actions">
            <div className="question-actions">
                <div className="question-actions__left">
                    <span className="badge">Tentativa {attemptNumber}</span>
                    <span className="progress-pill">{subtitle}</span>
                    <span className="timer-pill">
                        <Clock3 size={16} />
                        Tempo total {formatDuration(totalMs)}
                    </span>
                    <span className="timer-pill">
                        <Clock3 size={16} />
                        Questao atual {formatDuration(questionMs)}
                    </span>
                </div>

                <div className="question-actions__right">
                    <span className="support-chip support-chip--status">{saveStatusLabel(saveStatus)}</span>
                    <button type="button" className="ghost-button" onClick={onSave}>
                        <Save size={16} />
                        Salvar agora
                    </button>
                </div>
            </div>
            <div className="question-footer">
                <span className="question-card__eyebrow">{title}</span>
                <span className="question-footer__hint">Modo prova sem dicas, sem tutor e sem correcao imediata.</span>
            </div>
        </section>
    );
}
