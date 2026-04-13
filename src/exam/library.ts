import { EXAM_QUESTIONS } from './data';
import type { ExamFeatureConfig } from './config';
import { IMPORTED_EXAMS } from './imported/generated';
import { registerImportedExam } from './imported/register';
import type { ExamQuestion, TopicId } from './model';

export interface ExamDefinition {
    id: string;
    slug: string;
    title: string;
    subtitle: string;
    category: string;
    description: string;
    discipline: string;
    moduleLabel: string;
    semester: string;
    typeLabel: string;
    difficultyLabel: string;
    createdAt: string;
    active: boolean;
    estimatedMinutes: number;
    questionCount: number;
    questions: ExamQuestion[];
    topics: TopicId[];
    stateKey: string;
    storageKey: string;
    gradingMode?: 'automatic' | 'manual';
    supportImageSrc?: string;
    supportImageAlt?: string;
    sourceFolderName?: string;
    features?: Partial<ExamFeatureConfig>;
}

const lista1Topics = Array.from(new Set(EXAM_QUESTIONS.flatMap((question) => question.topics))) as TopicId[];

export const LISTA1_EXAM: ExamDefinition = {
    id: 'ufba-ctia03-lista-1',
    slug: 'ufba-ctia03-lista-1',
    title: 'Lista 1',
    subtitle: 'UFBA - Bases Matematicas',
    category: 'Simulados e Provas',
    description:
        'Lista completa com conjuntos, intervalos, funcoes, graficos, composicao, dominio/imagem, funcao afim e funcao quadratica em fluxo de resolucao guiada.',
    discipline: 'Bases Matematicas',
    moduleLabel: 'Lista 1',
    semester: 'UFBA - CTIA03',
    typeLabel: 'Lista',
    difficultyLabel: 'Intermediaria',
    createdAt: '2026-04-08T00:00:00.000Z',
    active: true,
    estimatedMinutes: 140,
    questionCount: EXAM_QUESTIONS.length,
    questions: EXAM_QUESTIONS,
    topics: lista1Topics,
    stateKey: 'lista1InteractiveExam',
    storageKey: 'ctia03-lista1-interactive-exam-v1',
    gradingMode: 'automatic',
    features: {
        allowHints: false,
        allowTutor: false,
        immediateFeedback: false,
        showTotalTimer: true,
        showQuestionTimers: true,
        exportPdf: true,
        persistProgress: true,
    },
};

const IMPORTED_EXAM_LIBRARY = IMPORTED_EXAMS.map((exam) => registerImportedExam(exam));

export const EXAM_LIBRARY: ExamDefinition[] = [LISTA1_EXAM, ...IMPORTED_EXAM_LIBRARY];
