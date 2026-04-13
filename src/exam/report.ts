import type { PedagogicalFeedback } from './feedback';
import type { ExamDraftState, QuestionEvaluation, TopicPerformance } from './grading';
import { ensureDraft } from './grading';
import type { ExamDefinition } from './library';
import type { Difficulty, ExamQuestion, GraphKey, TopicId } from './model';
import { formatDuration, formatDurationLong, type ExamTimingSnapshot } from './timing';

export interface ExamReportSummary {
    totalQuestions: number;
    answeredCount: number;
    correctCount: number;
    partialCount: number;
    incorrectCount: number;
    blankCount: number;
    performanceRatio: number;
    totalTimeMs: number;
    averageTimePerQuestionMs: number;
    startedAt: string | null;
    completedAt: string | null;
    generatedAt: string;
}

export interface ExamReportQuestionEntry {
    questionId: string;
    questionNumber: number | string;
    title: string;
    shortPrompt: string;
    difficultyLabel: string;
    status: QuestionEvaluation['status'];
    statusLabel: string;
    score: number;
    maxScore: number;
    scoreRatio: number;
    studentAnswer: string;
    correctAnswer: string;
    timeMs: number;
    timeLabel: string;
    topics: string[];
    explanationSteps: string[];
    graphKey?: GraphKey;
    graphComment?: string;
    studyTip: string;
    scratchpad: string;
    fields: Array<{
        label: string;
        studentAnswer: string;
        expectedAnswer: string;
        score: number;
        maxScore: number;
    }>;
}

export interface ExamReportTopicEntry {
    topic: TopicId;
    label: string;
    correctCount: number;
    partialCount: number;
    incorrectCount: number;
    blankCount: number;
    totalQuestions: number;
    performanceRatio: number;
    totalTimeMs: number;
    averageTimeMs: number;
}

export interface ExamReportSlowQuestionEntry {
    questionNumber: number | string;
    title: string;
    timeMs: number;
    timeLabel: string;
    topics: string[];
}

export interface ExamReport {
    examId: string;
    attemptId: string;
    attemptNumber: number;
    title: string;
    subtitle: string;
    discipline: string;
    moduleLabel: string;
    semester: string;
    typeLabel: string;
    gradingMode: 'automatic' | 'manual';
    summary: ExamReportSummary;
    questions: ExamReportQuestionEntry[];
    topics: ExamReportTopicEntry[];
    slowestQuestions: ExamReportSlowQuestionEntry[];
    strongestTopics: string[];
    weakestTopics: string[];
    aiFeedback: PedagogicalFeedback | null;
}

function difficultyLabel(difficulty: Difficulty) {
    if (difficulty === 'base') return 'Base';
    if (difficulty === 'desafio') return 'Desafio';
    return 'Intermediaria';
}

export function statusLabel(status: QuestionEvaluation['status']) {
    if (status === 'answered') return 'Respondida';
    if (status === 'correct') return 'Acertou';
    if (status === 'partial') return 'Parcial';
    if (status === 'incorrect') return 'Errou';
    return 'Em branco';
}

export function formatReportDateTime(value: string | null) {
    if (!value) return 'Nao registrado';

    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value));
}

