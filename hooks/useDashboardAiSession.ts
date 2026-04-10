import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardAiApiError, dashboardAiApi } from '@/lib/dashboardAiApi.ts';
import type { DashboardAiErrorPayload, DashboardAiSession } from '@/types/dashboard-ai.ts';

export const DASHBOARD_AI_SESSION_STORAGE_KEY = 'dashboard_ai_session_id';

type UseDashboardAiSessionResult = {
    session: DashboardAiSession | null;
    loading: boolean;
    error: DashboardAiErrorPayload | null;
    storedSessionId: string | null;
    refreshSession: () => Promise<DashboardAiSession | null>;
    recreateSession: () => Promise<DashboardAiSession | null>;
};

export function useDashboardAiSession(): UseDashboardAiSessionResult {
    const [session, setSession] = useState<DashboardAiSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<DashboardAiErrorPayload | null>(null);
    const [storedSessionId, setStoredSessionId] = useState<string | null>(null);

    const persistSession = useCallback((nextSession: DashboardAiSession | null) => {
        setSession(nextSession);

        if (!nextSession) {
            localStorage.removeItem(DASHBOARD_AI_SESSION_STORAGE_KEY);
            setStoredSessionId(null);
            return;
        }

        localStorage.setItem(DASHBOARD_AI_SESSION_STORAGE_KEY, nextSession.id);
        setStoredSessionId(nextSession.id);
    }, []);

    const refreshSession = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await dashboardAiApi.getSession();
            persistSession(response.session);
            return response.session;
        } catch (caughtError) {
            const nextError =
                caughtError instanceof DashboardAiApiError
                    ? { code: caughtError.code, message: caughtError.message }
                    : { code: 'UNKNOWN_ERROR', message: 'Falha ao carregar a sessao do assistente.' };
            setError(nextError);
            persistSession(null);
            return null;
        } finally {
            setLoading(false);
        }
    }, [persistSession]);

    const recreateSession = useCallback(async () => {
        localStorage.removeItem(DASHBOARD_AI_SESSION_STORAGE_KEY);
        setStoredSessionId(null);
        return refreshSession();
    }, [refreshSession]);

    useEffect(() => {
        setStoredSessionId(localStorage.getItem(DASHBOARD_AI_SESSION_STORAGE_KEY));
        void refreshSession();
    }, [refreshSession]);

    return useMemo(
        () => ({
            session,
            loading,
            error,
            storedSessionId,
            refreshSession,
            recreateSession,
        }),
        [error, loading, recreateSession, refreshSession, session, storedSessionId],
    );
}
