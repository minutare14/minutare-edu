import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardAiComposer } from '@/components/dashboard-ai/DashboardAiComposer.tsx';
import { DashboardAiHeader } from '@/components/dashboard-ai/DashboardAiHeader.tsx';
import { DashboardAiMessageList } from '@/components/dashboard-ai/DashboardAiMessageList.tsx';
import { DashboardAiStatusBanner } from '@/components/dashboard-ai/DashboardAiStatusBanner.tsx';
import { useDashboardAiMessages } from '@/hooks/useDashboardAiMessages.ts';
import { useDashboardAiSession } from '@/hooks/useDashboardAiSession.ts';
import { useDashboardAiSendMessage } from '@/hooks/useDashboardAiSendMessage.ts';
import { DashboardAiApiError } from '@/lib/dashboardAiApi.ts';
import type {
    DashboardAiErrorCode,
    DashboardAiErrorPayload,
    DashboardAiMessage,
    DashboardAiShellState,
} from '@/types/dashboard-ai.ts';

const DASHBOARD_AI_DRAFT_STORAGE_KEY = 'dashboard_ai_prefill';

type BannerState = {
    code?: DashboardAiErrorCode | null;
    message: string;
    title: string;
    tone: 'info' | 'error' | 'warning';
};

type LocalRetryState = {
    assistantTempId: string;
    content: string;
    userTempId: string;
};

