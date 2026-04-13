import type { ExamDefinition } from '../library';
import type { ContentBlock, ExamQuestion } from '../model';
import type { ImportedExam, ImportedExamQuestion } from './contracts';

function sentenceCase(value: string) {
    const normalized = value.replace(/[_-]+/g, ' ').trim();
    if (!normalized) return 'Nao informado';

    return normalized
        .split(/\s+/)
        .map((part) => (part.length <= 3 && part === part.toUpperCase() ? part : part.charAt(0).toUpperCase() + part.slice(1)))
        .join(' ');
}

function normalizeInlineMath(text: string) {
    return text.replace(/\\\((.+?)\\\)/g, '$$$1$$');
}

function stripInlineMarkdown(text: string) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`(.+?)`/g, '$1');
}

function normalizeTitleCandidate(text: string) {
    return stripInlineMarkdown(text)
        .replace(/\\\((.+?)\\\)/g, '$1')
        .replace(/\\mathbb\{([^}]+)\}/g, '$1')
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
        .replace(/\\(?:quad|qquad|cdot|times|circ|to|ge|le|left|right|text)\b/g, ' ')
        .replace(/\\[a-zA-Z]+/g, ' ')
        .replace(/[{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function isWeakTitleCandidate(text: string) {
    if (!text || text.length < 12) return true;

    const letterCount = text.match(/[A-Za-zÀ-ÿ]/g)?.length ?? 0;
    if (letterCount < 10) return true;

    const normalized = text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    return /^(se|e|determine:?|calcule:?|dados:?|considere:?|responda:?|assuma:?|sao tais que)$/.test(normalized);
}

function toContentBlocks(statement: string): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    const lines = statement.replace(/\r\n/g, '\n').split('\n');
    const paragraphBuffer: string[] = [];
    let bulletBuffer: string[] = [];

    const flushParagraph = () => {
        if (!paragraphBuffer.length) return;

        const text = normalizeInlineMath(stripInlineMarkdown(paragraphBuffer.join(' ').replace(/\s+/g, ' ').trim()));
        if (text) {
            blocks.push({ type: 'paragraph', text });
        }
        paragraphBuffer.length = 0;
    };

    const flushBullets = () => {
        if (!bulletBuffer.length) return;
        blocks.push({
            type: 'bullets',
            items: bulletBuffer.map((item) => normalizeInlineMath(stripInlineMarkdown(item))),
        });
        bulletBuffer = [];
    };

    for (let index = 0; index < lines.length; index += 1) {
        const rawLine = lines[index];
        const line = rawLine.trim();

        if (!line) {
            flushParagraph();
            flushBullets();
            continue;
        }

        if (line === '\\[' || line === '[') {
            flushParagraph();
            flushBullets();

            const equationLines: string[] = [];
            for (index += 1; index < lines.length; index += 1) {
                const equationLine = lines[index].trim();
                if (equationLine === '\\]' || equationLine === ']') {
                    break;
                }
                equationLines.push(equationLine);
            }

            const equationText = equationLines.join(' ').replace(/\s+/g, ' ').trim();
            if (equationText) {
                blocks.push({ type: 'equation', text: equationText });
            }
            continue;
        }

        const bulletMatch = line.match(/^[-*]\s+(.+)$/);
        if (bulletMatch) {
            flushParagraph();
            bulletBuffer.push(bulletMatch[1].trim());
            continue;
        }

        flushBullets();
        paragraphBuffer.push(line);
    }

    flushParagraph();
    flushBullets();

    return blocks;
}

function extractQuestionTitle(question: ImportedExamQuestion) {
    const lines = question.statement
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => normalizeTitleCandidate(line.trim()))
        .filter(Boolean);

    const firstTextLine = lines.find((line) => {
        if (['\\[', '\\]', '[', ']'].includes(line)) return false;
        if (/^[a-d]\)/i.test(line)) return false;
        if (isWeakTitleCandidate(line)) return false;
        return true;
    });

    const title = firstTextLine || `Questao ${question.number}`;

    if (title.length <= 84) {
        return title;
    }

    return `${title.slice(0, 81).trimEnd()}...`;
}

function normalizeNumber(value: string) {
    return /^\d+$/.test(value) ? Number(value) : value;
}

function estimateMinutes(questionCount: number) {
    return Math.max(60, questionCount * 20);
}

function buildQuestion(exam: ImportedExam, question: ImportedExamQuestion): ExamQuestion {
    const graphAsset = exam.graphAssets?.find((asset) => asset.id === question.graphRef);
    const graphComment = graphAsset?.reconstructed
        ? 'Grafico reconstruido em SVG para manter leitura legivel na prova, no relatorio e no PDF.'
        : undefined;

    return {
        id: question.id,
        number: normalizeNumber(question.number),
        title: extractQuestionTitle(question),
        topics: question.topics.length ? question.topics : ['conceitos'],
        difficulty: 'intermediario',
        prompt: toContentBlocks(question.statement),
        graphKey: question.graphRef || undefined,
        graphCaption: graphAsset ? 'Grafico reconstruido a partir do material original da prova.' : undefined,
        answerSchema: {
            kind: 'open',
            instructions: 'Registre sua resposta final sem alterar o enunciado original.',
            field: {
                key: `${question.id}-official-answer`,
                label: 'Resposta oficial',
                placeholder: 'Escreva sua resolucao final aqui.',
                rows: 8,
            },
            hasOfficialAnswerField: question.answerSchema.hasOfficialAnswerField,
            hasScratchpad: question.answerSchema.hasScratchpad,
        },
        solution: {
            answerSummary: 'Gabarito nao informado no arquivo-fonte.',
            steps: [
                'Questao importada a partir do markdown original da prova local.',
                'O arquivo-fonte nao traz gabarito oficial estruturado para correcao automatica.',
                'Use sua resposta final, o rascunho salvo e o material original para revisar a resolucao.',
            ],
            graphComment,
            studyTip: 'Compare sua resolucao com o enunciado original e revise os passos antes de finalizar a tentativa.',
        },
    };
}

export function registerImportedExam(exam: ImportedExam): ExamDefinition {
    const questions = exam.questions.map((question) => buildQuestion(exam, question));
    const topics = Array.from(new Set(questions.flatMap((question) => question.topics)));
    const subtitle = exam.discipline?.trim() || 'Bases Matematicas';
    const semester = exam.semester ? sentenceCase(exam.semester) : 'Semestre passado';
    const typeLabel = sentenceCase(exam.type);

    return {
        id: exam.id,
        slug: exam.slug,
        title: exam.title,
        subtitle,
        category: 'Simulados e Provas',
        description: `${exam.title} importada da pasta local ${exam.sourceFolderName} com ${questions.length} questoes discursivas preservadas do markdown original.`,
        discipline: subtitle,
        moduleLabel: exam.title,
        semester,
        typeLabel,
        difficultyLabel: 'Discursiva',
        createdAt: new Date().toISOString(),
        active: true,
        estimatedMinutes: estimateMinutes(questions.length),
        questionCount: questions.length,
        questions,
        topics,
        stateKey: `${exam.slug}ImportedExamState`,
        storageKey: `${exam.slug}-imported-exam-v1`,
        gradingMode: 'manual',
        supportImageSrc: exam.publicImagePath,
        supportImageAlt: `${exam.title} - imagem original da prova`,
        sourceFolderName: exam.sourceFolderName,
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
}
