export type ImportedExamType = 'avaliacao' | 'lista' | 'simulado';

export interface ExamGraphAsset {
    id: string;
    examId: string;
    questionId: string;
    sourceImagePath: string;
    graphType: 'line' | 'parabola' | 'axes' | 'custom';
    renderMode: 'svg' | 'canvas';
    reconstructed: boolean;
    payload: Record<string, unknown>;
}

export interface ImportedExamQuestion {
    id: string;
    number: string;
    statement: string;
    topics: string[];
    answerSchema: {
        hasScratchpad: boolean;
        hasOfficialAnswerField: boolean;
    };
    graphRef?: string | null;
}

export interface ImportedExam {
    id: string;
    slug: string;
    title: string;
    sourceFolderName: string;
    markdownPath: string;
    imagePath: string;
    publicImagePath?: string;
    discipline?: string | null;
    semester?: string | null;
    type: ImportedExamType;
    hasGraphs: boolean;
    graphAssets?: ExamGraphAsset[];
    questions: ImportedExamQuestion[];
}