function contentBlocksToPlainText(question: ExamQuestion) {
    return question.prompt
        .map((block) => (block.type === 'bullets' ? block.items.join(' ') : block.text))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function summarizeStudentAnswer(evaluation: QuestionEvaluation) {
    const answeredFields = evaluation.fields.filter((field) => field.studentAnswer.trim());
    if (!answeredFields.length) return 'Em branco';
    return answeredFields.map((field) => `${field.label}: ${field.studentAnswer}`).join(' | ');
}

function buildTopicQuestionBuckets(questions: ExamQuestion[]) {
    return new Map<string, ExamQuestion>(questions.map((question) => [question.id, question]));
}

export function buildExamReport({
    exam,
    attemptId,
    attemptNumber,
    questions,
    evaluations,
    drafts,
    topicPerformance,
    timing,
    topicLabels,
    aiFeedback,
    generatedAt,
}: {
    exam: ExamDefinition;
    attemptId: string;
    attemptNumber: number;
    questions: ExamQuestion[];
    evaluations: QuestionEvaluation[];
    drafts: ExamDraftState;
    topicPerformance: TopicPerformance[];
    timing: ExamTimingSnapshot;
    topicLabels: Record<TopicId, string>;
    aiFeedback: PedagogicalFeedback | null;
    generatedAt?: string;
}): ExamReport {
    const questionMap = buildTopicQuestionBuckets(questions);
    const manualGrading = exam.gradingMode === 'manual';
    const answeredCount = evaluations.filter((evaluation) => evaluation.answered).length;
    const correctCount = evaluations.filter((evaluation) => (manualGrading ? evaluation.status === 'answered' : evaluation.status === 'correct')).length;
    const partialCount = manualGrading ? 0 : evaluations.filter((evaluation) => evaluation.status === 'partial').length;
    const incorrectCount = manualGrading ? 0 : evaluations.filter((evaluation) => evaluation.status === 'incorrect').length;
    const blankCount = evaluations.filter((evaluation) => evaluation.status === 'blank').length;
    const totalScore = evaluations.reduce((sum, evaluation) => sum + evaluation.score, 0);
    const totalMax = evaluations.reduce((sum, evaluation) => sum + evaluation.maxScore, 0);
    const performanceRatio = totalMax ? totalScore / totalMax : 0;
    const totalTimeMs = timing.totalElapsedMs;
    const averageTimePerQuestionMs = questions.length ? totalTimeMs / questions.length : 0;

    const questionEntries: ExamReportQuestionEntry[] = evaluations.map((evaluation) => {
        const question = questionMap.get(evaluation.questionId)!;
        const draft = ensureDraft(drafts[question.id]);
        const timeMs = timing.questionElapsedMs[question.id] || 0;
        return {
            questionId: question.id,
            questionNumber: question.number,
            title: question.title,
            shortPrompt: contentBlocksToPlainText(question),
            difficultyLabel: difficultyLabel(question.difficulty),
            status: evaluation.status,
            statusLabel: statusLabel(evaluation.status),
            score: evaluation.score,
            maxScore: evaluation.maxScore,
            scoreRatio: evaluation.ratio,
            studentAnswer: summarizeStudentAnswer(evaluation),
            correctAnswer: question.solution.answerSummary,
            timeMs,
            timeLabel: formatDuration(timeMs),
            topics: question.topics.map((topic) => topicLabels[topic] || topic),
            explanationSteps: question.solution.steps,
            graphKey: question.graphKey,
            graphComment: question.solution.graphComment,
            studyTip: question.solution.studyTip,
            scratchpad: draft.scratch.trim(),
            fields: evaluation.fields.map((field) => ({
                label: field.label,
                studentAnswer: field.studentAnswer || 'Em branco',
                expectedAnswer: field.expectedAnswer,
                score: field.score,
                maxScore: field.maxScore,
            })),
        };
    });

    const topicEntries: ExamReportTopicEntry[] = topicPerformance.map((topic) => {
        const relatedQuestions = questions.filter((question) => question.topics.includes(topic.topic));
        const relatedEvaluations = evaluations.filter((evaluation) => relatedQuestions.some((question) => question.id === evaluation.questionId));
        const totalTimeForTopic = relatedQuestions.reduce((sum, question) => {
            const questionTime = timing.questionElapsedMs[question.id] || 0;
            return sum + questionTime / question.topics.length;
        }, 0);

        return {
            topic: topic.topic,
            label: topic.label,
            correctCount: relatedEvaluations.filter((evaluation) => (manualGrading ? evaluation.status === 'answered' : evaluation.status === 'correct')).length,
            partialCount: manualGrading ? 0 : relatedEvaluations.filter((evaluation) => evaluation.status === 'partial').length,
            incorrectCount: manualGrading ? 0 : relatedEvaluations.filter((evaluation) => evaluation.status === 'incorrect').length,
            blankCount: relatedEvaluations.filter((evaluation) => evaluation.status === 'blank').length,
            totalQuestions: relatedQuestions.length,
            performanceRatio: topic.ratio,
            totalTimeMs: totalTimeForTopic,
            averageTimeMs: relatedQuestions.length ? totalTimeForTopic / relatedQuestions.length : 0,
        };
    });

    const slowestQuestions = [...questionEntries]
        .sort((left, right) => right.timeMs - left.timeMs)
        .slice(0, 5)
        .map((entry) => ({
            questionNumber: entry.questionNumber,
            title: entry.title,
            timeMs: entry.timeMs,
            timeLabel: formatDuration(entry.timeMs),
            topics: entry.topics,
        }));

    const strongestTopics = [...topicEntries]
        .sort((left, right) => right.performanceRatio - left.performanceRatio)
        .slice(0, 3)
        .map((topic) => topic.label);

    const weakestTopics = [...topicEntries]
        .sort((left, right) => left.performanceRatio - right.performanceRatio)
        .slice(0, 3)
        .map((topic) => topic.label);

    return {
        examId: exam.id,
        attemptId,
        attemptNumber,
        title: exam.title,
        subtitle: exam.subtitle,
        discipline: exam.discipline,
        moduleLabel: exam.moduleLabel,
        semester: exam.semester,
        typeLabel: exam.typeLabel,
        gradingMode: manualGrading ? 'manual' : 'automatic',
        summary: {
            totalQuestions: questions.length,
            answeredCount,
            correctCount,
            partialCount,
            incorrectCount,
            blankCount,
            performanceRatio,
            totalTimeMs,
            averageTimePerQuestionMs,
            startedAt: timing.startedAt,
            completedAt: timing.completedAt,
            generatedAt: generatedAt || timing.completedAt || timing.startedAt || new Date().toISOString(),
        },
        questions: questionEntries,
        topics: topicEntries,
        slowestQuestions,
        strongestTopics,
        weakestTopics,
        aiFeedback,
    };
}

export function buildTimeHighlights(report: ExamReport) {
    const slowest = report.slowestQuestions[0];
    const slowestTopic = [...report.topics].sort((left, right) => right.totalTimeMs - left.totalTimeMs)[0];

    return {
        totalTimeLabel: formatDurationLong(report.summary.totalTimeMs),
        averageTimeLabel: formatDurationLong(report.summary.averageTimePerQuestionMs),
        slowestQuestionLabel: slowest ? `Questao ${slowest.questionNumber} (${slowest.timeLabel})` : 'Nao registrado',
        slowestTopicLabel: slowestTopic ? `${slowestTopic.label} (${formatDurationLong(slowestTopic.totalTimeMs)})` : 'Nao registrado',
    };
}