function createTempMessage(
    role: DashboardAiMessage['role'],
    sessionId: string,
    content: string,
    status: DashboardAiMessage['status'],
    errorCode: string | null = null,
): DashboardAiMessage {
    return {
        id: `temp_${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sessionId,
        role,
        content,
        createdAt: new Date().toISOString(),
        status,
        errorCode,
    };
}

function normalizeError(caughtError: unknown): DashboardAiErrorPayload {
    if (caughtError instanceof DashboardAiApiError) {
        return {
            code: caughtError.code,
            message: caughtError.message,
        };
    }

    if (caughtError instanceof Error && caughtError.message === 'SESSION_NOT_FOUND') {
        return {
            code: 'SESSION_NOT_FOUND',
            message: 'Nao foi possivel localizar a sessao atual.',
        };
    }

    return {
        code: 'UNKNOWN_ERROR',
        message: 'Nao foi possivel concluir a operacao agora.',
    };
}

function buildBannerFromError(error: DashboardAiErrorPayload): BannerState {
    switch (error.code) {
        case 'SESSION_NOT_FOUND':
            return {
                tone: 'warning',
                title: 'Sessao reiniciada',
                message: 'A conversa anterior nao estava mais disponivel, entao uma nova sessao sera preparada.',
                code: error.code,
            };
        case 'EMPTY_MESSAGE':
            return {
                tone: 'warning',
                title: 'Mensagem vazia',
                message: error.message,
                code: error.code,
            };
        case 'RATE_LIMITED':
            return {
                tone: 'warning',
                title: 'Limite temporario atingido',
                message: error.message,
                code: error.code,
            };
        case 'NETWORK_ERROR':
            return {
                tone: 'error',
                title: 'Falha de conexao',
                message: 'A interface continua ativa. Assim que a conexao voltar, tente novamente.',
                code: error.code,
            };
        case 'AI_REQUEST_FAILED':
            return {
                tone: 'error',
                title: 'Nao foi possivel gerar a resposta',
                message: error.message,
                code: error.code,
            };
        case 'UNKNOWN_ERROR':
        default:
            return {
                tone: 'error',
                title: 'Algo saiu do esperado',
                message: error.message,
                code: error.code,
            };
    }
}

export function DashboardAiShell() {
    const { session, loading: loadingSession, error: sessionError, recreateSession } = useDashboardAiSession();
    const {
        messages,
        loading: loadingHistory,
        error: historyError,
        setMessages,
        refreshHistory,
    } = useDashboardAiMessages(session?.id ?? null);
    const { sending, sendMessage, retryLastFailed } = useDashboardAiSendMessage(session?.id ?? null);

    const [shellState, setShellState] = useState<DashboardAiShellState>('booting');
    const [banner, setBanner] = useState<BannerState | null>(null);
    const [inlineError, setInlineError] = useState<string | null>(null);
    const [draftSeed, setDraftSeed] = useState('');
    const [localRetry, setLocalRetry] = useState<LocalRetryState | null>(null);

    useEffect(() => {
        const seededDraft = sessionStorage.getItem(DASHBOARD_AI_DRAFT_STORAGE_KEY);
        if (!seededDraft) {
            return;
        }

        sessionStorage.removeItem(DASHBOARD_AI_DRAFT_STORAGE_KEY);
        setDraftSeed(seededDraft);
    }, []);

    useEffect(() => {
        if (sessionError) {
            setBanner(buildBannerFromError(sessionError));
            setShellState('error');
        }
    }, [sessionError]);

    useEffect(() => {
        if (historyError) {
            setBanner(buildBannerFromError(historyError));
            setShellState('error');
        }
    }, [historyError]);

    useEffect(() => {
        if (loadingSession || (session?.id && loadingHistory)) {
            setShellState('booting');
            return;
        }

        if (!session || sessionError || historyError) {
            return;
        }

        if (sending) {
            setShellState('sending');
            return;
        }

        setShellState(messages.length ? 'ready' : 'empty');
    }, [historyError, loadingHistory, loadingSession, messages.length, sending, session, sessionError]);

    const syncHistoryWithServerFailure = useCallback(async (
        fallbackContext: LocalRetryState,
        normalizedError: DashboardAiErrorPayload,
    ) => {
        const serverMessages = await refreshHistory();
        const hasServerFailure = serverMessages.some((message) => message.role === 'assistant' && message.status === 'error');

        if (hasServerFailure) {
            setLocalRetry(null);
            return;
        }

        setMessages((currentMessages) =>
            currentMessages.map((message) => {
                if (message.id === fallbackContext.userTempId) {
                    return {
                        ...message,
                        status: 'sent',
                    };
                }

                if (message.id === fallbackContext.assistantTempId) {
                    return {
                        ...message,
                        status: 'error',
                        content: normalizedError.message,
                        errorCode: normalizedError.code,
                    };
                }

                return message;
            }),
        );
    }, [refreshHistory, setMessages]);

    const handleFailure = useCallback(async (
        caughtError: unknown,
        retryContext: LocalRetryState,
    ) => {
        const normalizedError = normalizeError(caughtError);
        setBanner(buildBannerFromError(normalizedError));
        setShellState('error');

        if (normalizedError.code === 'SESSION_NOT_FOUND') {
            setMessages((currentMessages) =>
                currentMessages.filter(
                    (message) => message.id !== retryContext.userTempId && message.id !== retryContext.assistantTempId,
                ),
            );
            setLocalRetry(null);
            await recreateSession();
            return;
        }

        if (normalizedError.code === 'AI_REQUEST_FAILED' || normalizedError.code === 'RATE_LIMITED') {
            await syncHistoryWithServerFailure(retryContext, normalizedError);
            return;
        }

        setLocalRetry(retryContext);
        setMessages((currentMessages) =>
            currentMessages.map((message) => {
                if (message.id === retryContext.userTempId) {
                    return {
                        ...message,
                        status: 'sent',
                    };
                }

                if (message.id === retryContext.assistantTempId) {
                    return {
                        ...message,
                        status: 'error',
                        content: normalizedError.message,
                        errorCode: normalizedError.code,
                    };
                }

                return message;
            }),
        );
    }, [recreateSession, setMessages, syncHistoryWithServerFailure]);

    const handleSubmit = useCallback(async (content: string) => {
        const normalizedContent = content.trim();

        if (!normalizedContent) {
            setInlineError('Digite uma mensagem antes de enviar.');
            return false;
        }

        if (!session?.id) {
            const recreatedSession = await recreateSession();
            if (!recreatedSession?.id) {
                setBanner(buildBannerFromError({
                    code: 'SESSION_NOT_FOUND',
                    message: 'Nao foi possivel preparar a sessao do assistente.',
                }));
            }
            return false;
        }

        setInlineError(null);
        setBanner(null);
        setDraftSeed('');
        setLocalRetry(null);

        const optimisticUserMessage = createTempMessage('user', session.id, normalizedContent, 'pending');
        const optimisticAssistantMessage = createTempMessage('assistant', session.id, 'Gerando resposta...', 'pending');
        const retryContext: LocalRetryState = {
            userTempId: optimisticUserMessage.id,
            assistantTempId: optimisticAssistantMessage.id,
            content: normalizedContent,
        };

        setMessages((currentMessages) => [...currentMessages, optimisticUserMessage, optimisticAssistantMessage]);
        setShellState('sending');

        void (async () => {
            try {
                const response = await sendMessage(normalizedContent);
                setLocalRetry(null);
                setBanner(null);
                setMessages((currentMessages) =>
                    currentMessages.map((message) => {
                        if (message.id === retryContext.userTempId) {
                            return response.userMessage;
                        }

                        if (message.id === retryContext.assistantTempId) {
                            return response.assistantMessage;
                        }

                        return message;
                    }),
                );
                setShellState('ready');
            } catch (caughtError) {
                await handleFailure(caughtError, retryContext);
            }
        })();

        return true;
    }, [handleFailure, recreateSession, sendMessage, session?.id, setMessages]);

    const handleRetry = useCallback(() => {
        if (!session?.id || sending) {
            return;
        }

        setBanner(null);
        setInlineError(null);
        setShellState('sending');

        if (localRetry) {
            const retryContext = localRetry;
            setMessages((currentMessages) =>
                currentMessages.map((message) => {
                    if (message.id === retryContext.assistantTempId) {
                        return {
                            ...message,
                            status: 'pending',
                            content: 'Gerando resposta...',
                            errorCode: null,
                        };
                    }

                    return message;
                }),
            );

            void (async () => {
                try {
                    const response = await sendMessage(retryContext.content);
                    setLocalRetry(null);
                    setMessages((currentMessages) =>
                        currentMessages.map((message) => {
                            if (message.id === retryContext.userTempId) {
                                return response.userMessage;
                            }

                            if (message.id === retryContext.assistantTempId) {
                                return response.assistantMessage;
                            }

                            return message;
                        }),
                    );
                    setShellState('ready');
                } catch (caughtError) {
                    await handleFailure(caughtError, retryContext);
                }
            })();
            return;
        }

        void (async () => {
            try {
                await retryLastFailed();
                setBanner(null);
                setLocalRetry(null);
                await refreshHistory();
                setShellState('ready');
            } catch (caughtError) {
                const normalizedError = normalizeError(caughtError);
                setBanner(buildBannerFromError(normalizedError));
                setShellState('error');

                if (normalizedError.code === 'SESSION_NOT_FOUND') {
                    await recreateSession();
                }
            }
        })();
    }, [handleFailure, localRetry, recreateSession, refreshHistory, retryLastFailed, sendMessage, sending, session?.id, setMessages]);

    const showRetry = useMemo(
        () => Boolean(localRetry || messages.some((message) => message.role === 'assistant' && message.status === 'error')),
        [localRetry, messages],
    );

    return (
        <div className="dashboard-ai-page">
            <div className="dashboard-ai-page__shell">
                <DashboardAiHeader session={session} shellState={shellState} />
                {banner ? (
                    <DashboardAiStatusBanner
                        tone={banner.tone}
                        title={banner.title}
                        message={banner.message}
                        code={banner.code}
                        onRetry={showRetry ? handleRetry : null}
                        retryDisabled={sending}
                    />
                ) : null}
                <section className="dashboard-ai-panel">
                    {shellState === 'booting' && !messages.length ? (
                        <div className="dashboard-ai-skeleton" aria-hidden="true">
                            <div className="dashboard-ai-skeleton__message dashboard-ai-skeleton__message--assistant"></div>
                            <div className="dashboard-ai-skeleton__message dashboard-ai-skeleton__message--user"></div>
                            <div className="dashboard-ai-skeleton__message dashboard-ai-skeleton__message--assistant"></div>
                        </div>
                    ) : (
                        <DashboardAiMessageList
                            messages={messages}
                            onRetry={showRetry ? handleRetry : null}
                            retryDisabled={sending}
                        />
                    )}
                    <div className="dashboard-ai-panel__composer">
                        <DashboardAiComposer
                            draftSeed={draftSeed}
                            inlineError={inlineError}
                            loading={sending}
                            onDismissError={() => setInlineError(null)}
                            onSubmit={handleSubmit}
                        />
                    </div>
                </section>
            </div>
        </div>
    );
}
