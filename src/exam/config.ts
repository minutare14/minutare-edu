export type ExamCardStatus = 'not-started' | 'in-progress' | 'completed';

export interface ExamFeatureConfig {
    allowHints: boolean;
    allowTutor: boolean;
    immediateFeedback: boolean;
    showTotalTimer: boolean;
    showQuestionTimers: boolean;
    exportPdf: boolean;
    persistProgress: boolean;
}

export interface ExamFilterOption {
    id: ExamListFilterId;
    label: string;
}

export type ExamListFilterId = 'all' | 'not-started' | 'in-progress' | 'completed' | 'lista' | 'prova' | 'simulado';

export const DEFAULT_EXAM_FEATURES: ExamFeatureConfig = {
    allowHints: false,
    allowTutor: false,
    immediateFeedback: false,
    showTotalTimer: true,
    showQuestionTimers: true,
    exportPdf: true,
    persistProgress: true,
};

export const EXAM_FILTERS: ExamFilterOption[] = [
    { id: 'all', label: 'Todas' },
    { id: 'not-started', label: 'Nao iniciadas' },
    { id: 'in-progress', label: 'Em andamento' },
    { id: 'completed', label: 'Concluidas' },
    { id: 'lista', label: 'Listas' },
    { id: 'prova', label: 'Provas' },
    { id: 'simulado', label: 'Simulados' },
];

export function resolveExamFeatures(overrides?: Partial<ExamFeatureConfig>): ExamFeatureConfig {
    return {
        ...DEFAULT_EXAM_FEATURES,
        ...overrides,
    };
}

export function examStatusLabel(status: ExamCardStatus) {
    return status === 'completed' ? 'Concluida' : status === 'in-progress' ? 'Em andamento' : 'Nao iniciada';
}
