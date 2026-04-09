import type { ExamQuestion, TopicId } from './model';
import { TOPIC_META } from './model';
import type { QuestionEvaluation, TopicPerformance } from './grading';

export interface PedagogicalFeedback {
    overview: string;
    strengths: string[];
    focusAreas: string[];
    errorPatterns: string[];
    timeInsights: string[];
    studyPlan: string[];
    encouragement: string;
}

export function buildLocalPedagogicalFeedback({
    questions,
    evaluations,
    topicPerformance,
    slowestQuestions,
    slowestTopics,
}: {
    questions: ExamQuestion[];
    evaluations: QuestionEvaluation[];
    topicPerformance: TopicPerformance[];
    slowestQuestions: Array<{ number: number; title: string; timeLabel: string }>;
    slowestTopics: Array<{ label: string; timeLabel: string }>;
}): PedagogicalFeedback {
    const strongestTopics = topicPerformance.slice(0, 2);
    const weakestTopics = [...topicPerformance].sort((left, right) => left.ratio - right.ratio).slice(0, 3);

    const hardestQuestions = evaluations
        .filter((item) => item.answered && item.ratio < 1)
        .sort((left, right) => left.ratio - right.ratio)
        .slice(0, 3)
        .map((evaluation) => questions.find((question) => question.id === evaluation.questionId))
        .filter((question): question is ExamQuestion => Boolean(question));

    const overview =
        strongestTopics.length && weakestTopics.length
            ? `Seu desempenho mostra base melhor em ${strongestTopics.map((item) => item.label.toLowerCase()).join(' e ')}, com mais espaco para evoluir em ${weakestTopics[0].label.toLowerCase()}.`
            : 'Seu resultado ja permite identificar temas fortes e pontos que precisam de revisao mais focada.';

    const strengths = strongestTopics.map((item) => {
        const meta = TOPIC_META[item.topic];
        return `${meta.label}: ${(item.ratio * 100).toFixed(0)}% de aproveitamento. ${meta.summary}`;
    });

    const focusAreas = weakestTopics.map((item) => {
        const meta = TOPIC_META[item.topic];
        return `${meta.label}: ${(item.ratio * 100).toFixed(0)}% de aproveitamento. ${meta.studyTips[0]}`;
    });

    const errorPatterns = hardestQuestions.length
        ? hardestQuestions.map((question) => {
              const primaryTopic = question.topics[0] as TopicId;
              return `Questao ${question.number}: revise ${TOPIC_META[primaryTopic].label.toLowerCase()} e confira ${question.solution.studyTip.toLowerCase()}`;
          })
        : ['Voce concluiu a prova sem erros objetivos relevantes. Vale revisar as justificativas do rascunho para consolidar o raciocinio.'];

    const studyPlan = weakestTopics.flatMap((item) => TOPIC_META[item.topic].studyTips).slice(0, 4);
    const timeInsights = [
        slowestQuestions[0]
            ? `A questao ${slowestQuestions[0].number} consumiu mais tempo (${slowestQuestions[0].timeLabel}), entao vale revisar o tipo de raciocinio pedido nela.`
            : '',
        slowestTopics[0]
            ? `O assunto em que voce mais gastou tempo foi ${slowestTopics[0].label.toLowerCase()} (${slowestTopics[0].timeLabel}), o que sugere mais esforco de interpretacao ou calculo.`
            : '',
        'Use o tempo das questoes mais lentas para decidir o que revisar primeiro: clareza de leitura, estrategia de conta ou leitura de grafico.',
    ].filter(Boolean);

    return {
        overview,
        strengths,
        focusAreas,
        errorPatterns,
        timeInsights,
        studyPlan,
        encouragement:
            'Seu resultado nao define sua capacidade; ele mostra onde o estudo rende mais agora. Revise um tema por vez, compare com as resolucoes e volte nas questoes marcadas para revisar.',
    };
}
