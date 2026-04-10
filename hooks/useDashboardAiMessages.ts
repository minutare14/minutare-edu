import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { DashboardAiApiError, dashboardAiApi } from '@/lib/dashboardAiApi.ts';
import type { DashboardAiErrorPayload, DashboardAiMessage } from '@/types/dashboard-ai.ts';

type UseDashboardAiMessagesResult = {
    messages: DashboardAiMessage[];
    loading: boolean;
    error: DashboardAiErrorPayload | null;
    setMessages: Dispatch<SetStateAction<DashboardAiMessage[]>>;
    refreshHistory: () => Promise<DashboardAiMessage[]>;
};

export function useDashboardAiMessages(sessionId: string | null): UseDashboardAiMessagesResult {
    const [messages, setMessages] = useState<DashboardAiMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<DashboardAiErrorPayload | null>(null);

    const refreshHistory = useCallback(async () => {
        if (!sessionId) {
            setMessages([]);
            return [];
        }

        setLoading(true);
        setError(null);

        try {
            const response = await dashboardAiApi.getHistory(sessionId);
            setMessages(response.messages);
            return response.messages;
        } catch (caughtError) {
            const nextError =
                caughtError instanceof DashboardAiApiError
                    ? { code: caughtError.code, message: caughtError.message }
                    : { code: 'UNKNOWN_ERROR', message: 'Falha ao carregar o historico do assistente.' };
            setError(nextError);
            return [];
        } finally {
            setLoading(false);
        }
    }, [sessionId]);

    useEffect(() => {
        if (!sessionId) {
            setMessages([]);
            setLoading(false);
            setError(null);
            return;
        }

        void refreshHistory();
    }, [refreshHistory, sessionId]);

    return useMemo(
        () => ({
            messages,
            loading,
            error,
            setMessages,
            refreshHistory,
        }),
        [error, loading, messages, refreshHistory],
    );
}
