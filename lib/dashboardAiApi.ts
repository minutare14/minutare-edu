import type {
    DashboardAiErrorCode,
    DashboardAiErrorPayload,
    DashboardAiHistoryResponse,
    DashboardAiMessageErrorResponse,
    DashboardAiMessageRequest,
    DashboardAiMessageSuccessResponse,
    DashboardAiRetryRequest,
    DashboardAiRetrySuccessResponse,
    DashboardAiSessionResponse,
} from '@/types/dashboard-ai.ts';

export class DashboardAiApiError extends Error {
    code: DashboardAiErrorCode;
    status: number;

    constructor(payload: DashboardAiErrorPayload, status = 500) {
        super(payload.message);
        this.name = 'DashboardAiApiError';
        this.code = payload.code;
        this.status = status;
    }
}

async function parseJson<T>(response: Response): Promise<T> {
    const text = await response.text();

    if (!text) {
        throw new DashboardAiApiError({
            code: 'UNKNOWN_ERROR',
            message: 'Resposta vazia do servidor.',
        }, response.status);
    }

    try {
        return JSON.parse(text) as T;
    } catch {
        throw new DashboardAiApiError({
            code: 'UNKNOWN_ERROR',
            message: 'Nao foi possivel interpretar a resposta do servidor.',
        }, response.status);
    }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
    try {
        const response = await fetch(input, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(init?.headers || {}),
            },
            ...init,
        });

        if (!response.ok) {
            const payload = await parseJson<DashboardAiMessageErrorResponse | { error?: string }>(response);

            if ('error' in payload && payload.error && typeof payload.error === 'object' && 'code' in payload.error) {
                throw new DashboardAiApiError(payload.error as DashboardAiErrorPayload, response.status);
            }

            throw new DashboardAiApiError(
                {
                    code: 'UNKNOWN_ERROR',
                    message: typeof payload.error === 'string' ? payload.error : 'Falha ao carregar o assistente.',
                },
                response.status,
            );
        }

        return parseJson<T>(response);
    } catch (error) {
        if (error instanceof DashboardAiApiError) {
            throw error;
        }

        throw new DashboardAiApiError({
            code: 'NETWORK_ERROR',
            message: 'Nao foi possivel falar com o servidor agora.',
        }, 0);
    }
}

export const dashboardAiApi = {
    getSession(): Promise<DashboardAiSessionResponse> {
        return request<DashboardAiSessionResponse>('/api/dashboard-ai/session');
    },
    getHistory(sessionId: string): Promise<DashboardAiHistoryResponse> {
        const url = new URL('/api/dashboard-ai/history', window.location.origin);
        url.searchParams.set('sessionId', sessionId);
        return request<DashboardAiHistoryResponse>(url.pathname + url.search);
    },
    sendMessage(payload: DashboardAiMessageRequest): Promise<DashboardAiMessageSuccessResponse> {
        return request<DashboardAiMessageSuccessResponse>('/api/dashboard-ai/message', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },
    retry(payload: DashboardAiRetryRequest): Promise<DashboardAiRetrySuccessResponse> {
        return request<DashboardAiRetrySuccessResponse>('/api/dashboard-ai/retry', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },
};
