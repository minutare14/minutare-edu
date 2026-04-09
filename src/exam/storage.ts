import type { PedagogicalFeedback } from './feedback';
import type { ExamDraftState } from './grading';
import type { ExamDefinition } from './library';
import { createEmptyTimingSnapshot, ensureTimingSnapshot, type ExamTimingSnapshot } from './timing';

export type CachedExamAnalysisStatus = 'idle' | 'loading' | 'ready' | 'fallback' | 'error';

export interface CachedExamAnalysis {
    status: CachedExamAnalysisStatus;
    source: 'ai' | 'local' | null;
    requestedAt: string | null;
    generatedAt: string | null;
    feedback: PedagogicalFeedback | null;
}

export interface ExamAttemptRecord {
    id: string;
    attemptNumber: number;
    createdAt: string;
    updatedAt: string;
    activeQuestionId: string;
    finished: boolean;
    drafts: ExamDraftState;
    timing: ExamTimingSnapshot;
    analysis: CachedExamAnalysis;
}

export interface PersistedExamState {
    version: 3;
    examId: string;
    updatedAt: string;
    currentAttemptId: string;
    attempts: ExamAttemptRecord[];
}

type LegacyPersistedExamState = {
    version?: number;
    examId?: string;
    updatedAt?: string;
    activeQuestionId?: string;
    finished?: boolean;
    drafts?: ExamDraftState;
    timing?: Partial<ExamTimingSnapshot> | null;
};

function nowIso() {
    return new Date().toISOString();
}

function createAttemptId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyAnalysis(): CachedExamAnalysis {
    return {
        status: 'idle',
        source: null,
        requestedAt: null,
        generatedAt: null,
        feedback: null,
    };
}

export function createAttemptRecord(
    exam: ExamDefinition,
    drafts: ExamDraftState,
    attemptNumber: number,
    overrides: Partial<Omit<ExamAttemptRecord, 'id' | 'attemptNumber' | 'timing' | 'analysis'>> & {
        timing?: Partial<ExamTimingSnapshot> | null;
        analysis?: Partial<CachedExamAnalysis> | null;
    } = {},
): ExamAttemptRecord {
    const createdAt = typeof overrides.createdAt === 'string' ? overrides.createdAt : nowIso();
    const updatedAt = typeof overrides.updatedAt === 'string' ? overrides.updatedAt : createdAt;

    return {
        id: createAttemptId(),
        attemptNumber,
        createdAt,
        updatedAt,
        activeQuestionId: typeof overrides.activeQuestionId === 'string' ? overrides.activeQuestionId : exam.questions[0]?.id || '',
        finished: Boolean(overrides.finished),
        drafts: overrides.drafts || drafts,
        timing: ensureTimingSnapshot(overrides.timing, exam.questions.map((question) => question.id)),
        analysis: overrides.analysis ? normalizeAnalysis(overrides.analysis) : createEmptyAnalysis(),
    };
}

function normalizeAnalysis(value: Partial<CachedExamAnalysis> | null | undefined): CachedExamAnalysis {
    return {
        status:
            value?.status === 'loading' ||
            value?.status === 'ready' ||
            value?.status === 'fallback' ||
            value?.status === 'error'
                ? value.status
                : 'idle',
        source: value?.source === 'ai' || value?.source === 'local' ? value.source : null,
        requestedAt: typeof value?.requestedAt === 'string' ? value.requestedAt : null,
        generatedAt: typeof value?.generatedAt === 'string' ? value.generatedAt : null,
        feedback: value?.feedback || null,
    };
}

function normalizeAttempt(value: Partial<ExamAttemptRecord>, exam: ExamDefinition, attemptNumber: number): ExamAttemptRecord {
    const createdAt = typeof value.createdAt === 'string' ? value.createdAt : typeof value.updatedAt === 'string' ? value.updatedAt : nowIso();
    const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : createdAt;

    return {
        id: typeof value.id === 'string' && value.id.trim() ? value.id : createAttemptId(),
        attemptNumber: Number.isFinite(Number(value.attemptNumber)) ? Number(value.attemptNumber) : attemptNumber,
        createdAt,
        updatedAt,
        activeQuestionId: typeof value.activeQuestionId === 'string' ? value.activeQuestionId : exam.questions[0]?.id || '',
        finished: Boolean(value.finished),
        drafts: (value.drafts || {}) as ExamDraftState,
        timing: ensureTimingSnapshot(value.timing, exam.questions.map((question) => question.id)),
        analysis: normalizeAnalysis(value.analysis),
    };
}

