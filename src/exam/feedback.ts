import { TOPIC_META } from './model';
import type { ExamReport, ExamReportQuestionEntry, ExamReportTopicEntry } from './report';
import { formatDurationLong } from './timing';

export interface PedagogicalFeedback {
    overview: string;
    strengths: string[];
    focusAreas: string[];
    errorPatterns: string[];
    timeInsights: string[];
    studyPlan: string[];
    encouragement: string;
}

function listQuestionNumbers(questions: ExamReportQuestionEntry[]) {
    return questions.map((question) => question.questionNumber).join(', ');
}

function strongestTopics(topics: ExamReportTopicEntry[]) {
    return [...topics].sort((left, right) => right.performanceRatio - left.performanceRatio).slice(0, 2);
}

function weakestTopics(topics: ExamReportTopicEntry[]) {
    return [...topics].sort((left, right) => left.performanceRatio - right.performanceRatio).slice(0, 3);
}

function rushedQuestions(report: ExamReport) {
    const average = report.summary.averageTimePerQuestionMs || 0;
    return report.questions
        .filter((question) => question.status !== 'correct' && average > 0 && question.timeMs > 0 && question.timeMs < average * 0.55)
        .slice(0, 3);
}

function blankQuestions(report: ExamReport) {
    return report.questions.filter((question) => question.status === 'blank').slice(0, 4);
}

function hardestQuestions(report: ExamReport) {
    return [...report.questions]
        .filter((question) => question.status !== 'correct')
        .sort((left, right) => left.scoreRatio - right.scoreRatio || right.timeMs - left.timeMs)
        .slice(0, 4);
}

function buildStrengthItems(report: ExamReport) {
    return strongestTopics(report.topics).map((topic) => {
        const relatedCorrect = report.questions
            .filter((question) => question.status === 'correct' && question.topics.includes(topic.label))
            .slice(0, 3);
        const evidence = relatedCorrect.length ? `Questoes ${listQuestionNumbers(relatedCorrect)} ajudam a confirmar esse dominio.` : '';
        return `${topic.label}: ${(topic.performanceRatio * 100).toFixed(0)}% de aproveitamento em ${topic.totalQuestions} questoes, com ${formatDurationLong(topic.totalTimeMs)} dedicados ao assunto. ${evidence}`.trim();
    });
}

function buildFocusItems(report: ExamReport) {
    return weakestTopics(report.topics).map((topic) => {
        const relatedQuestions = report.questions
            .filter((question) => question.topics.includes(topic.label) && question.status !== 'correct')
            .slice(0, 4);
        const questionLabel = relatedQuestions.length ? `As questoes ${listQuestionNumbers(relatedQuestions)} concentraram esse gap.` : '';
        const meta = Object.values(TOPIC_META).find((item) => item.label === topic.label);
        return `${topic.label}: ${(topic.performanceRatio * 100).toFixed(0)}% de aproveitamento, com ${topic.incorrectCount} erros e ${topic.blankCount} em branco. ${questionLabel} ${meta?.studyTips[0] || ''}`.trim();
    });
}

function buildErrorItems(report: ExamReport) {
    const hardest = hardestQuestions(report);
    const blanks = blankQuestions(report);
    const rushed = rushedQuestions(report);
    const items: string[] = [];

    if (hardest.length) {
        items.push(
            `Os maiores desvios apareceram nas questoes ${listQuestionNumbers(hardest)}: nelas, a resposta ficou parcial ou incorreta mesmo com ${hardest
                .map((question) => formatDurationLong(question.timeMs))
                .join(', ')} de dedicacao.`,
        );
    }

    if (blanks.length) {
        items.push(
            `Houve questoes em branco (${listQuestionNumbers(blanks)}), o que indica perda de resposta final mesmo quando o aluno ja tinha passado por esses enunciados.`,
        );
    }

    if (rushed.length) {
        items.push(
            `Nas questoes ${listQuestionNumbers(rushed)}, o tempo ficou bem abaixo da media e o resultado nao foi correto, sinal de resposta precipitada ou leitura incompleta.`,
        );
    }

    if (!items.length) {
        items.push('Nao houve um padrao de erro dominante; o principal ganho agora vem de revisar os passos das questoes mais lentas para consolidar o metodo.');
    }

    return items.slice(0, 4);
}

