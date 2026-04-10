import { useCallback, useMemo, useState } from 'react';
import { DashboardAiApiError, dashboardAiApi } from '@/lib/dashboardAiApi.ts';
import type {
    DashboardAiMessageRequest,
    DashboardAiMessageSuccessResponse,
    DashboardAiRetrySuccessResponse,
} from '@/types/dashboard-ai.ts';

type UseDashboardAiSendMessageResult = {
    sending: boolean;
    sendMessage: (content: string) => Promise<DashboardAiMessageSuccessResponse>;
    retryLastFailed: () => Promise<DashboardAiRetrySuccessResponse>;
};

export function useDashboardAiSendMessage(sessionId: string | null): UseDashboardAiSendMessageResult {
    const [sending, setSending] = useState(false);

    const sendMessage = useCallback(async (content: string) => {
        if (!sessionId) {
            throw new DashboardAiApiError({
                code: 'SESSION_NOT_FOUND',
                message: 'Nao foi possivel localizar a sessao atual.',
            }, 404);
        }

        setSending(true);

        try {
            const payload: DashboardAiMessageRequest = {
                sessionId,
                message: {
                    content,
                },
            };
            return await dashboardAiApi.sendMessage(payload);
        } finally {
            setSending(false);
        }
    }, [sessionId]);

    const retryLastFailed = useCallback(async () => {
        if (!sessionId) {
            throw new DashboardAiApiError({
                code: 'SESSION_NOT_FOUND',
                message: 'Nao foi possivel localizar a sessao atual.',
            }, 404);
        }

        setSending(true);

        try {
            return await dashboardAiApi.retry({ sessionId });
        } finally {
            setSending(false);
        }
    }, [sessionId]);

    return useMemo(
        () => ({
            sending,
            sendMessage,
            retryLastFailed,
        }),
        [retryLastFailed, sendMessage, sending],
    );
}
