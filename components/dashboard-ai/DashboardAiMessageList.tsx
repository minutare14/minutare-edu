import { useEffect, useRef } from 'react';
import { DashboardAiMessageItem } from '@/components/dashboard-ai/DashboardAiMessageItem.tsx';
import type { DashboardAiMessage } from '@/types/dashboard-ai.ts';

type DashboardAiMessageListProps = {
    messages: DashboardAiMessage[];
    onRetry?: (() => void) | null;
    retryDisabled?: boolean;
};

export function DashboardAiMessageList({
    messages,
    onRetry = null,
    retryDisabled = false,
}: DashboardAiMessageListProps) {
    const scrollerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const element = scrollerRef.current;
        if (!element) {
            return;
        }

        element.scrollTop = element.scrollHeight;
    }, [messages]);

    const lastMessageId = messages.at(-1)?.id || null;

    if (!messages.length) {
        return (
            <div className="dashboard-ai-empty-state">
                <span className="dashboard-ai-empty-state__eyebrow">Assistente do dashboard</span>
                <h2>Abra a conversa quando quiser revisar, organizar estudo ou destravar uma duvida.</h2>
                <p>
                    A conversa fica persistida por sessao e voce pode retomar depois sem perder o historico.
                </p>
            </div>
        );
    }

    return (
        <div ref={scrollerRef} className="dashboard-ai-message-list">
            {messages.map((message) => (
                <DashboardAiMessageItem
                    key={message.id}
                    message={message}
                    showRetry={Boolean(onRetry && message.status === 'error' && message.role === 'assistant' && message.id === lastMessageId)}
                    retryDisabled={retryDisabled}
                    onRetry={onRetry}
                />
            ))}
        </div>
    );
}
