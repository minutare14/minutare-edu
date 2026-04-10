export type DashboardAiSessionStatus = 'idle' | 'active' | 'error' | 'archived';

export type DashboardAiMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type DashboardAiMessageStatus = 'pending' | 'sent' | 'complete' | 'error';

export type DashboardAiShellState = 'booting' | 'ready' | 'sending' | 'error' | 'empty';

export type DashboardAiErrorCode =
    | 'EMPTY_MESSAGE'
    | 'SESSION_NOT_FOUND'
    | 'AI_REQUEST_FAILED'
    | 'NETWORK_ERROR'
    | 'RATE_LIMITED'
    | 'UNKNOWN_ERROR';

export type DashboardAiSession = {
    id: string;
    userId?: string | null;
    title: string;
    status: DashboardAiSessionStatus;
    createdAt: string;
    updatedAt: string;
    lastMessageAt?: string | null;
};

export type DashboardAiMessage = {
    id: string;
    sessionId: string;
    role: DashboardAiMessageRole;
    content: string;
    createdAt: string;
    status?: DashboardAiMessageStatus;
    errorCode?: string | null;
};

export type DashboardAiErrorPayload = {
    code: DashboardAiErrorCode;
    message: string;
};

export type DashboardAiSessionResponse = {
    session: DashboardAiSession;
};

export type DashboardAiHistoryResponse = {
    sessionId: string;
    messages: DashboardAiMessage[];
};

export type DashboardAiMessageRequest = {
    sessionId: string;
    message: {
        content: string;
    };
};

export type DashboardAiMessageSuccessResponse = {
    sessionId: string;
    userMessage: DashboardAiMessage;
    assistantMessage: DashboardAiMessage;
};

export type DashboardAiMessageErrorResponse = {
    sessionId: string;
    error: DashboardAiErrorPayload;
};

export type DashboardAiRetryRequest = {
    sessionId: string;
};

export type DashboardAiRetrySuccessResponse = {
    sessionId: string;
    assistantMessage: DashboardAiMessage;
};
