import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface ExamTimingSnapshot {
    startedAt: string | null;
    completedAt: string | null;
    totalElapsedMs: number;
    questionElapsedMs: Record<string, number>;
}

type TimingSession = {
    questionId: string | null;
    startedAtMs: number | null;
};

function buildQuestionElapsedMap(questionIds: string[]) {
    return Object.fromEntries(questionIds.map((questionId) => [questionId, 0])) as Record<string, number>;
}

export function createEmptyTimingSnapshot(questionIds: string[]): ExamTimingSnapshot {
    return {
        startedAt: null,
        completedAt: null,
        totalElapsedMs: 0,
        questionElapsedMs: buildQuestionElapsedMap(questionIds),
    };
}

export function ensureTimingSnapshot(snapshot: Partial<ExamTimingSnapshot> | null | undefined, questionIds: string[]): ExamTimingSnapshot {
    const base = createEmptyTimingSnapshot(questionIds);
    if (!snapshot) return base;

    return {
        startedAt: typeof snapshot.startedAt === 'string' ? snapshot.startedAt : null,
        completedAt: typeof snapshot.completedAt === 'string' ? snapshot.completedAt : null,
        totalElapsedMs: Number.isFinite(Number(snapshot.totalElapsedMs)) ? Number(snapshot.totalElapsedMs) : 0,
        questionElapsedMs: {
            ...base.questionElapsedMs,
            ...(snapshot.questionElapsedMs || {}),
        },
    };
}

export function formatDuration(ms: number) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatDurationLong(ms: number) {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];

    if (hours) parts.push(`${hours}h`);
    if (minutes || hours) parts.push(`${minutes}min`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
}

export function usePageVisibility() {
    const [visible, setVisible] = useState(() => (typeof document === 'undefined' ? true : !document.hidden));

    useEffect(() => {
        if (typeof document === 'undefined') return undefined;

        const handleVisibilityChange = () => setVisible(!document.hidden);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    return visible;
}

export function useExamTiming({
    questionIds,
    initialSnapshot,
    activeQuestionId,
    running,
}: {
    questionIds: string[];
    initialSnapshot?: Partial<ExamTimingSnapshot> | null;
    activeQuestionId: string;
    running: boolean;
}) {
    const [snapshot, setSnapshot] = useState(() => ensureTimingSnapshot(initialSnapshot, questionIds));
    const [tick, setTick] = useState(Date.now());
    const sessionRef = useRef<TimingSession>({ questionId: null, startedAtMs: null });
    const snapshotRef = useRef(snapshot);

    useEffect(() => {
        snapshotRef.current = snapshot;
    }, [snapshot]);

    const buildCommittedSnapshot = useCallback(
        (stopAt: number, { complete = false }: { complete?: boolean } = {}) => {
            let next = ensureTimingSnapshot(snapshotRef.current, questionIds);
            const session = sessionRef.current;

            if (session.startedAtMs !== null && session.questionId) {
                const elapsed = Math.max(0, stopAt - session.startedAtMs);
                if (elapsed > 0) {
                    next = {
                        ...next,
                        totalElapsedMs: next.totalElapsedMs + elapsed,
                        questionElapsedMs: {
                            ...next.questionElapsedMs,
                            [session.questionId]: (next.questionElapsedMs[session.questionId] || 0) + elapsed,
                        },
                    };
                }
            }

            if (complete) {
                next = {
                    ...next,
                    completedAt: new Date(stopAt).toISOString(),
                };
            }

            return next;
        },
        [questionIds],
    );

    const pause = useCallback(() => {
        const stopAt = Date.now();
        const next = buildCommittedSnapshot(stopAt);
        sessionRef.current = { questionId: null, startedAtMs: null };
        snapshotRef.current = next;
        setSnapshot(next);
        setTick(stopAt);
        return next;
    }, [buildCommittedSnapshot]);

    const finish = useCallback(() => {
        const stopAt = Date.now();
        const next = buildCommittedSnapshot(stopAt, { complete: true });
        sessionRef.current = { questionId: null, startedAtMs: null };
        snapshotRef.current = next;
        setSnapshot(next);
        setTick(stopAt);
        return next;
    }, [buildCommittedSnapshot]);

    const reset = useCallback(() => {
        const next = createEmptyTimingSnapshot(questionIds);
        sessionRef.current = { questionId: null, startedAtMs: null };
        snapshotRef.current = next;
        setSnapshot(next);
        setTick(Date.now());
        return next;
    }, [questionIds]);

    const hydrate = useCallback(
        (nextSnapshot?: Partial<ExamTimingSnapshot> | null) => {
            const normalized = ensureTimingSnapshot(nextSnapshot, questionIds);
            sessionRef.current = { questionId: null, startedAtMs: null };
            snapshotRef.current = normalized;
            setSnapshot(normalized);
            setTick(Date.now());
        },
        [questionIds],
    );

    useEffect(() => {
        if (!running) {
            pause();
            return undefined;
        }

        const now = Date.now();
        setSnapshot((current) =>
            current.startedAt
                ? current.completedAt
                    ? { ...current, completedAt: null }
                    : current
                : { ...current, startedAt: new Date(now).toISOString(), completedAt: null },
        );

        if (sessionRef.current.questionId !== activeQuestionId || sessionRef.current.startedAtMs === null) {
            const committed = buildCommittedSnapshot(now);
            sessionRef.current = { questionId: activeQuestionId, startedAtMs: now };
            snapshotRef.current = committed;
            setSnapshot(committed);
        }

        const interval = window.setInterval(() => setTick(Date.now()), 1000);
        return () => {
            window.clearInterval(interval);
            pause();
        };
    }, [activeQuestionId, buildCommittedSnapshot, pause, running]);

    const liveElapsedMs =
        running && sessionRef.current.startedAtMs !== null
            ? Math.max(0, tick - sessionRef.current.startedAtMs)
            : 0;

    const totalElapsedMs = snapshot.totalElapsedMs + liveElapsedMs;
    const questionElapsedMs = useMemo(() => {
        const next = { ...snapshot.questionElapsedMs };
        if (running && sessionRef.current.questionId) {
            next[sessionRef.current.questionId] = (next[sessionRef.current.questionId] || 0) + liveElapsedMs;
        }
        return next;
    }, [liveElapsedMs, running, snapshot.questionElapsedMs]);

    return {
        snapshot,
        totalElapsedMs,
        questionElapsedMs,
        pause,
        finish,
        reset,
        hydrate,
    };
}