function migrateLegacyState(value: LegacyPersistedExamState, exam: ExamDefinition): PersistedExamState | null {
    if (!value.updatedAt || !value.activeQuestionId || !value.drafts) return null;

    const migratedAttempt = createAttemptRecord(exam, value.drafts, 1, {
        createdAt: value.updatedAt,
        updatedAt: value.updatedAt,
        activeQuestionId: value.activeQuestionId,
        finished: Boolean(value.finished),
        drafts: value.drafts,
        timing: value.timing || createEmptyTimingSnapshot(exam.questions.map((question) => question.id)),
    });

    return {
        version: 3,
        examId: typeof value.examId === 'string' ? value.examId : exam.id,
        updatedAt: migratedAttempt.updatedAt,
        currentAttemptId: migratedAttempt.id,
        attempts: [migratedAttempt],
    };
}

export function parsePersistedExamState(value: unknown, exam: ExamDefinition): PersistedExamState | null {
    if (!value || typeof value !== 'object') return null;

    const data = value as Partial<PersistedExamState & LegacyPersistedExamState>;
    if (data.version === 3 && Array.isArray(data.attempts) && typeof data.updatedAt === 'string') {
        const attempts = data.attempts.map((attempt, index) => normalizeAttempt(attempt, exam, index + 1));
        if (!attempts.length) return null;

        const currentAttemptId =
            typeof data.currentAttemptId === 'string' && attempts.some((attempt) => attempt.id === data.currentAttemptId)
                ? data.currentAttemptId
                : attempts[attempts.length - 1].id;

        return {
            version: 3,
            examId: typeof data.examId === 'string' ? data.examId : exam.id,
            updatedAt: data.updatedAt,
            currentAttemptId,
            attempts,
        };
    }

    return migrateLegacyState(data, exam);
}

export function readLocalExamState(exam: ExamDefinition): PersistedExamState | null {
    try {
        const raw = window.localStorage.getItem(exam.storageKey);
        return raw ? parsePersistedExamState(JSON.parse(raw), exam) : null;
    } catch {
        return null;
    }
}

export function createInitialPersistedExamState(exam: ExamDefinition, drafts: ExamDraftState): PersistedExamState {
    const firstAttempt = createAttemptRecord(exam, drafts, 1);
    return {
        version: 3,
        examId: exam.id,
        updatedAt: firstAttempt.updatedAt,
        currentAttemptId: firstAttempt.id,
        attempts: [firstAttempt],
    };
}

export function buildPersistedExamState({
    exam,
    currentAttemptId,
    attempts,
    updatedAt,
}: {
    exam: ExamDefinition;
    currentAttemptId: string;
    attempts: ExamAttemptRecord[];
    updatedAt?: string;
}): PersistedExamState {
    return {
        version: 3,
        examId: exam.id,
        updatedAt: updatedAt || nowIso(),
        currentAttemptId,
        attempts,
    };
}

export function getAttemptById(state: PersistedExamState | null, attemptId: string | null | undefined) {
    if (!state || !attemptId) return null;
    return state.attempts.find((attempt) => attempt.id === attemptId) || null;
}

export function getCurrentAttempt(state: PersistedExamState | null) {
    if (!state) return null;
    return getAttemptById(state, state.currentAttemptId) || state.attempts[state.attempts.length - 1] || null;
}

export function getLatestCompletedAttempt(state: PersistedExamState | null) {
    if (!state) return null;
    return (
        [...state.attempts]
            .filter((attempt) => attempt.finished)
            .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0] || null
    );
}

export function replaceAttempt(state: PersistedExamState, nextAttempt: ExamAttemptRecord): PersistedExamState {
    const attempts = state.attempts.map((attempt) => (attempt.id === nextAttempt.id ? nextAttempt : attempt));
    return {
        ...state,
        updatedAt: nextAttempt.updatedAt,
        attempts,
    };
}

export function updateAttempt(
    state: PersistedExamState,
    attemptId: string,
    updater: (attempt: ExamAttemptRecord) => ExamAttemptRecord,
): PersistedExamState {
    const currentAttempt = getAttemptById(state, attemptId);
    if (!currentAttempt) return state;

    const nextAttempt = {
        ...updater(currentAttempt),
        updatedAt: nowIso(),
    };

    return replaceAttempt(
        {
            ...state,
            updatedAt: nextAttempt.updatedAt,
        },
        nextAttempt,
    );
}

export function createNextAttemptState(state: PersistedExamState, exam: ExamDefinition, drafts: ExamDraftState) {
    const nextAttempt = createAttemptRecord(exam, drafts, state.attempts.length + 1);
    return {
        ...state,
        updatedAt: nextAttempt.updatedAt,
        currentAttemptId: nextAttempt.id,
        attempts: [...state.attempts, nextAttempt],
    };
}

export function pickMostRecentExamState(localState: PersistedExamState | null, remoteState: PersistedExamState | null) {
    if (localState && remoteState) {
        return new Date(localState.updatedAt).getTime() >= new Date(remoteState.updatedAt).getTime() ? localState : remoteState;
    }

    return localState || remoteState || null;
}
