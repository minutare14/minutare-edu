import type { AnswerSchema, Checker, ExamQuestion, TopicId } from './model';
import { getTopicMeta } from './model';

export type ToggleAnswer = 'sim' | 'nao' | 'v' | 'f';

export interface QuestionDraft {
    scratch: string;
    flagged: boolean;
    answers: Record<string, string>;
    matrixAnswers: Record<string, Record<string, ToggleAnswer | ''>>;
    savedAt?: string;
}

export type ExamDraftState = Record<string, QuestionDraft>;

export interface FieldEvaluation {
    key: string;
    label: string;
    score: number;
    maxScore: number;
    studentAnswer: string;
    expectedAnswer: string;
}

export interface QuestionEvaluation {
    questionId: string;
    questionNumber: number | string;
    score: number;
    maxScore: number;
    ratio: number;
    status: 'correct' | 'partial' | 'incorrect' | 'answered' | 'blank';
    answered: boolean;
    fields: FieldEvaluation[];
}

export interface TopicPerformance {
    topic: TopicId;
    label: string;
    score: number;
    maxScore: number;
    ratio: number;
}

const EXACT_TRUE = new Set(['sim', 's', 'true', 'v', 'verdadeiro']);
const EXACT_FALSE = new Set(['nao', 'n', 'false', 'f', 'falso']);

export function createEmptyDraft(): QuestionDraft {
    return {
        scratch: '',
        flagged: false,
        answers: {},
        matrixAnswers: {},
    };
}

export function ensureDraft(draft?: QuestionDraft): QuestionDraft {
    return draft ? { ...createEmptyDraft(), ...draft } : createEmptyDraft();
}

export function normalizeText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[âˆ’â€“â€”]/g, '-')
        .replace(/Ï€/g, 'pi')
        .replace(/âˆž/g, 'inf')
        .replace(/âˆš/g, 'sqrt')
        .replace(/â„/g, 'r')
        .replace(/âˆª/g, 'u')
        .replace(/âˆ©/g, 'n')
        .replace(/â‰¤/g, '<=')
        .replace(/â‰¥/g, '>=')
        .replace(/\s+/g, '')
        .replace(/,+/g, '.')
        .trim();
}

function sanitizeNumericExpression(value: string): string | null {
    const prepared = value
        .trim()
        .replace(/,/g, '.')
        .replace(/Ï€/gi, 'pi')
        .replace(/âˆš/g, 'sqrt')
        .replace(/\^/g, '**')
        .replace(/abs/gi, 'Math.abs')
        .replace(/sqrt/gi, 'Math.sqrt')
        .replace(/\bpi\b/gi, 'Math.PI');

    if (!prepared) {
        return null;
    }

    if (!/^[0-9+\-*/().\s*MathPIabsqrt]+$/.test(prepared)) {
        return null;
    }

    return prepared;
}

export function evaluateNumericExpression(value: string): number | null {
    const sanitized = sanitizeNumericExpression(value);
    if (!sanitized) {
        return null;
    }

    try {
        const result = Function(`"use strict"; return (${sanitized});`)();
        return Number.isFinite(result) ? Number(result) : null;
    } catch {
        return null;
    }
}

function expectedSummary(checker: Checker): string {
    switch (checker.type) {
        case 'numeric':
            return String(checker.expected);
        case 'exact':
            return checker.accepted[0] || '';
        case 'keywords':
            return checker.required.join(', ');
        default:
            return '';
    }
}

function evaluateToggleAnswer(value: string): ToggleAnswer | '' {
    const normalized = normalizeText(value);
    if (!normalized) return '';
    if (EXACT_TRUE.has(normalized)) return normalized === 'v' || normalized === 'verdadeiro' ? 'v' : 'sim';
    if (EXACT_FALSE.has(normalized)) return normalized === 'f' || normalized === 'falso' ? 'f' : 'nao';
    return '';
}

function scoreChecker(checker: Checker, rawValue: string): number {
    const normalized = normalizeText(rawValue);

    switch (checker.type) {
        case 'numeric': {
            if (!rawValue.trim()) return 0;
            if ((checker.aliases || []).some((alias) => normalizeText(alias) === normalized)) {
                return 1;
            }

            const numericValue = evaluateNumericExpression(rawValue);
            if (numericValue === null) return 0;

            const tolerance = checker.tolerance ?? 0.01;
            return Math.abs(numericValue - checker.expected) <= tolerance ? 1 : 0;
        }
        case 'exact':
            return checker.accepted.some((item) => normalizeText(item) === normalized) ? 1 : 0;
        case 'keywords': {
            if (!normalized) return 0;
            const required = checker.required.map((item) => normalizeText(item));
            const matched = required.filter((token) => normalized.includes(token)).length;
            const minimumRequired = checker.minimumRequired ?? required.length;
            if (matched < minimumRequired) {
                return matched / Math.max(required.length, 1);
            }

            if (!checker.optional?.length) {
                return Math.min(1, matched / Math.max(required.length, 1));
            }

            const optionalMatches = checker.optional
                .map((item) => normalizeText(item))
                .filter((token) => normalized.includes(token)).length;

            const rawScore = (matched + optionalMatches * 0.4) / (required.length + checker.optional.length * 0.4);
            return Math.min(1, rawScore);
        }
        default:
            return 0;
    }
}

