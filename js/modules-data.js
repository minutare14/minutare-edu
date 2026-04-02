window.CONTENT_LIBRARY = {
    subjectFiles: 9,
    referenceFiles: 1,
    referenceManual: '/content/reference/manual-completo.md',
    artifactFiles: 16,
};

window.MODULES_DATA = [
    {
        id: 'page-modulo-conjuntos',
        slug: 'conjuntos',
        order: 1,
        accent: 'blue',
        title: 'Conjuntos',
        subtitle: 'Noção de conjunto, propriedades e operações entre conjuntos',
        description:
            'Construa a base lógica da disciplina com pertinência, inclusão, conjunto vazio, universo, união, interseção e diferença.',
        aiTopic: 'Noção de conjunto, propriedades dos conjuntos e operações entre conjuntos',
        quizTopic: 'Conjuntos',
        reviewHighlights: [
            'Diferencie ∈ de ⊂ com segurança',
            'Conjunto vazio está contido em qualquer conjunto',
            'União junta; interseção seleciona o comum; diferença depende da ordem',
        ],
        artifactSlugs: [
            'diagrama-venn-interativo',
            'conjuntos-3d-esferas',
            'conjuntos-e-numeros',
        ],
        files: [
            {
                title: 'Noção de Conjunto',
                path: '/content/markdown/nocao-de-conjunto.md',
                tag: 'Fundamentos',
                manualTitle: 'Noção de conjunto',
            },
            {
                title: 'Propriedades dos Conjuntos',
                path: '/content/markdown/propriedades-dos-conjuntos.md',
                tag: 'Inclusão',
                manualTitle: 'Propriedades dos conjuntos',
            },
            {
                title: 'Operações entre Conjuntos',
                path: '/content/markdown/operacoes-entre-conjuntos.md',
                tag: 'Operações',
                manualTitle: 'Operações entre conjuntos',
            },
        ],
        fallbackQuiz: [
            {
                question: 'Qual afirmação usa corretamente a relação de pertinência?',
                options: ['ℕ ∈ ℤ', '3 ∈ {1, 2, 3}', '{2} ∈ {2, 4, 6}', 'A ⊂ 2'],
                correctAnswer: 1,
                explanation:
                    'Pertinência liga elemento a conjunto. O número 3 é elemento do conjunto {1, 2, 3}.',
                difficulty: 'fácil',
            },
            {
                question: 'Se A = {1, 2} e B = {1, 2, 3, 4}, qual relação é verdadeira?',
                options: ['A ⊂ B', 'A ∈ B', 'B ⊂ A', 'A = B'],
                correctAnswer: 0,
                explanation:
                    'Todos os elementos de A aparecem em B, então A está contido em B.',
                difficulty: 'fácil',
            },
            {
                question: 'Qual é o resultado de A ∩ B para A = {1, 2, 3} e B = {2, 3, 4}?',
                options: ['{1, 2, 3, 4}', '{1}', '{2, 3}', '{4}'],
                correctAnswer: 2,
                explanation:
                    'Interseção mantém apenas o que aparece simultaneamente em A e B: 2 e 3.',
                difficulty: 'médio',
            },
            {
                question: 'Qual alternativa sobre o conjunto vazio é verdadeira?',
                options: [
                    '∅ tem sempre 1 elemento',
                    '∅ só está contido em si mesmo',
                    '∅ está contido em qualquer conjunto',
                    '∅ é igual a {∅}',
                ],
                correctAnswer: 2,
                explanation:
                    'Por definição, o conjunto vazio é subconjunto de qualquer conjunto.',
                difficulty: 'médio',
            },
            {
                question: 'Para A = {1, 2, 3, 4} e B = {3, 4, 5}, qual é A - B?',
                options: ['{5}', '{1, 2}', '{3, 4}', '{1, 2, 5}'],
                correctAnswer: 1,
                explanation:
                    'Na diferença A - B ficam os elementos de A que não pertencem a B: 1 e 2.',
                difficulty: 'difícil',
            },
        ],
    },
    {
        id: 'page-modulo-conjuntos-numericos',
        slug: 'conjuntos-numericos',
        order: 2,
        accent: 'green',
        title: 'Conjuntos Numéricos',
        subtitle: 'Naturais, inteiros, racionais, irracionais e reais',
        description:
            'Classifique números com rapidez, identifique o conjunto mais específico e evite tropeços com dízimas periódicas e raízes.',
        aiTopic: 'Conjuntos numéricos: naturais, inteiros, racionais, irracionais e reais',
        quizTopic: 'Conjuntos Numéricos',
        artifactSlugs: [
            'mapa-mental-numeros',
            'quiz-conjuntos-numericos',
            'conjuntos-e-numeros',
        ],
        reviewHighlights: [
            'ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ',
            'Dízima periódica é racional',
            'π e raízes não exatas ficam em 𝕀',
        ],
        files: [
            {
                title: 'Conjuntos Numéricos',
                path: '/content/markdown/conjuntos-numericos.md',
                tag: 'Classificação',
                manualTitle: 'Conjuntos numéricos (N, Z, Q, I, R)',
            },
        ],
        fallbackQuiz: [
            {
                question: 'Qual dos números a seguir é irracional?',
                options: ['1/3', '√2', '0,333...', '-5'],
                correctAnswer: 1,
                explanation:
                    '√2 é decimal infinito e não periódico, então não pode ser escrito como fração.',
                difficulty: 'fácil',
            },
            {
                question: 'Quais conjuntos contêm o número -7?',
                options: ['Apenas ℤ', 'ℤ, ℚ e ℝ', 'Apenas ℚ', 'ℕ, ℤ e ℝ'],
                correctAnswer: 1,
                explanation:
                    '-7 é inteiro, racional e real. Não pertence aos naturais.',
                difficulty: 'médio',
            },
            {
                question: 'A dízima 0,1111... pertence a qual conjunto?',
                options: ['Irracionais', 'Naturais', 'Racionais', 'Nenhum dos anteriores'],
                correctAnswer: 2,
                explanation:
                    '0,1111... = 1/9. Toda dízima periódica é racional.',
                difficulty: 'médio',
            },
            {
                question: 'Qual afirmação sobre os conjuntos numéricos é verdadeira?',
                options: ['ℕ ⊂ 𝕀', 'ℚ ∩ 𝕀 = ℝ', 'ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ', '𝕀 ⊂ ℚ'],
                correctAnswer: 2,
                explanation:
                    'A sequência correta de inclusão é ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ.',
                difficulty: 'difícil',
            },
            {
                question: 'π pertence a qual conjunto?',
                options: ['ℚ e ℝ', 'Apenas ℝ', '𝕀 e ℝ', 'ℤ, ℚ e ℝ'],
                correctAnswer: 2,
                explanation:
                    'π é irracional e, ao mesmo tempo, real.',
                difficulty: 'fácil',
            },
        ],
    },
    {
        id: 'page-modulo-ordem-intervalos',
        slug: 'ordem-e-intervalos',
        order: 3,
        accent: 'amber',
        title: 'Ordem e Intervalos',
        subtitle: 'Comparação na reta real, desigualdades e intervalos numéricos',
        description:
            'Compare números reais, leia desigualdades com clareza e traduza intervalos com segurança para a reta real.',
        aiTopic: 'Relação de ordem nos números reais e intervalos numéricos',
        quizTopic: 'Ordem e Intervalos',
        artifactSlugs: [
            'intervalos-reta-real',
            'reta-real-construtor',
            'reta-real-3d',
        ],
        reviewHighlights: [
            'Na reta, quem está mais à direita é maior',
            'Multiplicou desigualdade por negativo? Inverta o sinal',
            'Infinito nunca fecha intervalo',
        ],
        files: [
            {
                title: 'Relação de Ordem',
                path: '/content/markdown/relacao-de-ordem.md',
                tag: 'Comparação',
                manualTitle: 'Relação de ordem nos números reais',
            },
            {
                title: 'Intervalos Numéricos',
                path: '/content/markdown/intervalos-numericos.md',
                tag: 'Reta Real',
                manualTitle: 'Intervalos numéricos',
                useManual: false,
            },
        ],
        fallbackQuiz: [
            {
                question: 'O intervalo [-2, 5[ corresponde a qual desigualdade?',
                options: ['-2 < x < 5', '-2 ≤ x < 5', '-2 < x ≤ 5', '-2 ≤ x ≤ 5'],
                correctAnswer: 1,
                explanation:
                    'O -2 entra no intervalo e o 5 fica de fora. Portanto: -2 ≤ x < 5.',
                difficulty: 'fácil',
            },
            {
                question: 'Na reta real, qual número fica mais à esquerda?',
                options: ['-1', '0,5', '-3', '1'],
                correctAnswer: 2,
                explanation:
                    'Quanto mais à esquerda, menor o número. Entre as opções, -3 é o menor.',
                difficulty: 'fácil',
            },
            {
                question: 'Se x > y e multiplicamos ambos os lados por -2, a relação correta é:',
                options: ['-2x > -2y', '-2x < -2y', '-2x = -2y', 'Não muda'],
                correctAnswer: 1,
                explanation:
                    'Ao multiplicar desigualdade por negativo, o sentido do sinal é invertido.',
                difficulty: 'médio',
            },
            {
                question: 'Qual número NÃO pertence ao intervalo [-3, 2[ ?',
                options: ['-3', '0', '1,99', '2'],
                correctAnswer: 3,
                explanation:
                    'O 2 está no extremo aberto, então não pertence ao intervalo.',
                difficulty: 'médio',
            },
            {
                question: 'Qual notação está incorreta?',
                options: ['[a, b]', ']a, +∞[', '[-∞, b]', ']a, b['],
                correctAnswer: 2,
                explanation:
                    'O infinito nunca é incluído; por isso, seu lado deve ser sempre aberto.',
                difficulty: 'difícil',
            },
        ],
    },
    {
        id: 'page-modulo-algebra',
        slug: 'algebra',
        order: 4,
        accent: 'blue',
        title: 'Álgebra',
        subtitle: 'Propriedades básicas, manipulação algébrica e distributiva',
        description:
            'Fortaleça a base algébrica com comutativa, associativa, distributiva e leitura correta de expressões.',
        aiTopic: 'Propriedades básicas da álgebra e distributiva',
        quizTopic: 'Álgebra',
        artifactSlugs: [
            'algebra-3d-superficie',
            'algebra-produtos-fatoracao',
        ],
        reviewHighlights: [
            'Comutativa e associativa não valem para toda operação',
            'Distributiva precisa atingir todos os termos',
            'Sinais merecem atenção máxima no chuveirinho',
        ],
        files: [
            {
                title: 'Propriedades da Álgebra',
                path: '/content/markdown/propriedades-da-algebra.md',
                tag: 'Base algébrica',
                manualTitle: 'Propriedades básicas da álgebra',
            },
        ],
        fallbackQuiz: [
            {
                question: 'Qual propriedade justifica (x + 2) + 5 = x + (2 + 5)?',
                options: ['Comutativa', 'Associativa', 'Distributiva', 'Elemento neutro'],
                correctAnswer: 1,
                explanation:
                    'A ordem não mudou; apenas o agrupamento foi alterado. Isso é associatividade.',
                difficulty: 'fácil',
            },
            {
                question: 'Ao desenvolver 3(x - 4), qual é o resultado correto?',
                options: ['3x - 4', '3x - 12', 'x - 12', '3x + 12'],
                correctAnswer: 1,
                explanation:
                    'A distributiva obriga o 3 a multiplicar todos os termos do parêntese: 3x - 12.',
                difficulty: 'fácil',
            },
            {
                question: 'Qual operação NÃO é comutativa?',
                options: ['Soma', 'Multiplicação', 'Subtração', 'Adição de inteiros'],
                correctAnswer: 2,
                explanation:
                    'Em geral, a - b ≠ b - a. Por isso a subtração não é comutativa.',
                difficulty: 'médio',
            },
            {
                question: 'Qual é o elemento neutro da multiplicação?',
                options: ['0', '1', '-1', '2'],
                correctAnswer: 1,
                explanation:
                    'Multiplicar por 1 não altera o valor da expressão.',
                difficulty: 'fácil',
            },
            {
                question: 'Qual é o desenvolvimento correto de -2x(3x - 1)?',
                options: ['-6x^2 - 2x', '-6x^2 + 2x', '6x^2 - 2x', '6x^2 + 2x'],
                correctAnswer: 1,
                explanation:
                    '(-2x)(3x) = -6x^2 e (-2x)(-1) = +2x. Logo, -6x^2 + 2x.',
                difficulty: 'difícil',
            },
        ],
    },
    {
        id: 'page-modulo-produtos-notaveis',
        slug: 'produtos-notaveis',
        order: 5,
        accent: 'amber',
        title: 'Produtos Notáveis',
        subtitle: 'Quadrado da soma, quadrado da diferença e soma pela diferença',
        description:
            'Use os atalhos clássicos da álgebra para expandir expressões sem depender do chuveirinho em toda questão.',
        aiTopic: 'Produtos notáveis: quadrado da soma, quadrado da diferença e produto da soma pela diferença',
        quizTopic: 'Produtos Notáveis',
        artifactSlugs: [
            'expansor-produtos-notaveis',
            'cubo-soma-3d',
            'area-model-fatoracao',
        ],
        reviewHighlights: [
            'No quadrado da soma existe o termo 2ab',
            'No quadrado da diferença o termo do meio é negativo',
            '(a+b)(a-b) gera diferença de quadrados',
        ],
        files: [
            {
                title: 'Produtos Notáveis',
                path: '/content/markdown/produtos-notaveis.md',
                tag: 'Atalhos algébricos',
                manualTitle: 'Produtos notáveis',
                useManual: false,
            },
        ],
        fallbackQuiz: [
            {
                question: 'Qual é o resultado de (x + 3)^2?',
                options: ['x^2 + 9', 'x^2 + 3x + 9', 'x^2 + 6x + 9', 'x^2 + 6x + 3'],
                correctAnswer: 2,
                explanation:
                    '(a+b)^2 = a^2 + 2ab + b^2. Com a = x e b = 3, fica x^2 + 6x + 9.',
                difficulty: 'fácil',
            },
            {
                question: 'Qual é a forma desenvolvida de (m - 4)^2?',
                options: ['m^2 - 4m + 16', 'm^2 - 8m + 16', 'm^2 + 8m + 16', 'm^2 - 16'],
                correctAnswer: 1,
                explanation:
                    '(a-b)^2 = a^2 - 2ab + b^2. Então: m^2 - 8m + 16.',
                difficulty: 'médio',
            },
            {
                question: 'Qual é o resultado de (2x - 1)(2x + 1)?',
                options: ['4x^2 - 4x + 1', '4x^2 + 1', '4x^2 - 1', '2x^2 - 1'],
                correctAnswer: 2,
                explanation:
                    'É o produto da soma pela diferença: (a+b)(a-b) = a^2 - b^2.',
                difficulty: 'médio',
            },
            {
                question: 'Qual polinômio vem de (y + 7)^2?',
                options: ['y^2 + 7y + 49', 'y^2 + 14y + 49', 'y^2 - 14y + 49', 'y^2 + 49'],
                correctAnswer: 1,
                explanation:
                    'O termo do meio é 2ab = 2·y·7 = 14y.',
                difficulty: 'fácil',
            },
            {
                question: 'Qual erro é clássico em produtos notáveis?',
                options: ['Esquecer de somar expoentes', 'Dizer que (a+b)^2 = a^2 + b^2', 'Transformar toda soma em produto', 'Trocar x por y'],
                correctAnswer: 1,
                explanation:
                    'No quadrado da soma existe o termo do meio 2ab; ele não pode desaparecer.',
                difficulty: 'difícil',
            },
        ],
    },
    {
        id: 'page-modulo-fatoracao',
        slug: 'fatoracao',
        order: 6,
        accent: 'red',
        title: 'Fatoração',
        subtitle: 'Fator comum, diferença de quadrados e trinômio quadrado perfeito',
        description:
            'Aprenda a voltar de uma expressão expandida para seus fatores e simplificar contas com muito mais controle.',
        aiTopic: 'Fatoração algébrica: fator comum, diferença de quadrados e trinômio quadrado perfeito',
        quizTopic: 'Fatoração',
        artifactSlugs: [
            'fatorador-visual',
            'area-model-fatoracao',
            'algebra-produtos-fatoracao',
        ],
        reviewHighlights: [
            'Procure primeiro o fator comum em evidência',
            'x^2 - a^2 vira (x+a)(x-a)',
            'Só corte fatores quando estiverem multiplicando',
        ],
        files: [
            {
                title: 'Fatoração',
                path: '/content/markdown/fatoracao.md',
                tag: 'Estratégias de fatoração',
                manualTitle: 'Fatoração',
                useManual: false,
            },
        ],
        fallbackQuiz: [
            {
                question: 'Qual é a fatoração de x^2 - 16?',
                options: ['(x - 4)^2', '(x + 4)(x - 4)', '(x + 8)(x - 2)', '(x - 16)(x + 1)'],
                correctAnswer: 1,
                explanation:
                    'x^2 - 16 é diferença de quadrados: x^2 - 4^2 = (x + 4)(x - 4).',
                difficulty: 'fácil',
            },
            {
                question: 'Qual é o fator em evidência de 6x^3 + 9x^2?',
                options: ['3x', '3x^2', '6x^2', '9x'],
                correctAnswer: 1,
                explanation:
                    'O MDC entre 6 e 9 é 3, e o menor expoente de x é x^2. O fator comum é 3x^2.',
                difficulty: 'médio',
            },
            {
                question: 'Como fatorar 15y^4 - 5y^2?',
                options: ['5y^2(3y^2 - 1)', '5y(3y^3 - 1)', '15y^2(y^2 - 1)', '5(3y^4 - y^2)'],
                correctAnswer: 0,
                explanation:
                    'Coloca-se em evidência o 5y^2, que é o fator comum aos dois termos.',
                difficulty: 'médio',
            },
            {
                question: 'Qual é a forma fatorada de x^2 + 6x + 9?',
                options: ['(x + 9)^2', '(x + 3)^2', '(x - 3)^2', '(x + 6)(x + 3)'],
                correctAnswer: 1,
                explanation:
                    'É um trinômio quadrado perfeito: x^2 + 2·x·3 + 3^2 = (x + 3)^2.',
                difficulty: 'fácil',
            },
            {
                question: 'Qual cuidado é obrigatório ao simplificar (x^2 - 9)/(x + 3)?',
                options: ['Somar os termos antes', 'Cortar x com 3', 'Fatorar o numerador antes de cortar', 'Trocar por x - 9'],
                correctAnswer: 2,
                explanation:
                    'Só é correto cortar fatores quando eles estão multiplicando. Primeiro: x^2 - 9 = (x+3)(x-3).',
                difficulty: 'difícil',
            },
        ],
    },
];


