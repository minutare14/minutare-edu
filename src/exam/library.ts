import { EXAM_QUESTIONS } from './data';
import type { ExamQuestion, TopicId } from './model';

export interface ExamDefinition {
    id: string;
    slug: string;
    title: string;
    subtitle: string;
    category: string;
    description: string;
    estimatedMinutes: number;
    questionCount: number;
    questions: ExamQuestion[];
    topics: TopicId[];
}

const lista1Topics = Array.from(new Set(EXAM_QUESTIONS.flatMap((question) => question.topics))) as TopicId[];

export const LISTA1_EXAM: ExamDefinition = {
    id: 'ufba-ctia03-lista-1',
    slug: 'ufba-ctia03-lista-1',
    title: 'Lista 1',
    subtitle: 'UFBA · Bases Matematicas',
    category: 'Simulados e Provas',
    description:
        'Lista completa com conjuntos, intervalos, funcoes, graficos, composicao, dominio/imagem, funcao afim e funcao quadratica em fluxo de resolucao guiada.',
    estimatedMinutes: 140,
    questionCount: EXAM_QUESTIONS.length,
    questions: EXAM_QUESTIONS,
    topics: lista1Topics,
};

export const EXAM_LIBRARY: ExamDefinition[] = [LISTA1_EXAM];