function evaluateGroupSchema(question: ExamQuestion, draft: QuestionDraft): QuestionEvaluation {
    const fields: FieldEvaluation[] = [];

    for (const group of question.answerSchema.kind === 'groups' ? question.answerSchema.groups : []) {
        for (const field of group.fields) {
            const studentAnswer = draft.answers[field.key] || '';
            const score = scoreChecker(field.checker, studentAnswer);
            fields.push({
                key: field.key,
                label: `${group.label} - ${field.label}`,
                score,
                maxScore: 1,
                studentAnswer,
                expectedAnswer: expectedSummary(field.checker),
            });
        }
    }

    return summarizeQuestion(question, fields, false);
}

function evaluateMatrixSchema(question: ExamQuestion, draft: QuestionDraft): QuestionEvaluation {
    const schema = question.answerSchema as Extract<AnswerSchema, { kind: 'matrix' }>;
    const fields: FieldEvaluation[] = [];

    for (const row of schema.rows) {
        for (const column of schema.columns) {
            const studentAnswer = draft.matrixAnswers[row.key]?.[column.key] || '';
            const expectedAnswer = schema.expected[row.key]?.[column.key] || 'nao';
            const normalizedStudent = evaluateToggleAnswer(studentAnswer);
            const score = normalizedStudent === expectedAnswer ? 1 : 0;

            fields.push({
                key: `${row.key}:${column.key}`,
                label: `${row.label} / ${column.label}`,
                score,
                maxScore: 1,
                studentAnswer,
                expectedAnswer,
            });
        }
    }

    return summarizeQuestion(question, fields, false);
}

function evaluateOpenSchema(question: ExamQuestion, draft: QuestionDraft): QuestionEvaluation {
    const schema = question.answerSchema as Extract<AnswerSchema, { kind: 'open' }>;
    const studentAnswer = draft.answers[schema.field.key] || '';
    const answered = Boolean(studentAnswer.trim());

    const fields: FieldEvaluation[] = [
        {
            key: schema.field.key,
            label: schema.field.label,
            score: answered ? 1 : 0,
            maxScore: 1,
            studentAnswer,
            expectedAnswer: 'Resposta discursiva sem gabarito automatizado.',
        },
    ];

    return summarizeQuestion(question, fields, true);
}

function summarizeQuestion(question: ExamQuestion, fields: FieldEvaluation[], manual = false): QuestionEvaluation {
    const score = fields.reduce((total, field) => total + field.score, 0);
    const maxScore = fields.reduce((total, field) => total + field.maxScore, 0);
    const ratio = maxScore ? score / maxScore : 0;
    const answered = fields.some((field) => field.studentAnswer.trim().length > 0);

    let status: QuestionEvaluation['status'] = 'blank';
    if (manual) {
        status = answered ? 'answered' : 'blank';
    } else if (answered && ratio >= 0.999) {
        status = 'correct';
    } else if (answered && ratio > 0) {
        status = 'partial';
    } else if (answered) {
        status = 'incorrect';
    }

    return {
        questionId: question.id,
        questionNumber: question.number,
        score,
        maxScore,
        ratio,
        status,
        answered,
        fields,
    };
}

export function evaluateQuestion(question: ExamQuestion, draft?: QuestionDraft): QuestionEvaluation {
    const safeDraft = ensureDraft(draft);
    if (question.answerSchema.kind === 'matrix') {
        return evaluateMatrixSchema(question, safeDraft);
    }
    if (question.answerSchema.kind === 'open') {
        return evaluateOpenSchema(question, safeDraft);
    }
    return evaluateGroupSchema(question, safeDraft);
}

export function getQuestionProgress(question: ExamQuestion, draft?: QuestionDraft): 'unanswered' | 'in-progress' | 'answered' | 'review' {
    const safeDraft = ensureDraft(draft);
    if (safeDraft.flagged) return 'review';

    const answerSchema = question.answerSchema;
    const hasOfficialAnswer =
        answerSchema.kind === 'matrix'
            ? Object.values(safeDraft.matrixAnswers).some((row) => Object.values(row).some((value) => Boolean(value)))
            : answerSchema.kind === 'open'
              ? Boolean(safeDraft.answers[answerSchema.field.key]?.trim())
              : Object.keys(safeDraft.answers).some((key) => Boolean(safeDraft.answers[key]?.trim()));

    const hasScratchpad = question.answerSchema.kind === 'open' ? question.answerSchema.hasScratchpad : true;
    if (!hasOfficialAnswer && (!hasScratchpad || !safeDraft.scratch.trim())) return 'unanswered';

    const evaluation = evaluateQuestion(question, safeDraft);
    return evaluation.answered ? 'answered' : 'in-progress';
}

export function buildTopicPerformance(
    questions: ExamQuestion[],
    evaluations: QuestionEvaluation[],
    labels: Record<TopicId, string>,
): TopicPerformance[] {
    const bucket = new Map<TopicId, { score: number; maxScore: number }>();

    for (const question of questions) {
        const evaluation = evaluations.find((item) => item.questionId === question.id);
        if (!evaluation) continue;

        const weight = 1 / question.topics.length;
        for (const topic of question.topics) {
            const current = bucket.get(topic) || { score: 0, maxScore: 0 };
            current.score += evaluation.score * weight;
            current.maxScore += evaluation.maxScore * weight;
            bucket.set(topic, current);
        }
    }

    return [...bucket.entries()]
        .map(([topic, values]) => ({
            topic,
            label: labels[topic] || getTopicMeta(topic).label,
            score: values.score,
            maxScore: values.maxScore,
            ratio: values.maxScore ? values.score / values.maxScore : 0,
        }))
        .sort((left, right) => right.ratio - left.ratio);
}
