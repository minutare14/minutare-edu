import { memo } from 'react';
import { DashboardAiRetryButton } from '@/components/dashboard-ai/DashboardAiRetryButton.tsx';
import { MathText } from '@/src/exam/content.tsx';
import type { DashboardAiMessage } from '@/types/dashboard-ai.ts';

type DashboardAiMessageItemProps = {
    message: DashboardAiMessage;
    retryDisabled?: boolean;
    showRetry?: boolean;
    onRetry?: (() => void) | null;
};

function DashboardAiMessageItemComponent({
    message,
    retryDisabled = false,
    showRetry = false,
    onRetry = null,
}: DashboardAiMessageItemProps) {
    const isAssistant = message.role === 'assistant';
    const isError = message.status === 'error';
    const isPending = message.status === 'pending';

    return (
        <article
            className={[
                'dashboard-ai-message',
                `dashboard-ai-message--${message.role}`,
                isPending ? 'dashboard-ai-message--pending' : '',
                isError ? 'dashboard-ai-message--error' : '',
            ].filter(Boolean).join(' ')}
        >
            <div className="dashboard-ai-message__meta">
                <span>{isAssistant ? 'Assistente IA' : 'Voce'}</span>
                <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                })}</time>
            </div>
            <div className="dashboard-ai-message__bubble">
                {isPending ? (
                    <p>Gerando resposta...</p>
                ) : (
                    message.content.split('\n').map((line, index) => (
                        <p key={`${message.id}-${index}`}>
                            <MathText text={line || ' '} />
                        </p>
                    ))
                )}
            </div>
            {isError && message.errorCode ? <span className="dashboard-ai-message__code">{message.errorCode}</span> : null}
            {showRetry && onRetry ? <DashboardAiRetryButton disabled={retryDisabled} onClick={onRetry} /> : null}
        </article>
    );
}

export const DashboardAiMessageItem = memo(DashboardAiMessageItemComponent);
