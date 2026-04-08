export type TopicId =
    | 'conjuntos'
    | 'intervalos'
    | 'dominio-imagem'
    | 'funcoes'
    | 'funcao-afim'
    | 'funcao-quadratica'
    | 'graficos'
    | 'composicao'
    | 'interpretacao-algebrica'
    | 'interpretacao-geometrica'
    | 'algebra'
    | 'conceitos';

export type Difficulty = 'base' | 'intermediario' | 'desafio';

export type ContentBlock =
    | {
          type: 'paragraph' | 'note';
          text: string;
      }
    | {
          type: 'bullets';
          items: string[];
      }
    | {
          type: 'equation';
          text: string;
      };

export type Checker =
    | {
          type: 'numeric';
          expected: number;
          tolerance?: number;
          aliases?: string[];
      }
    | {
          type: 'exact';
          accepted: string[];
      }
    | {
          type: 'keywords';
          required: string[];
          optional?: string[];
          minimumRequired?: number;
      };

export type FieldInput = 'text' | 'textarea' | 'toggle';

export interface AnswerField {
    key: string;
    label: string;
    input: FieldInput;
    placeholder?: string;
    helpText?: string;
    rows?: number;
    checker: Checker;
}

export interface AnswerGroup {
    key: string;
    label: string;
    prompt?: string;
    compact?: boolean;
    fields: AnswerField[];
}

export interface MatrixRow {
    key: string;
    label: string;
}

export interface MatrixColumn {
    key: string;
    label: string;
}

export interface MatrixSchema {
    kind: 'matrix';
    instructions: string;
    rows: MatrixRow[];
    columns: MatrixColumn[];
    trueLabel: string;
    falseLabel: string;
    expected: Record<string, Record<string, 'sim' | 'nao'>>;
}

export interface GroupSchema {
    kind: 'groups';
    instructions?: string;
    groups: AnswerGroup[];
}

export type AnswerSchema = GroupSchema | MatrixSchema;

export type GraphKey = 'interval-examples' | 'cost-line' | 'coffee-demand' | 'vehicle-depreciation' | 'quadratic-roots';

export interface SolutionDetail {
    answerSummary: string;
    steps: string[];
    graphComment?: string;
    studyTip: string;
}

export interface ExamQuestion {
    id: string;
    number: number;
    title: string;
    topics: TopicId[];
    difficulty: Difficulty;
    prompt: ContentBlock[];
    hint?: string;
    graphKey?: GraphKey;
    graphCaption?: string;
    answerSchema: AnswerSchema;
    solution: SolutionDetail;
}

export interface TopicMeta {
    label: string;
    short: string;
    summary: string;
    studyTips: string[];
}

export const TOPIC_META: Record<TopicId, TopicMeta> = {
    conjuntos: {
        label: 'Conjuntos',
        short: 'Conjuntos',
        summary: 'Leitura de conjuntos, uniao, intersecao, diferenca e contagem.',
        studyTips: [
            'Monte diagramas de Venn pequenos antes de substituir os numeros do enunciado.',
            'Revise o principio da inclusao-exclusao e confira se houve dupla contagem.',
        ],
    },
    intervalos: {
        label: 'Intervalos',
        short: 'Intervalos',
        summary: 'Leitura, notacao, operacoes e interpretacao na reta real.',
        studyTips: [
            'Treine a traducao entre desigualdade, intervalo e reta numerica.',
            'Lembre que infinito nunca fecha intervalo e que colchete indica extremo incluido.',
        ],
    },
    'dominio-imagem': {
        label: 'Dominio e Imagem',
        short: 'Dominio/Imagem',
        summary: 'Identificacao de entradas permitidas e valores produzidos.',
        studyTips: [
            'Verifique primeiro restricoes de raiz, denominador e definicao por partes.',
            'Depois de achar o dominio, observe o comportamento do grafico para decidir a imagem.',
        ],
    },
    funcoes: {
        label: 'Funcoes',
        short: 'Funcoes',
        summary: 'Leitura da lei de formacao, definicao por partes e inversa.',
        studyTips: [
            'Cheque sempre se cada x possui uma unica saida antes de chamar uma relacao de funcao.',
            'Para inversa, troque x por y, isole y e lembre que o dominio da inversa eh a imagem da original.',
        ],
    },
    'funcao-afim': {
        label: 'Funcao Afim',
        short: 'Afim',
        summary: 'Coeficiente angular, crescimento e interpretacao linear.',
        studyTips: [
            'Use dois pontos para achar a taxa de variacao e o intercepto.',
            'Se a reta sobe da esquerda para a direita, o coeficiente angular eh positivo.',
        ],
    },
    'funcao-quadratica': {
        label: 'Funcao Quadratica',
        short: 'Quadratica',
        summary: 'Parabola, vertices, maximos/minimos e leitura de raizes.',
        studyTips: [
            'Conecte as raizes ao fatorado e o vertice ao eixo de simetria.',
            'Em problemas de contexto, compare concavidade e instante do vertice antes de responder.',
        ],
    },
    graficos: {
        label: 'Graficos',
        short: 'Graficos',
        summary: 'Interpretacao de eixos, escala, pontos notaveis e tendencia.',
        studyTips: [
            'Leia primeiro os eixos e a escala antes de concluir qualquer valor.',
            'Use linhas-guia e pontos destacados para reconstruir a lei do grafico.',
        ],
    },
    composicao: {
        label: 'Composicao de Funcoes',
        short: 'Composicao',
        summary: 'Substituicao em cascata, ordem da composicao e funcao identidade.',
        studyTips: [
            'Em g o f, a funcao de dentro entra primeiro.',
            'Teste com um valor simples para verificar se a ordem da composicao foi respeitada.',
        ],
    },
    'interpretacao-algebrica': {
        label: 'Interpretacao Algebrica',
        short: 'Algebra',
        summary: 'Manipulacao simbolica, simplificacao, quadrados e expressoes.',
        studyTips: [
            'Ao simplificar, destaque fatores comuns antes de cortar termos.',
            'No completamento de quadrado, isole o coeficiente principal se ele for diferente de 1.',
        ],
    },
    'interpretacao-geometrica': {
        label: 'Interpretacao Geometrica',
        short: 'Geometrica',
        summary: 'Leitura visual da reta numerica, de curvas e do eixo de simetria.',
        studyTips: [
            'Observe abertura e fechamento de pontos para decidir pertinencia.',
            'Use o eixo de simetria como referencia para explicar crescimento e decrescimento.',
        ],
    },
    algebra: {
        label: 'Algebra',
        short: 'Algebra',
        summary: 'Expansao, fatoracao, racionalizacao e equivalencias.',
        studyTips: [
            'Revise produtos notaveis e o uso do conjugado em racionalizacao.',
            'Compare cada passo com o anterior para garantir que a expressao permaneceu equivalente.',
        ],
    },
    conceitos: {
        label: 'Conceitos Fundamentais',
        short: 'Conceitos',
        summary: 'Definicoes, exemplos e linguagem matematica precisa.',
        studyTips: [
            'Ao definir um conceito, inclua a ideia central e um exemplo curto.',
            'Diferencie dominio, contradominio e imagem em voz alta para fixar melhor.',
        ],
    },
};
