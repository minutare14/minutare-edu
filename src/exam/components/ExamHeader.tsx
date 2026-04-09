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
        <section className="exam-command">
            <div className="exam-command__top">
                <div className="exam-command__copy">
                    <span className="question-card__eyebrow">Modo prova · Tentativa {attemptNumber}</span>
                    <h2>{title}</h2>
                    <p>{subtitle}. Fluxo de prova sem dicas e sem correcao imediata, com salvamento continuo e retomada limpa.</p>
                </div>
                <div className="exam-command__actions">
                    <span className="support-chip support-chip--status">{saveStatusLabel(saveStatus)}</span>
                    <button type="button" className="ghost-button" onClick={onSave}>
                        <Save size={16} />
                        Salvar agora
                    </button>
                </div>
            </div>

            <div className="exam-command__metrics">
                <article className="exam-command__metric">
                    <span>Etapa</span>
                    <strong>Questao em andamento</strong>
                    <small>Continue no seu ritmo e use o mapa lateral para voltar a qualquer ponto.</small>
                </article>
                <article className="exam-command__metric">
                    <span>Tempo total</span>
                    <strong>{formatDuration(totalMs)}</strong>
                    <small>Cronometro da tentativa inteira, salvo junto com o progresso.</small>
                </article>
                <article className="exam-command__metric">
                    <span>Questao atual</span>
                    <strong>{formatDuration(questionMs)}</strong>
                    <small>Tempo acumulado apenas na questao selecionada.</small>
                </article>
            </div>
        </section>
    );
}
