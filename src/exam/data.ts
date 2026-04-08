import type { AnswerField, AnswerGroup, ExamQuestion } from './model';

const ALL_REALS = ['R', 'ℝ', '(-∞,+∞)', '(-∞,∞)', 'todos os reais'];
const NON_NEGATIVE = ['[0,+∞)', '[0,∞)', 'x>=0', 'x≥0'];
const POSITIVE = ['(0,+∞)', '(0,∞)', 'x>0'];
const DOMAIN_EXCEPT_ONE = ['R-{1}', 'ℝ-{1}', 'x!=1', 'x≠1', '(-∞,1)u(1,+∞)', '(-∞,1)u(1,∞)'];
const INTERVAL_EMPTY = ['∅', 'vazio', '{}'];
const DOMAIN_TO_13_12 = ['(-∞,13/12]', 'y<=13/12', 'x<=13/12', '(-∞,1.0833333333]'];
const FROM_ZERO = ['[0,+∞)', '[0,∞)', 'x>=0', 'x≥0'];
const FROM_THREE = ['(3,+∞)', '(3,∞)', 'x>3'];

function textField(
    key: string,
    label: string,
    accepted: string[],
    placeholder?: string,
    helpText?: string,
): AnswerField {
    return {
        key,
        label,
        input: 'text',
        placeholder,
        helpText,
        checker: {
            type: 'exact',
            accepted,
        },
    };
}

function numericField(
    key: string,
    label: string,
    expected: number,
    placeholder?: string,
    aliases?: string[],
    tolerance?: number,
): AnswerField {
    return {
        key,
        label,
        input: 'text',
        placeholder,
        checker: {
            type: 'numeric',
            expected,
            aliases,
            tolerance,
        },
    };
}

function toggleField(key: string, label: string, expected: 'V' | 'F' | 'sim' | 'nao'): AnswerField {
    return {
        key,
        label,
        input: 'toggle',
        checker: {
            type: 'exact',
            accepted: [expected],
        },
    };
}

function textareaKeywordsField(
    key: string,
    label: string,
    required: string[],
    optional: string[] = [],
    minimumRequired?: number,
): AnswerField {
    return {
        key,
        label,
        input: 'textarea',
        rows: 3,
        placeholder: 'Escreva sua definicao e um exemplo curto.',
        checker: {
            type: 'keywords',
            required,
            optional,
            minimumRequired,
        },
    };
}

function group(key: string, label: string, fields: AnswerField[], prompt?: string, compact = false): AnswerGroup {
    return { key, label, prompt, compact, fields };
}

