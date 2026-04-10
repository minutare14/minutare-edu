import type { DashboardAiSession, DashboardAiShellState } from '@/types/dashboard-ai.ts';

type DashboardAiHeaderProps = {
    session: DashboardAiSession | null;
    shellState: DashboardAiShellState;
};

function getShellLabel(shellState: DashboardAiShellState) {
    switch (shellState) {
        case 'booting':
            return 'Preparando conversa';
        case 'sending':
            return 'Gerando resposta';
        case 'error':
            return 'Atencao necessaria';
        case 'empty':
            return 'Conversa pronta';
        case 'ready':
        default:
            return 'Assistente ativo';
    }
}

export function DashboardAiHeader({ session, shellState }: DashboardAiHeaderProps) {
    return (
        <header className="dashboard-ai-header">
            <div className="dashboard-ai-header__copy">
                <a className="dashboard-ai-header__back" href="/dashboard">
                    Voltar ao dashboard
                </a>
                <span className="dashboard-ai-header__eyebrow">Dashboard AI</span>
                <h1>{session?.title || 'Dashboard AI'}</h1>
                <p>
                    Conversa persistida, resposta por envio explicito e recuperacao de falhas sem travar o restante da interface.
                </p>
            </div>
            <div className="dashboard-ai-header__meta">
                <span className={`dashboard-ai-header__pill dashboard-ai-header__pill--${shellState}`}>
                    {getShellLabel(shellState)}
                </span>
                {session?.updatedAt ? (
                    <span className="dashboard-ai-header__timestamp">
                        Atualizado {new Date(session.updatedAt).toLocaleString('pt-BR')}
                    </span>
                ) : null}
            </div>
        </header>
    );
}
