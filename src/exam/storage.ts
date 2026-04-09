import type { ExamDefinition } from './library';
import type { ExamDraftState } from './grading';
import { createEmptyTimingSnapshot, ensureTimingSnapshot, type ExamTimingSnapshot } from './timing';

export interface PersistedExamState {
    version: 2;
    examId: string;
    updatedAt: string;
    activeQuestionId: string;
    finished: boolean;
    drafts: ExamDraftState;
    timing: ExamTimingSnapshot;
}

export function parsePersistedExamState(value: unknown, exam: ExamDefinition): PersistedExamState | null {
    if (!value || typeof value !== 'object') return null;
    const data = value as Partial<PersistedExamState & { version?: number }>;
    if (!data.updatedAt || !data.activeQuestionId || !data.drafts) return null;

    return {
        version: 2,
        examId: typeof data.examId === 'string' ? data.examId : exam.id,
        updatedAt: data.updatedAt,
        activeQuestionId: data.activeQuestionId,
        finished: Boolean(data.finished),
        drafts: data.drafts as ExamDraftState,
        timing: ensureTimingSnapshot(data.timing, exam.questions.map((question) => question.id)),
    };
}

export function readLocalExamState(exam: ExamDefinition): PersistedExamState | null {
    try {
        const raw = window.localStorage.getItem(exam.storageKey);
        return raw ? parsePersistedExamState(JSON.parse(raw), exam) : null;
    } catch {
        return null;
    }
}

export function buildPersistedExamState({
    exam,
    activeQuestionId,
    finished,
    drafts,
    timing,
}: {
    exam: ExamDefinition;
    activeQuestionId: string;
    finished: boolean;
    drafts: ExamDraftState;
    timing: ExamTimingSnapshot;
}): PersistedExamState {
    return {
        version: 2,
        examId: exam.id,
        updatedAt: new Date().toISOString(),
        activeQuestionId,
        finished,
        drafts,
        timing: ensureTimingSnapshot(timing, exam.questions.map((question) => question.id)),
    };
}

export function createInitialPersistedExamState(exam: ExamDefinition, drafts: ExamDraftState): PersistedExamState {
    return {
        version: 2,
        examId: exam.id,
        updatedAt: new Date().toISOString(),
        activeQuestionId: exam.questions[0]?.id || '',
        finished: false,
        drafts,
        timing: createEmptyTimingSnapshot(exam.questions.map((question) => question.id)),
    };
}

export function pickMostRecentExamState(localState: PersistedExamState | null, remoteState: PersistedExamState | null) {
    if (localState && remoteState) {
        return new Date(localState.updatedAt).getTime() >= new Date(remoteState.updatedAt).getTime() ? localState : remoteState;
    }

    return localState || remoteState || null;
}