export const EXAM_QUESTIONS: ExamQuestion[] = [
    {
        id: 'q1',
        number: 1,
        title: 'Linhas de onibus e diagramas de Venn',
        topics: ['conjuntos', 'interpretacao-algebrica'],
        difficulty: 'intermediario',
        prompt: [
            {
                type: 'paragraph',
                text: 'Numa cidade com tres linhas de transporte publico - Azul, Verde e Amarela -, uma pesquisa com 200 pessoas levantou os dados abaixo.',
            },
            {
                type: 'bullets',
                items: [
                    '80 usam a linha Azul.',
                    '72 usam a linha Verde.',
                    '43 usam a linha Amarela.',
                    '35 usam Azul e Verde.',
                    '37 usam Azul e Amarela.',
                    '28 usam Verde e Amarela.',
                    '80 nao usam transporte publico.',
                ],
            },
        ],
        hint: 'Comece pelo total que usa transporte publico e depois aplique inclusao-exclusao para achar a intersecao tripla.',
        answerSchema: {
            kind: 'groups',
            instructions: 'Preencha apenas os valores finais de cada item.',
            groups: [
                group('q1-answers', 'Respostas', [
                    numericField('q1-a', 'a) Pessoas que usam transporte publico', 120, 'Ex.: 120'),
                    numericField('q1-b', 'b) Pessoas que usam as tres linhas', 25, 'Ex.: 25'),
                    numericField('q1-c', 'c) Nao usam Azul e usam Amarela', 18, 'Ex.: 18'),
                    numericField('q1-d', 'd) Nao usam Azul e nao usam Verde', 83, 'Ex.: 83'),
                ]),
            ],
        },
        solution: {
            answerSummary: 'a) 120, b) 25, c) 18, d) 83.',
            steps: [
                'Como 80 pessoas nao usam transporte publico, 200 - 80 = 120 usam pelo menos uma linha.',
                'Pela inclusao-exclusao: 120 = 80 + 72 + 43 - 35 - 37 - 28 + x, logo x = 25.',
                'Quem usa Amarela e nao usa Azul: 43 - 25 = 18.',
                'Quem nao usa Azul nem Verde eh o complemento de Azul uniao Verde: 200 - (80 + 72 - 35) = 83.',
            ],
            studyTip: 'Sempre calcule a uniao primeiro e deixe a intersecao tripla como incognita quando o enunciado nao a informa.',
        },
    },
    {
        id: 'q2',
        number: 2,
        title: 'Pesquisa de mercado com tres sabores',
        topics: ['conjuntos', 'interpretacao-algebrica'],
        difficulty: 'intermediario',
        prompt: [
            {
                type: 'paragraph',
                text: 'Uma pesquisa com 1.000 consumidores avaliou preferencia por sorvetes de morango, chocolate e creme.',
            },
            {
                type: 'bullets',
                items: [
                    '370 gostam de morango.',
                    '300 gostam de chocolate.',
                    '360 gostam de creme.',
                    '100 gostam de morango e chocolate.',
                    '60 gostam de morango e creme.',
                    '30 gostam de chocolate e creme.',
                    '20 gostam dos tres sabores.',
                ],
            },
        ],
        hint: 'Monte a uniao dos tres conjuntos antes de procurar quem ficou fora dela.',
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q2-answers', 'Respostas', [
                    numericField('q2-a', 'a) Consumidores que nao gostam de nenhum sabor', 140, 'Ex.: 140'),
                    numericField('q2-b', 'b) Gostam de chocolate e nao gostam de morango', 200, 'Ex.: 200'),
                    numericField('q2-c', 'c) Nao gostam de creme e nao gostam de chocolate', 370, 'Ex.: 370'),
                ]),
            ],
        },
        solution: {
            answerSummary: 'a) 140, b) 200, c) 370.',
            steps: [
                'A uniao vale 370 + 300 + 360 - 100 - 60 - 30 + 20 = 860.',
                'Logo, 1000 - 860 = 140 nao gostam de nenhum dos tres sabores.',
                'Chocolate sem morango: 300 - 100 = 200.',
                'Quem nao gosta de creme nem de chocolate esta fora de C uniao Ch: 1000 - (360 + 300 - 30) = 370.',
            ],
            studyTip: 'Em problemas de preferencia, releia cada item para saber se a intersecao dada ja inclui quem gosta dos tres.',
        },
    },
    {
        id: 'q3',
        number: 3,
        title: 'Pertinencia em intervalos',
        topics: ['intervalos', 'interpretacao-geometrica'],
        difficulty: 'base',
        prompt: [
            {
                type: 'paragraph',
                text: 'Verifique se os numeros $5$, $\\pi$, $\\sqrt{5}$, $-0,2$ e $5/2$ pertencem aos intervalos abaixo.',
            },
            {
                type: 'bullets',
                items: ['A = [-2, 5)', 'B = (2, 7)', 'C = (6, +∞)'],
            },
        ],
        hint: 'Olhe com cuidado para as pontas abertas e fechadas antes de decidir se o numero entra no intervalo.',
        answerSchema: {
            kind: 'matrix',
            instructions: 'Marque se cada numero pertence ou nao a cada intervalo.',
            trueLabel: 'Pertence',
            falseLabel: 'Nao pertence',
            rows: [
                { key: 'A', label: 'A = [-2, 5)' },
                { key: 'B', label: 'B = (2, 7)' },
                { key: 'C', label: 'C = (6, +∞)' },
            ],
            columns: [
                { key: '5', label: '5' },
                { key: 'pi', label: 'π' },
                { key: 'sqrt5', label: '√5' },
                { key: 'neg0_2', label: '-0,2' },
                { key: '5_2', label: '5/2' },
            ],
            expected: {
                A: { '5': 'nao', pi: 'sim', sqrt5: 'sim', neg0_2: 'sim', '5_2': 'sim' },
                B: { '5': 'sim', pi: 'sim', sqrt5: 'sim', neg0_2: 'nao', '5_2': 'sim' },
                C: { '5': 'nao', pi: 'nao', sqrt5: 'nao', neg0_2: 'nao', '5_2': 'nao' },
            },
        },
        solution: {
            answerSummary:
                'Em A entram π, √5, -0,2 e 5/2. Em B entram 5, π, √5 e 5/2. Em C nenhum dos cinco numeros pertence.',
            steps: [
                'A inclui -2 e vai ate 5 sem incluir o 5, por isso o numero 5 fica de fora.',
                'B aceita apenas valores maiores que 2 e menores que 7.',
                'C so aceita valores estritamente maiores que 6, entao nenhum dos numeros listados passa.',
            ],
            studyTip: 'Transforme rapidamente cada numero em valor aproximado quando houver raiz ou pi para comparar com a reta real.',
        },
    },
    {
        id: 'q4',
        number: 4,
        title: 'Operacoes com intervalos',
        topics: ['intervalos', 'conjuntos'],
        difficulty: 'intermediario',
        prompt: [
            { type: 'paragraph', text: 'Considere os intervalos abaixo e determine as operacoes pedidas.' },
            { type: 'bullets', items: ['A = [-2, 5]', 'B = (2, 7)', 'C = (6, +∞)'] },
        ],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q4-answers', 'Intervalos resultantes', [
                    textField('q4-a', 'a) A ∩ C', INTERVAL_EMPTY, 'Ex.: ∅'),
                    textField('q4-b', 'b) A ∩ B', ['(2,5]'], 'Ex.: (2,5]'),
                    textField('q4-c', 'c) A - B', ['[-2,2]'], 'Ex.: [-2,2]'),
                    textField('q4-d', 'd) A ∪ C', ['[-2,5]u(6,+∞)', '[-2,5]u(6,∞)'], 'Ex.: [-2,5]∪(6,+∞)'),
                    textField('q4-e', 'e) (A ∪ C) ∩ B', ['(2,5]u(6,7)'], 'Ex.: (2,5]∪(6,7)'),
                    textField('q4-f', 'f) (A - C) ∩ B', ['(2,5]'], 'Ex.: (2,5]'),
                ]),
            ],
        },
        solution: {
            answerSummary: 'a) ∅, b) (2,5], c) [-2,2], d) [-2,5] ∪ (6,+∞), e) (2,5] ∪ (6,7), f) (2,5].',
            steps: [
                'A e C nao se encostam, entao a intersecao eh vazia.',
                'A com B coincide apenas na parte entre 2 e 5, aberta em 2 e fechada em 5.',
                'Na uniao, os intervalos ficam separados porque ha um buraco entre 5 e 6.',
                'Como A e C sao disjuntos, A - C = A; por isso o item f repete a intersecao de A com B.',
            ],
            studyTip: 'Desenhar a reta real evita erros de extremo quando a operacao mistura uniao, intersecao e diferenca.',
        },
    },
    {
        id: 'q5',
        number: 5,
        title: 'Traducao verbal para intervalos',
        topics: ['intervalos', 'interpretacao-geometrica'],
        difficulty: 'base',
        prompt: [
            {
                type: 'paragraph',
                text: 'Traduza cada descricao verbal para notacao de intervalos e depois use o rascunho para imaginar a reta numerica correspondente.',
            },
        ],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q5-answers', 'Notacao pedida', [
                    textField('q5-a', 'a) Maiores que -3 e menores que 1', ['(-3,1)'], 'Ex.: (-3,1)'),
                    textField('q5-b', 'b) Menores ou iguais a -4', ['(-∞,-4]', '(-inf,-4]'], 'Ex.: (-∞,-4]'),
                    textField('q5-c', 'c) Maiores que -1 ou menores que -3', ['(-∞,-3)u(-1,+∞)', '(-∞,-3)u(-1,∞)'], 'Ex.: (-∞,-3)∪(-1,+∞)'),
                ]),
            ],
        },
        solution: {
            answerSummary: 'a) (-3,1), b) (-∞,-4], c) (-∞,-3) ∪ (-1,+∞).',
            steps: [
                '“Maior que” e “menor que” pedem extremidades abertas.',
                '“Menor ou igual” pede colchete no extremo -4.',
                'A palavra “ou” indica uniao de dois intervalos separados.',
            ],
            studyTip: 'Associe as palavras-chave do enunciado a simbolos: “ou” vira uniao e “e” vira intersecao de restricoes.',
        },
    },
    {
        id: 'q6',
        number: 6,
        title: 'Representacao grafica de intervalos',
        topics: ['intervalos', 'interpretacao-geometrica'],
        difficulty: 'base',
        prompt: [
            {
                type: 'paragraph',
                text: 'Use o rascunho para desenhar as retas numericas e registre a notacao equivalente de cada uma para validar a sua leitura.',
            },
        ],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q6-answers', 'Intervalos equivalentes', [
                    textField('q6-a', 'a) {x ∈ R | -1 < x < 3}', ['(-1,3)'], 'Ex.: (-1,3)'),
                    textField('q6-b', 'b) (-∞, 2]', ['(-∞,2]', '(-inf,2]'], 'Ex.: (-∞,2]'),
                    textField('q6-c', 'c) [-3, 1/2]', ['[-3,1/2]', '[-3,0.5]'], 'Ex.: [-3,1/2]'),
                    textField('q6-d', 'd) {x ∈ R | 2 ≤ x < 7}', ['[2,7)'], 'Ex.: [2,7)'),
                    textField('q6-e', 'e) {x ∈ R | x < 4}', ['(-∞,4)', '(-inf,4)'], 'Ex.: (-∞,4)'),
                    textField('q6-f', 'f) [0, 6)', ['[0,6)'], 'Ex.: [0,6)'),
                ]),
            ],
        },
        solution: {
            answerSummary: 'a) (-1,3), b) (-∞,2], c) [-3,1/2], d) [2,7), e) (-∞,4), f) [0,6).',
            steps: [
                'Os itens a, d e e traduzem desigualdades diretamente para a reta numerica.',
                'Quando aparece infinito, sempre use parenteses porque o infinito nao eh extremo atingido.',
                'No item c, o ponto 1/2 fica fechado porque ele esta incluido no intervalo.',
            ],
            studyTip: 'Treine ir e voltar entre desigualdade e notacao para ganhar velocidade na leitura da reta numerica.',
        },
    },
    {
        id: 'q7',
        number: 7,
        title: 'Lendo graficos de intervalos',
        topics: ['intervalos', 'graficos', 'interpretacao-geometrica'],
        difficulty: 'base',
        graphKey: 'interval-examples',
        graphCaption: 'Graficos reconstruidos da reta numerica da questao 7.',
        prompt: [
            {
                type: 'paragraph',
                text: 'Observe cada representacao grafica e escreva a notacao de intervalos correspondente.',
            },
        ],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q7-answers', 'Notacao dos intervalos', [
                    textField('q7-a', 'a)', ['[-4,2]'], 'Ex.: [-4,2]'),
                    textField('q7-b', 'b)', ['(1,+∞)', '(1,∞)'], 'Ex.: (1,+∞)'),
                    textField('q7-c', 'c)', ['(-3,3)'], 'Ex.: (-3,3)'),
                    textField('q7-d', 'd)', ['(0,2]'], 'Ex.: (0,2]'),
                    textField('q7-e', 'e)', ['(-∞,1]', '(-inf,1]'], 'Ex.: (-∞,1]'),
                ]),
            ],
        },
        solution: {
            answerSummary: 'a) [-4,2], b) (1,+∞), c) (-3,3), d) (0,2], e) (-∞,1].',
            steps: [
                'Ponto preenchido indica extremo incluido; ponto vazado indica extremo excluido.',
                'Quando o segmento segue indefinidamente para um lado, usamos infinito com parenteses.',
                'No item d, so o extremo direito 2 esta incluido.',
            ],
            graphComment: 'Os cinco graficos foram refeitos em SVG para manter pontos abertos/fechados legiveis no mobile e no desktop.',
            studyTip: 'Antes de escrever o intervalo, diga em voz alta se cada ponta esta aberta ou fechada.',
        },
    },
    {
        id: 'q8',
        number: 8,
        title: 'Operacoes com dois intervalos fechados',
        topics: ['intervalos', 'conjuntos'],
        difficulty: 'base',
        prompt: [{ type: 'paragraph', text: 'Dados A = [2,4] e B = [3,6], calcule as operacoes pedidas.' }],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q8-answers', 'Resultados', [
                    textField('q8-a', 'A ∩ B', ['[3,4]'], 'Ex.: [3,4]'),
                    textField('q8-b', 'A ∪ B', ['[2,6]'], 'Ex.: [2,6]'),
                    textField('q8-c', 'A - B', ['[2,3)'], 'Ex.: [2,3)'),
                    textField('q8-d', 'B - A', ['(4,6]'], 'Ex.: (4,6]'),
                ]),
            ],
        },
        solution: {
            answerSummary: 'A ∩ B = [3,4], A ∪ B = [2,6], A - B = [2,3) e B - A = (4,6].',
            steps: [
                'A sobreposicao dos dois intervalos vai de 3 ate 4.',
                'Como ha contato entre os intervalos, a uniao vira um bloco unico de 2 a 6.',
                'Na diferenca, retire apenas a parte comum e preserve os extremos que permanecem no conjunto.',
            ],
            studyTip: 'Em diferenca, pense “o que sobra do primeiro intervalo depois de apagar o trecho compartilhado?”.',
        },
    },
    {
        id: 'q9',
        number: 9,
        title: 'Conjuntos descritos por desigualdades',
        topics: ['intervalos', 'conjuntos'],
        difficulty: 'base',
        prompt: [{ type: 'paragraph', text: 'Considere A = {x ∈ R | x < 4} e B = {x ∈ R | x < 1}.' }],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q9-answers', 'Resultados', [
                    textField('q9-a', 'A ∩ B', ['(-∞,1)', '(-inf,1)'], 'Ex.: (-∞,1)'),
                    textField('q9-b', 'A ∪ B', ['(-∞,4)', '(-inf,4)'], 'Ex.: (-∞,4)'),
                ]),
            ],
        },
        solution: {
            answerSummary: 'A ∩ B = (-∞,1) e A ∪ B = (-∞,4).',
            steps: [
                'B eh subconjunto de A, porque todo x < 1 tambem satisfaz x < 4.',
                'Quando um conjunto esta contido no outro, a intersecao vira o menor e a uniao vira o maior.',
            ],
            studyTip: 'Compare rapidamente as desigualdades para descobrir se um conjunto esta contido no outro.',
        },
    },
    {
        id: 'q10',
        number: 10,
        title: 'Pertinencia apos diferenca de intervalos',
        topics: ['intervalos', 'conjuntos'],
        difficulty: 'intermediario',
        prompt: [
            {
                type: 'paragraph',
                text: 'Dados A = [-1,4], B = [1,5], C = [2,4] e D = [1,3], verifique se o numero 1 pertence a (A ∩ B) - (C - D).',
            },
        ],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q10-answer', 'Decisao final', [toggleField('q10-a', 'O numero 1 pertence ao conjunto?', 'sim')]),
            ],
        },
        solution: {
            answerSummary: 'Sim, 1 pertence ao conjunto.',
            steps: [
                'Primeiro, A ∩ B = [1,4].',
                'Depois, C - D = (3,4], pois D remove de C a parte entre 2 e 3.',
                'Entao [1,4] - (3,4] = [1,3], e o numero 1 esta dentro desse intervalo.',
            ],
            studyTip: 'Quando houver diferenca dentro de diferenca, resolva uma operacao por vez para nao misturar extremos.',
        },
    },
    {
        id: 'q11',
        number: 11,
        title: 'Dominio e imagem de funcoes classicas',
        topics: ['funcoes', 'dominio-imagem'],
        difficulty: 'intermediario',
        prompt: [
            {
                type: 'paragraph',
                text: 'Esboce os graficos no rascunho e registre dominio e imagem de cada funcao nos campos oficiais.',
            },
        ],
        hint: 'Para potencias pares, a imagem nao fica negativa. Para potencias impares, a funcao cobre todos os reais.',
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q11-a', 'a) f(x) = x', [textField('q11-a-domain', 'Dominio', ALL_REALS), textField('q11-a-image', 'Imagem', ALL_REALS)], undefined, true),
                group('q11-b', 'b) f(x) = x²', [textField('q11-b-domain', 'Dominio', ALL_REALS), textField('q11-b-image', 'Imagem', NON_NEGATIVE)], undefined, true),
                group('q11-c', 'c) f(x) = x³', [textField('q11-c-domain', 'Dominio', ALL_REALS), textField('q11-c-image', 'Imagem', ALL_REALS)], undefined, true),
                group('q11-d', 'd) f(x) = x⁴', [textField('q11-d-domain', 'Dominio', ALL_REALS), textField('q11-d-image', 'Imagem', NON_NEGATIVE)], undefined, true),
                group('q11-e', 'e) f(x) = x⁵', [textField('q11-e-domain', 'Dominio', ALL_REALS), textField('q11-e-image', 'Imagem', ALL_REALS)], undefined, true),
                group('q11-f', 'f) f(x) = xⁿ, n par', [textField('q11-f-domain', 'Dominio', ALL_REALS), textField('q11-f-image', 'Imagem', NON_NEGATIVE)], undefined, true),
                group('q11-g', 'g) f(x) = xⁿ, n impar', [textField('q11-g-domain', 'Dominio', ALL_REALS), textField('q11-g-image', 'Imagem', ALL_REALS)], undefined, true),
                group('q11-h', 'h) f(x) = |x|', [textField('q11-h-domain', 'Dominio', ALL_REALS), textField('q11-h-image', 'Imagem', NON_NEGATIVE)], undefined, true),
                group('q11-i', 'i) f(x) = √x', [textField('q11-i-domain', 'Dominio', FROM_ZERO), textField('q11-i-image', 'Imagem', FROM_ZERO)], undefined, true),
                group('q11-j', 'j) f(x) = 2x - 1', [textField('q11-j-domain', 'Dominio', ALL_REALS), textField('q11-j-image', 'Imagem', ALL_REALS)], undefined, true),
                group('q11-k', 'k) f(x) = -3x² + x + 1', [textField('q11-k-domain', 'Dominio', ALL_REALS), textField('q11-k-image', 'Imagem', DOMAIN_TO_13_12)], undefined, true),
                group('q11-l', 'l) f(x) = x|x|', [textField('q11-l-domain', 'Dominio', ALL_REALS), textField('q11-l-image', 'Imagem', ALL_REALS)], undefined, true),
            ],
        },
        solution: {
            answerSummary:
                'Todas as funcoes tem dominio R, exceto √x, que tem dominio [0,+∞). As imagens nao negativas aparecem em x², x⁴, xⁿ par, |x| e √x. Em -3x² + x + 1 a imagem eh (-∞,13/12].',
            steps: [
                'Potencias impares e retas cobrem todos os reais tanto no dominio quanto na imagem.',
                'Potencias pares e valor absoluto nunca produzem valores negativos.',
                'Na raiz quadrada, o radicando precisa ser nao negativo; por isso dominio e imagem comecam em zero.',
                'Na parabola -3x² + x + 1, o vertice ocorre em x = 1/6 e gera valor maximo 13/12.',
            ],
            studyTip: 'Quando a formula for conhecida, associe-a a um grafico-modelo: reta, parabola, raiz, potencia par ou impar.',
        },
    },
    {
        id: 'q12',
        number: 12,
        title: 'Funcao definida por racionais e irracionais',
        topics: ['funcoes', 'conceitos'],
        difficulty: 'intermediario',
        prompt: [
            { type: 'paragraph', text: 'Considere f(x) = 1 se x ∈ Q, e f(x) = x + 1 se x ∉ Q.' },
            { type: 'note', text: 'Use o campo oficial para o valor final de cada item. O rascunho pode ficar com a classificacao racional/irracional.' },
        ],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q12-values', 'Valores de f(x)', [
                    textField('q12-a', 'a) f(3)', ['1']),
                    textField('q12-b', 'b) f(-2)', ['1']),
                    textField('q12-c', 'c) f(-3/7)', ['1']),
                    textField('q12-d', 'd) f(π)', ['π+1', 'pi+1', '1+pi']),
                    textField('q12-e', 'e) f(√4)', ['1']),
                    textField('q12-f', 'f) f(√3 - 1)', ['√3', 'sqrt3']),
                    textField('q12-g', 'g) f(0,75)', ['1']),
                    textField('q12-h', 'h) f(0,2857142857142...)', ['1,2857142857142...', '1.2857142857142...']),
                ]),
            ],
        },
        solution: {
            answerSummary: 'a) 1, b) 1, c) 1, d) π + 1, e) 1, f) √3, g) 1, h) 1,2857142857142....',
            steps: [
                'Nos itens racionais, a funcao devolve sempre 1.',
                'π eh irracional, entao f(π) = π + 1.',
                '√4 = 2, que eh racional, por isso a resposta do item e volta a ser 1.',
                '√3 - 1 continua irracional, entao somamos 1 e obtemos √3.',
            ],
            studyTip: 'Antes de substituir na funcao, classifique o numero como racional ou irracional com toda calma.',
        },
    },
    {
        id: 'q13',
        number: 13,
        title: 'Dominio de funcoes por partes',
        topics: ['funcoes', 'dominio-imagem'],
        difficulty: 'intermediario',
        prompt: [
            { type: 'paragraph', text: 'Esboce o grafico no rascunho e informe o dominio de cada funcao por partes.' },
        ],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q13-a', 'a)', [textField('q13-a-domain', 'Dominio', ALL_REALS)], 'f(x) = x + 2, se x < 0; e 2, se x ≥ 0.', true),
                group('q13-b', 'b)', [textField('q13-b-domain', 'Dominio', ALL_REALS)], 'f(x) = -2, se x < -2; x², se -2 ≤ x < 0; x, se x ≥ 0.', true),
                group('q13-c', 'c)', [textField('q13-c-domain', 'Dominio', ALL_REALS)], 'f(x) = 4, se x < -1 ou x > 3; x² - 2x + 1, se -1 ≤ x ≤ 3.', true),
                group('q13-d', 'd)', [textField('q13-d-domain', 'Dominio', ALL_REALS)], 'f(x) = √x, se x ≥ 0; x² - 2, se x < 0.', true),
                group('q13-e', 'e)', [textField('q13-e-domain', 'Dominio', DOMAIN_EXCEPT_ONE)], 'f(x) = -x + 2, se x < -1; x³, se -1 ≤ x < 1; √x, se x > 1.', true),
            ],
        },
        solution: {
            answerSummary: 'Os itens a, b, c e d tem dominio R. No item e, o dominio eh R - {1}.',
            steps: [
                'Nos itens a, b e c, as partes cobrem toda a reta real sem buracos.',
                'No item d, a parte com raiz cobre x ≥ 0 e a parabola cobre x < 0, completando R.',
                'No item e, nenhuma parte define a funcao exatamente em x = 1, entao esse ponto sai do dominio.',
            ],
            studyTip: 'Em funcao por partes, observe se sobra algum valor de x sem regra associada.',
        },
    },
    {
        id: 'q14',
        number: 14,
        title: 'Composicao de funcoes',
        topics: ['composicao', 'funcoes'],
        difficulty: 'intermediario',
        prompt: [
            { type: 'paragraph', text: 'Calcule g ∘ f e f ∘ g nos casos abaixo.' },
        ],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q14-a', 'a) f(x)=x² e g(x)=|x|', [
                    textField('q14-a-gof', 'g ∘ f', ['x²', 'x^2']),
                    textField('q14-a-fog', 'f ∘ g', ['x²', 'x^2']),
                ], undefined, true),
                group('q14-b', 'b) f(x)=√x e g(x)=x²', [
                    textField('q14-b-gof', 'g ∘ f', ['x'], 'Ex.: x'),
                    textField('q14-b-fog', 'f ∘ g', ['|x|', 'abs(x)'], 'Ex.: |x|'),
                ], undefined, true),
                group('q14-d', 'd) f(x)=-3x²+x+1 e g(x)=(1+√13)/6', [
                    textField('q14-d-gof', 'g ∘ f', ['(1+√13)/6', '(1+sqrt13)/6'], 'Ex.: (1+√13)/6'),
                    textField('q14-d-fog', 'f ∘ g', ['0'], 'Ex.: 0'),
                ], undefined, true),
                group('q14-e', 'e) f(x)=2x-1 e g(x)=(x+1)/2', [
                    textField('q14-e-gof', 'g ∘ f', ['x'], 'Ex.: x'),
                    textField('q14-e-fog', 'f ∘ g', ['x'], 'Ex.: x'),
                ], undefined, true),
            ],
        },
        solution: {
            answerSummary: 'a) x² e x²; b) x e |x|; d) (1+√13)/6 e 0; e) x e x.',
            steps: [
                'Em g ∘ f, a funcao de fora recebe o resultado da funcao de dentro.',
                'No item b, g(√x) = (√x)² = x, enquanto f(x²) = √(x²) = |x|.',
                'No item d, g eh constante; por isso g ∘ f permanece constante e f ∘ g zera porque g(x) eh raiz de f.',
                'No item e, f e g sao inversas uma da outra, entao as duas composicoes devolvem a identidade.',
            ],
            studyTip: 'Substitua com calma e preserve parenteses para nao trocar a ordem da composicao.',
        },
    },
    {
        id: 'q15',
        number: 15,
        title: 'Funcao inversa e dominio da inversa',
        topics: ['funcoes', 'dominio-imagem', 'composicao'],
        difficulty: 'desafio',
        prompt: [
            { type: 'paragraph', text: 'Determine a funcao inversa e o dominio da inversa em cada caso.' },
        ],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q15-a', 'a) f(x)=2x-1', [
                    textField('q15-a-inverse', 'f⁻¹(x)', ['(x+1)/2'], 'Ex.: (x+1)/2'),
                    textField('q15-a-domain', 'Dominio da inversa', ALL_REALS),
                ], undefined, true),
                group('q15-b', 'b) f(x)=-3x²+x+1, x ≥ 1/6', [
                    textField('q15-b-inverse', 'f⁻¹(x)', ['(1+√(13-12x))/6', '(1+sqrt(13-12x))/6'], 'Ex.: (1+√(13-12x))/6'),
                    textField('q15-b-domain', 'Dominio da inversa', DOMAIN_TO_13_12),
                ], undefined, true),
                group('q15-c', 'c) f(x)=√(x+1), x ≥ -1', [
                    textField('q15-c-inverse', 'f⁻¹(x)', ['x²-1', 'x^2-1'], 'Ex.: x² - 1'),
                    textField('q15-c-domain', 'Dominio da inversa', FROM_ZERO),
                ], undefined, true),
                group('q15-d', 'd) f(x)=√(1/(x-1)), x > 1', [
                    textField('q15-d-inverse', 'f⁻¹(x)', ['1+1/x²', '1+1/x^2'], 'Ex.: 1 + 1/x²'),
                    textField('q15-d-domain', 'Dominio da inversa', POSITIVE),
                ], undefined, true),
                group('q15-e', 'e) f(x)=7/√(2x-1)+3, x > 1/2', [
                    textField('q15-e-inverse', 'f⁻¹(x)', ['1/2+49/(2(x-3)²)', '1/2+49/(2(x-3)^2)', '(1+49/(x-3)^2)/2'], 'Ex.: 1/2 + 49/(2(x-3)²)'),
                    textField('q15-e-domain', 'Dominio da inversa', FROM_THREE),
                ], undefined, true),
            ],
        },
        solution: {
            answerSummary:
                'a) (x+1)/2 com dominio R; b) (1+√(13-12x))/6 com dominio (-∞,13/12]; c) x²-1 com dominio [0,+∞); d) 1+1/x² com dominio (0,+∞); e) 1/2 + 49/[2(x-3)²] com dominio (3,+∞).',
            steps: [
                'Troque x por y, isole a variavel original e depois troque y de volta por x.',
                'No item b, a restricao x ≥ 1/6 escolhe o ramo com sinal positivo na formula inversa.',
                'O dominio da inversa sempre coincide com a imagem da funcao original.',
                'Nos itens d e e, a raiz e o denominador impõem imagens estritamente positivas acima do deslocamento vertical.',
            ],
            studyTip: 'Depois de achar a inversa, confira se a composicao com a original realmente devolve x.',
        },
    },
    {
        id: 'q16',
        number: 16,
        title: 'Compatibilidade entre composicoes lineares',
        topics: ['funcao-afim', 'composicao'],
        difficulty: 'intermediario',
        prompt: [{ type: 'paragraph', text: 'Se f(x)=3x+4 e g(x)=2x+b, determine b de modo que f ∘ g - g ∘ f = 0.' }],
        answerSchema: {
            kind: 'groups',
            groups: [group('q16-answer', 'Valor pedido', [numericField('q16-a', 'b', 2, 'Ex.: 2')])],
        },
        solution: {
            answerSummary: 'b = 2.',
            steps: [
                'f(g(x)) = 3(2x+b) + 4 = 6x + 3b + 4.',
                'g(f(x)) = 2(3x+4) + b = 6x + 8 + b.',
                'Igualando: 6x + 3b + 4 = 6x + 8 + b, entao 2b = 4 e b = 2.',
            ],
            studyTip: 'Quando a igualdade vale para todo x, compare coeficientes e termos independentes.',
        },
    },
    {
        id: 'q17',
        number: 17,
        title: 'Determinando parametro em funcao afim',
        topics: ['funcao-afim', 'interpretacao-algebrica'],
        difficulty: 'intermediario',
        prompt: [
            { type: 'paragraph', text: 'Se f(x)=(2/7)x-2 e g(x)=(5/3)x+a sao tais que f(0)-g(0)=1, determine f(7)+3g(1/5).' },
        ],
        answerSchema: {
            kind: 'groups',
            groups: [group('q17-answer', 'Valor final', [numericField('q17-a', 'Resultado', -8, 'Ex.: -8')])],
        },
        solution: {
            answerSummary: 'O valor pedido eh -8.',
            steps: [
                'f(0) = -2 e g(0) = a, entao -2 - a = 1, logo a = -3.',
                'f(7) = 2 - 2 = 0.',
                'g(1/5) = (5/3)(1/5) - 3 = 1/3 - 3 = -8/3.',
                'Portanto, f(7) + 3g(1/5) = 0 + 3(-8/3) = -8.',
            ],
            studyTip: 'Descubra o parametro primeiro; so depois substitua nos valores pedidos para evitar retrabalho.',
        },
    },
    {
        id: 'q18',
        number: 18,
        title: 'Completando quadrados',
        topics: ['algebra', 'funcao-quadratica'],
        difficulty: 'intermediario',
        prompt: [
            { type: 'paragraph', text: 'Escreva cada expressao na forma a(x - h)² + k.' },
        ],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q18-answers', 'Formas completadas', [
                    textField('q18-a', 'a) x² + 6x', ['(x+3)²-9', '(x+3)^2-9'], 'Ex.: (x+3)² - 9'),
                    textField('q18-b', 'b) x² - 4x + 1', ['(x-2)²-3', '(x-2)^2-3'], 'Ex.: (x-2)² - 3'),
                    textField('q18-c', 'c) 2x² - 8x + 5', ['2(x-2)²-3', '2(x-2)^2-3'], 'Ex.: 2(x-2)² - 3'),
                ]),
            ],
        },
        solution: {
            answerSummary: 'a) (x+3)²-9, b) (x-2)²-3, c) 2(x-2)²-3.',
            steps: [
                'No item a, some e subtraia 9: x² + 6x + 9 - 9.',
                'No item b, some e subtraia 4 para obter x² - 4x + 4 - 3.',
                'No item c, fatore 2: 2(x² - 4x) + 5 = 2[(x-2)² - 4] + 5.',
            ],
            studyTip: 'O numero que completa o quadrado vem de metade do coeficiente de x, tudo elevado ao quadrado.',
        },
    },
    {
        id: 'q19',
        number: 19,
        title: 'Simplificando fracoes complexas',
        topics: ['algebra', 'interpretacao-algebrica'],
        difficulty: 'intermediario',
        prompt: [{ type: 'paragraph', text: 'Simplifique as fracoes complexas abaixo.' }],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q19-answers', 'Expressoes simplificadas', [
                    textField('q19-a', 'a)', ['(x+1)/(1-x)', '-(x+1)/(x-1)'], 'Ex.: (x+1)/(1-x)'),
                    textField('q19-b', 'b)', ['-1/(x(x+h))', '-1/(x*(x+h))'], 'Ex.: -1/[x(x+h)]'),
                    textField('q19-c', 'c)', ['x-2'], 'Ex.: x - 2'),
                ]),
            ],
        },
        solution: {
            answerSummary: 'a) (x+1)/(1-x), b) -1/[x(x+h)], c) x-2.',
            steps: [
                'No item a, multiplique numerador e denominador por x para eliminar as fracoes internas.',
                'No item b, use denominador comum x(x+h) antes de dividir por h.',
                'No item c, fatorar x² - 4 = (x-2)(x+2) permite cancelar o fator x+2.',
            ],
            studyTip: 'Antes de simplificar, transforme a fracao complexa em uma fracao unica com denominador comum.',
        },
    },
    {
        id: 'q20',
        number: 20,
        title: 'Verdadeiro ou falso com justificativa',
        topics: ['conceitos', 'algebra', 'funcoes', 'composicao'],
        difficulty: 'intermediario',
        prompt: [
            { type: 'paragraph', text: 'Marque V ou F. Use o rascunho para justificar erros e contraexemplos.' },
        ],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q20-statements', 'Classificacao', [
                    toggleField('q20-a', 'a) (a+b)² = a² + b²', 'F'),
                    toggleField('q20-b', 'b) Para racionalizar 1/(√5-2), multiplicamos por √5+2', 'V'),
                    toggleField('q20-c', 'c) O conjugado de 2-√3 eh 2+√3', 'V'),
                    toggleField('q20-d', 'd) √(x²) = x para todo real', 'F'),
                    toggleField('q20-e', 'e) x²+10x = (x+5)² - 25', 'V'),
                    toggleField('q20-f', 'f) Toda relacao entre dois conjuntos eh funcao', 'F'),
                    toggleField('q20-g', 'g) Numa funcao, cada elemento do dominio tem uma unica imagem', 'V'),
                    toggleField('q20-h', 'h) O dominio de √(x+3) eh [-3,+∞)', 'V'),
                    toggleField('q20-i', 'i) Uma funcao pode ter dois y para o mesmo x', 'F'),
                    toggleField('q20-j', 'j) Se f(x)=3x e g(x)=x-2, entao f(g(x))=3x-2', 'F'),
                    toggleField('q20-k', 'k) Sempre vale f(g(x)) = g(f(x))', 'F'),
                    toggleField('q20-l', 'l) Se f(x)=√x e g(x)=x², entao f(g(x)) = |x|', 'V'),
                    toggleField('q20-m', 'm) Id(x)=x eh neutra na composicao', 'V'),
                    toggleField('q20-n', 'n) (√x)² e x sao iguais para x ≥ 0', 'V'),
                    toggleField('q20-o', 'o) Imagem sempre coincide com contradominio', 'F'),
                ]),
            ],
        },
        solution: {
            answerSummary: 'Sequencia correta: F, V, V, F, V, F, V, V, F, F, F, V, V, V, F.',
            steps: [
                'O item a falha por esquecer o termo 2ab; o item d falha porque √(x²)=|x|.',
                'Os itens b, c, e, g, h, l, m e n estao corretos pelas definicoes e identidades usuais.',
                'Nos itens j e k, a composicao exige substituir com cuidado e respeitar a ordem.',
                'No item o, a imagem pode ser menor que o contradominio.',
            ],
            studyTip: 'Em V/F, um unico contraexemplo basta para derrubar uma afirmacao universal.',
        },
    },
    {
        id: 'q21',
        number: 21,
        title: 'Definicoes fundamentais',
        topics: ['conceitos', 'conjuntos', 'funcoes'],
        difficulty: 'base',
        prompt: [
            { type: 'paragraph', text: 'Defina cada conceito e acrescente um exemplo curto.' },
        ],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q21-defs', 'Conceitos', [
                    textareaKeywordsField('q21-a', 'a) Conjunto', ['colecao', 'elementos'], ['bem definidos', 'exemplo'], 2),
                    textareaKeywordsField('q21-b', 'b) Uniao de conjuntos', ['uniao', 'pertence a A ou B'], ['juncao', 'exemplo'], 1),
                    textareaKeywordsField('q21-c', 'c) Intersecao de conjuntos', ['intersecao', 'pertence a A e B'], ['comum', 'exemplo'], 1),
                    textareaKeywordsField('q21-d', 'd) Intervalo numerico', ['conjunto', 'numeros reais'], ['extremos', 'reta'], 1),
                    textareaKeywordsField('q21-e', 'e) Funcao', ['dominio', 'unico valor'], ['regra', 'imagem'], 2),
                    textareaKeywordsField('q21-f', 'f) Funcao real a valores reais', ['dominio real', 'imagem real'], ['reais', 'regra'], 1),
                    textareaKeywordsField('q21-g', 'g) Dominio de uma funcao', ['entradas', 'permitidas'], ['x', 'definida'], 2),
                    textareaKeywordsField('q21-h', 'h) Imagem de uma funcao', ['valores produzidos', 'saidas'], ['y', 'alcancados'], 1),
                    textareaKeywordsField('q21-i', 'i) Grafico de uma funcao', ['pares ordenados', 'plano cartesiano'], ['(x,f(x))', 'pontos'], 1),
                    textareaKeywordsField('q21-j', 'j) Composicao de funcoes', ['aplicar uma funcao depois da outra', 'gof'], ['substituicao', 'ordem'], 1),
                ]),
            ],
        },
        solution: {
            answerSummary:
                'As respostas esperadas passam por definicao curta e exemplo: conjunto como colecao de elementos, uniao/intersecao como operacoes, funcao como regra com unica saida por entrada, dominio como entradas permitidas, imagem como saidas produzidas e composicao como aplicacao em cascata.',
            steps: [
                'Cada conceito deve trazer a ideia central sem confundir simbolo com definicao.',
                'Um exemplo curto fortalece a definicao e mostra se voce domina a linguagem matematica.',
                'Nos itens ligados a funcao, diferencie dominio, contradominio e imagem.',
            ],
            studyTip: 'Se uma definicao parecer abstrata demais, complete a resposta com um exemplo numerico simples.',
        },
    },
    {
        id: 'q22',
        number: 22,
        title: 'Custo de producao em funcao do tempo',
        topics: ['funcao-afim', 'graficos', 'interpretacao-geometrica'],
        difficulty: 'intermediario',
        graphKey: 'cost-line',
        graphCaption: 'Grafico reconstruido em SVG com os pontos (0,20000) e (3,30000).',
        prompt: [
            {
                type: 'paragraph',
                text: 'O grafico mostra uma reta crescente para o custo C(t), em reais, ao longo do tempo t em horas.',
            },
        ],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q22-answers', 'Respostas', [
                    textField(
                        'q22-a',
                        'a) Lei de formacao de C(t)',
                        ['C(t)=(10000/3)t+20000', '(10000/3)t+20000', '20000+(10000/3)t', 'C(x)=(10000/3)x+20000'],
                        'Ex.: C(t) = (10000/3)t + 20000',
                    ),
                    numericField('q22-b', 'b) Custo apos 6 horas', 40000, 'Ex.: 40000', ['40000'], 0.1),
                    textField('q22-c', 'c) Classificacao', ['crescente', 'funcao crescente'], 'Ex.: crescente'),
                ]),
            ],
        },
        solution: {
            answerSummary: 'C(t) = (10000/3)t + 20000, C(6) = 40000 e a funcao eh crescente.',
            steps: [
                'A taxa angular eh (30000 - 20000)/(3 - 0) = 10000/3.',
                'Como a reta passa por (0,20000), o termo independente eh 20000.',
                'Substituindo t = 6, obtemos C(6) = 20000 + 6·10000/3 = 40000.',
                'A reta sobe quando t aumenta, por isso a funcao eh crescente.',
            ],
            graphComment: 'As linhas-tracejadas do ponto em x=3 foram refeitas para manter a leitura do valor 30000 em qualquer largura.',
            studyTip: 'Em graficos lineares, use dois pontos para achar a taxa de variacao e o ponto do eixo y para fechar a lei.',
        },
    },
    {
        id: 'q23',
        number: 23,
        title: 'Consumo de cafe e preco',
        topics: ['funcao-afim', 'graficos', 'interpretacao-geometrica'],
        difficulty: 'intermediario',
        graphKey: 'coffee-demand',
        graphCaption: 'Grafico reconstruido em SVG com a reta decrescente entre (1,180) e (5,100).',
        prompt: [
            {
                type: 'paragraph',
                text: 'O consumo mensal de xicaras cai linearmente quando o preco aumenta.',
            },
        ],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q23-answers', 'Respostas', [
                    textField('q23-a', 'a) Funcao C(x)', ['C(x)=-20x+200', '-20x+200', '200-20x'], 'Ex.: C(x) = -20x + 200'),
                    numericField('q23-b', 'b) Preco para consumo zero', 10, 'Ex.: 10'),
                    textField('q23-c', 'c) Classificacao', ['decrescente', 'funcao decrescente'], 'Ex.: decrescente'),
                    numericField('q23-d', 'd) Preco ideal para maior lucro bruto', 5, 'Ex.: 5'),
                ]),
            ],
        },
        solution: {
            answerSummary: 'C(x) = -20x + 200, o consumo zera em x = 10, a funcao eh decrescente e o preco ideal para maior receita bruta eh 5.',
            steps: [
                'A taxa angular eh (100 - 180)/(5 - 1) = -20.',
                'Usando o ponto (1,180), a reta fica C(x) = -20x + 200.',
                'Para achar consumo zero, resolva -20x + 200 = 0 e obtenha x = 10.',
                'A receita bruta eh x·C(x) = -20x² + 200x, cuja parabola tem maximo em x = 5.',
            ],
            graphComment: 'O grafico foi redesenhado com as linhas-guia de x=1 e x=5 para reforcar a leitura dos pontos fornecidos.',
            studyTip: 'Nao confunda a funcao de consumo com a receita: para lucro bruto, voce precisa multiplicar preco por quantidade vendida.',
        },
    },
    {
        id: 'q24',
        number: 24,
        title: 'Depreciacao linear de um veiculo',
        topics: ['funcao-afim', 'graficos', 'interpretacao-geometrica'],
        difficulty: 'desafio',
        graphKey: 'vehicle-depreciation',
        graphCaption: 'Grafico reconstruido com a reta de 100% no tempo 0 ate 20% no tempo 24.',
        prompt: [
            {
                type: 'paragraph',
                text: 'A porcentagem do valor do carro cai linearmente de 100% para 20% ao longo de 24 anos. Aos 4 anos, o carro foi vendido por R$31.000,00.',
            },
        ],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q24-answer', 'Preco apos 15 anos', [
                    numericField('q24-a', 'Valor aproximado em reais', 17884.6154, 'Ex.: 17884,62', ['17884.62', '17884,62', '232500/13'], 0.5),
                ]),
            ],
        },
        solution: {
            answerSummary: 'O preco apos 15 anos eh aproximadamente R$17.884,62.',
            steps: [
                'A reta percentual vai de 100% em t=0 para 20% em t=24, caindo 80 pontos percentuais em 24 anos.',
                'Logo, em 4 anos o carro vale 100 - (80/24)·4 = 86,666...% do valor inicial.',
                'Se 86,666...% vale R$31.000,00, entao o valor inicial era R$35.769,23 aproximadamente.',
                'Em 15 anos, o percentual eh 100 - (80/24)·15 = 50%; portanto o preco fica em cerca de R$17.884,62.',
            ],
            graphComment: 'A reta e as guias de 20% e 24 anos foram reconstruidas para manter a leitura proporcional no celular.',
            studyTip: 'Quando o grafico usa porcentagem, primeiro transforme o problema em “qual fracao do valor inicial resta nesse instante?”.',
        },
    },
    {
        id: 'q25',
        number: 25,
        title: 'Leitura de uma parabola',
        topics: ['funcao-quadratica', 'graficos', 'interpretacao-geometrica'],
        difficulty: 'intermediario',
        graphKey: 'quadratic-roots',
        graphCaption: 'Parabola reconstruida com interceptos em x = -2 e x = 1 e ponto (0,-1).',
        prompt: [
            { type: 'paragraph', text: 'Use o grafico para determinar a lei de formacao, o minimo e os intervalos de monotonia.' },
        ],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q25-answers', 'Respostas', [
                    textField(
                        'q25-a',
                        'a) Lei de formacao',
                        ['0.5x²+0.5x-1', '0,5x²+0,5x-1', 'x²/2+x/2-1', '0.5(x+2)(x-1)', '(x²+x-2)/2'],
                        'Ex.: 0,5x² + 0,5x - 1',
                    ),
                    numericField('q25-b', 'b) Valor minimo absoluto', -1.125, 'Ex.: -1,125', ['-9/8'], 0.001),
                    textField('q25-c', 'c) Intervalo de crescimento', ['(-1/2,+∞)', '(-1/2,∞)', 'x>-1/2'], 'Ex.: (-1/2,+∞)'),
                    textField('q25-d', 'd) Intervalo de decrescimento', ['(-∞,-1/2)', '(-inf,-1/2)', 'x<-1/2'], 'Ex.: (-∞,-1/2)'),
                ]),
            ],
        },
        solution: {
            answerSummary: 'f(x) = 0,5x² + 0,5x - 1, minimo -9/8, crescente em (-1/2,+∞) e decrescente em (-∞,-1/2).',
            steps: [
                'As raizes -2 e 1 indicam a forma fatorada f(x) = a(x+2)(x-1).',
                'Como o ponto (0,-1) esta no grafico, temos -2a = -1 e obtemos a = 1/2.',
                'O eixo de simetria eh x = (-2 + 1)/2 = -1/2.',
                'A parabola abre para cima, entao decresce ate o vertice e cresce depois dele.',
            ],
            graphComment: 'Os interceptos e o ponto no eixo y foram mantidos como marcadores para orientar a leitura da lei.',
            studyTip: 'Quando um grafico de parabola mostra raizes e mais um ponto, prefira a forma fatorada para achar a lei rapidamente.',
        },
    },
    {
        id: 'q26',
        number: 26,
        title: 'Lancamento de projetil',
        topics: ['funcao-quadratica', 'interpretacao-algebrica', 'graficos'],
        difficulty: 'intermediario',
        prompt: [
            { type: 'paragraph', text: 'A altura do projetil eh dada por H(t) = -t² + 5t + 1.' },
        ],
        answerSchema: {
            kind: 'groups',
            groups: [
                group('q26-answers', 'Respostas', [
                    numericField('q26-a', 'a) Altura inicial', 1, 'Ex.: 1'),
                    numericField('q26-b', 'b) Tempo para atingir o chao', 5.1925824, 'Ex.: 5,19', ['(5+√29)/2', '(5+sqrt29)/2'], 0.02),
                    numericField('q26-c', 'c) Altura maxima', 7.25, 'Ex.: 7,25', ['29/4'], 0.01),
                    numericField('q26-d', 'd) Instante da altura maxima', 2.5, 'Ex.: 2,5', ['5/2'], 0.01),
                ]),
            ],
        },
        solution: {
            answerSummary: 'a) 1 m, b) (5+√29)/2 ≈ 5,19 s, c) 29/4 = 7,25 m, d) 5/2 = 2,5 s.',
            steps: [
                'A altura inicial eh H(0) = 1.',
                'Para saber quando o projetil toca o chao, resolva -t² + 5t + 1 = 0 e escolha a raiz positiva.',
                'O instante do vertice eh t = -b/(2a) = -5/[2(-1)] = 2,5.',
                'Substituindo t = 2,5 em H(t), obtemos altura maxima 7,25 metros.',
            ],
            studyTip: 'Em problemas de movimento vertical, o instante do vertice entrega diretamente o tempo da altura maxima.',
        },
    },
];