function buildTimeItems(report: ExamReport) {
    const slowestQuestions = report.slowestQuestions.slice(0, 3);
    const slowestTopics = [...report.topics].sort((left, right) => right.totalTimeMs - left.totalTimeMs).slice(0, 2);
    const items: string[] = [];

    if (slowestQuestions.length) {
        items.push(
            `As questoes ${slowestQuestions.map((question) => `${question.questionNumber} (${question.timeLabel})`).join(', ')} consumiram mais tempo e merecem revisao do raciocinio usado.`,
        );
    }

    if (slowestTopics.length) {
        items.push(
            `O maior custo de tempo ficou em ${slowestTopics
                .map((topic) => `${topic.label} (${formatDurationLong(topic.totalTimeMs)})`)
                .join(' e ')}, o que sugere gargalo conceitual ou excesso de conta nesses blocos.`,
        );
    }

    const balancedTopic = [...report.topics].sort((left, right) => right.performanceRatio - left.performanceRatio)[0];
    if (balancedTopic) {
        items.push(
            `${balancedTopic.label} foi o assunto com melhor relacao entre desempenho e tempo, entao pode servir como referencia de metodo para as proximas tentativas.`,
        );
    }

    return items.slice(0, 4);
}

function buildStudyPlan(report: ExamReport) {
    return weakestTopics(report.topics).map((topic, index) => {
        const meta = Object.values(TOPIC_META).find((item) => item.label === topic.label);
        const related = report.questions.filter((question) => question.topics.includes(topic.label) && question.status !== 'correct').slice(0, 3);
        const questionLabel = related.length ? `Revise primeiro as questoes ${listQuestionNumbers(related)}.` : '';
        const firstStep = meta?.studyTips[index % (meta?.studyTips.length || 1)] || 'Compare a sua resposta com a resolucao comentada e refaca a conta sem consultar o gabarito.';
        return `${topic.label}: ${questionLabel} ${firstStep}`.trim();
    });
}

function normalizeFeedbackText(value: string) {
    return value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
}

export function isPedagogicalFeedbackSpecific(feedback: PedagogicalFeedback, report: ExamReport) {
    const combinedText = normalizeFeedbackText(
        [
            feedback.overview,
            ...feedback.strengths,
            ...feedback.focusAreas,
            ...feedback.errorPatterns,
            ...feedback.timeInsights,
            ...feedback.studyPlan,
            feedback.encouragement,
        ].join(' '),
    );

    const questionMentions = combinedText.match(/questa?o\s+\d+/g)?.length || 0;
    const topicMentions = report.topics.filter((topic) => combinedText.includes(normalizeFeedbackText(topic.label))).length;
    const timeMentions =
        (combinedText.match(/\b\d+h\b/g)?.length || 0) +
        (combinedText.match(/\b\d+min\b/g)?.length || 0) +
        (combinedText.match(/\b\d+s\b/g)?.length || 0);
    const genericPenalty = [
        'grande potencial',
        'fase inicial',
        'continue estudando',
        'base solida',
        'segue evoluindo',
    ].filter((phrase) => combinedText.includes(phrase)).length;

    const mentionsWeakTopic = weakestTopics(report.topics).some((topic) => combinedText.includes(normalizeFeedbackText(topic.label)));
    const mentionsAnyWrongQuestion = report.questions
        .filter((question) => question.status !== 'correct')
        .some((question) => combinedText.includes(`questao ${question.questionNumber}`));

    return questionMentions + topicMentions + timeMentions >= 4 && mentionsWeakTopic && mentionsAnyWrongQuestion && genericPenalty < 2;
}

export function buildLocalPedagogicalFeedback(report: ExamReport): PedagogicalFeedback {
    const strongTopics = strongestTopics(report.topics);
    const weakTopics = weakestTopics(report.topics);
    const hardest = hardestQuestions(report);
    const blankCount = report.summary.blankCount;

    const overview =
        strongTopics.length && weakTopics.length
            ? `Voce concluiu a tentativa ${report.attemptNumber} com ${(report.summary.performanceRatio * 100).toFixed(0)}% de aproveitamento. O desempenho ficou mais consistente em ${strongTopics
                  .map((topic) => topic.label.toLowerCase())
                  .join(' e ')}, enquanto ${weakTopics[0].label.toLowerCase()} concentrou a maior parte dos erros${blankCount ? ` e ${blankCount} respostas em branco` : ''}.`
            : `Voce concluiu a tentativa ${report.attemptNumber} com ${(report.summary.performanceRatio * 100).toFixed(0)}% de aproveitamento e ja ha dados suficientes para priorizar a revisao.`;

    const strongestEvidence = hardest.length
        ? `As maiores travas apareceram nas questoes ${listQuestionNumbers(hardest)}, entao vale comecar por elas.`
        : 'Nao houve erro persistente em um grupo pequeno de questoes.';

    return {
        overview,
        strengths: buildStrengthItems(report),
        focusAreas: buildFocusItems(report),
        errorPatterns: buildErrorItems(report),
        timeInsights: buildTimeItems(report),
        studyPlan: buildStudyPlan(report).slice(0, 4),
        encouragement: `${strongestEvidence} O objetivo agora nao e estudar tudo de novo, e sim atacar primeiro o que mais pesou em tempo e aproveitamento para ganhar clareza na proxima tentativa.`,
    };
}
