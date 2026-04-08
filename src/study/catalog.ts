import type { TopicId } from '../exam/model';

export interface StudyLesson {
    id: string;
    title: string;
    summary: string;
    minutes: number;
    file: string;
}

export interface StudyArtifact {
    id: string;
    title: string;
    description: string;
    kind: 'visual' | 'quiz' | 'laboratorio';
    file: string;
}

export interface StudyModule {
    id: string;
    slug: string;
    title: string;
    summary: string;
    order: number;
    studyPrompt: string;
    learningGoals: string[];
    keyConcepts: string[];
    commonMistakes: string[];
    topics: TopicId[];
    lessons: StudyLesson[];
    artifacts: StudyArtifact[];
}

export const STUDY_MODULES: StudyModule[] = [
    {
        id: 'page-modulo-conjuntos',
        slug: 'conjuntos',
        title: 'Conjuntos',
        summary: 'Base de leitura simbolica, diagramas de Venn, uniao, intersecao e diferenca.',
        order: 1,
        studyPrompt: 'Use este modulo para firmar a linguagem de conjuntos e evitar dupla contagem em problemas.',
        learningGoals: [
            'Entender conjunto, elemento e pertinencia.',
            'Diferenciar subconjunto de elemento.',
            'Dominar uniao, intersecao e diferenca.',
            'Usar diagramas de Venn para organizar contagens.',
        ],
        keyConcepts: [
            'Pertinencia e inclusao',
            'Conjunto vazio',
            'Uniao, intersecao e diferenca',
            'Principio da inclusao-exclusao',
        ],
        commonMistakes: [
            'Trocar o simbolo de pertence pelo de subconjunto.',
            'Somar conjuntos com dupla contagem.',
            'Confundir uniao com intersecao.',
        ],
        topics: ['conjuntos', 'conceitos'],
        lessons: [
            { id: 'nocao-de-conjunto', title: 'Nocao de conjunto', summary: 'Introducao a elemento, pertinencia e representacao por extensao ou propriedade.', minutes: 12, file: 'nocao-de-conjunto.md' },
            { id: 'propriedades-dos-conjuntos', title: 'Propriedades dos conjuntos', summary: 'Leitura de inclusao, equivalencia, conjunto vazio e relacoes basicas.', minutes: 14, file: 'propriedades-dos-conjuntos.md' },
            { id: 'operacoes-entre-conjuntos', title: 'Operacoes entre conjuntos', summary: 'Uniao, intersecao, diferenca e estrategia visual com diagramas.', minutes: 16, file: 'operacoes-entre-conjuntos.md' },
        ],
        artifacts: [
            { id: 'venn', title: 'Diagrama de Venn interativo', description: 'Monte conjuntos A e B e compare uniao, intersecao e diferencas visualmente.', kind: 'visual', file: 'diagrama_venn_interativo.html' },
            { id: 'conjuntos-e-numeros', title: 'Conjuntos e numeros', description: 'Explore relacoes entre conjuntos, elementos e classificacao numerica.', kind: 'laboratorio', file: 'conjuntos_e_numeros.html' },
            { id: 'esferas', title: 'Conjuntos em 3D', description: 'Representacao espacial para ganhar intuicao visual sobre agrupamentos.', kind: 'visual', file: 'conjuntos_3d_esferas.html' },
        ],
    },
    {
        id: 'page-modulo-conjuntos-numericos',
        slug: 'conjuntos-numericos',
        title: 'Conjuntos numericos',
        summary: 'Classificacao de numeros reais, racionalidade, hierarquia e exemplos tipicos de prova.',
        order: 2,
        studyPrompt: 'Use este modulo para classificar numeros sem hesitar e reconhecer exemplos tipicos de racional e irracional.',
        learningGoals: [
            'Reconhecer a hierarquia N, Z, Q e R.',
            'Separar racional de irracional com seguranca.',
            'Ler fracoes, dizimas e raizes no conjunto correto.',
        ],
        keyConcepts: [
            'Naturais, inteiros, racionais e reais',
            'Dizima periodica',
            'Irracionais',
            'Inclusao entre conjuntos numericos',
        ],
        commonMistakes: [
            'Tratar dizima periodica como irracional.',
            'Esquecer que todo inteiro e racional.',
            'Confundir raiz nao exata com racional.',
        ],
        topics: ['conceitos', 'algebra'],
        lessons: [
            { id: 'conjuntos-numericos', title: 'Conjuntos numericos', summary: 'Guia completo para classificar numeros e entender inclusoes.', minutes: 15, file: 'conjuntos-numericos.md' },
        ],
        artifacts: [
            { id: 'mapa-mental', title: 'Mapa mental dos numeros', description: 'Visualize a hierarquia entre os conjuntos numericos.', kind: 'visual', file: 'mapa_mental_numeros.html' },
            { id: 'quiz-numericos', title: 'Quiz de classificacao', description: 'Treino rapido para reconhecer o conjunto numerico correto.', kind: 'quiz', file: 'quiz_conjuntos_numericos.html' },
            { id: 'conjuntos-e-numeros-2', title: 'Relacao entre conjuntos', description: 'Cruze a ideia de conjunto com exemplos numericos.', kind: 'laboratorio', file: 'conjuntos_e_numeros.html' },
        ],
    },
    {
        id: 'page-modulo-ordem-e-intervalos',
        slug: 'ordem-e-intervalos',
        title: 'Ordem e intervalos',
        summary: 'Desigualdades, reta real, intervalos abertos e fechados e leitura grafica.',
        order: 3,
        studyPrompt: 'Use este modulo para traduzir rapidamente entre desigualdade, intervalo e reta numerica.',
        learningGoals: [
            'Representar conjuntos na reta real.',
            'Diferenciar extremos abertos e fechados.',
            'Converter desigualdades em intervalos e vice-versa.',
        ],
        keyConcepts: [
            'Reta real',
            'Intervalos abertos e fechados',
            'Desigualdades',
            'Infinito nunca fecha intervalo',
        ],
        commonMistakes: [
            'Usar colchete com infinito.',
            'Trocar parenteses por colchetes.',
            'Esquecer a leitura geometrica da reta real.',
        ],
        topics: ['intervalos', 'conceitos'],
        lessons: [
            { id: 'relacao-de-ordem', title: 'Relacao de ordem', summary: 'Organize comparacoes, desigualdades e interpretacao na reta real.', minutes: 12, file: 'relacao-de-ordem.md' },
            { id: 'intervalos-numericos', title: 'Intervalos numericos', summary: 'Notacao de intervalos e traducao entre linguagem verbal e visual.', minutes: 16, file: 'intervalos-numericos.md' },
        ],
        artifacts: [
            { id: 'intervalos', title: 'Intervalos na reta real', description: 'Veja os extremos abrindo e fechando na reta numerica.', kind: 'visual', file: 'intervalos_reta_real.html' },
            { id: 'reta-construtor', title: 'Construtor de reta real', description: 'Monte segmentos, semi-retas e confira a leitura dos intervalos.', kind: 'laboratorio', file: 'reta_real_construtor.html' },
            { id: 'reta-3d', title: 'Reta real em 3D', description: 'Uma variacao visual para reforcar posicao e ordem.', kind: 'visual', file: 'reta_real_3d.html' },
        ],
    },
    {
        id: 'page-modulo-algebra',
        slug: 'algebra',
        title: 'Algebra',
        summary: 'Distributiva, sinais, termos semelhantes e organizacao do raciocinio simbolico.',
        order: 4,
        studyPrompt: 'Use este modulo para limpar contas, controlar sinais e simplificar expressoes sem pular etapas.',
        learningGoals: [
            'Aplicar distributiva corretamente.',
            'Juntar termos semelhantes com criterio.',
            'Controlar sinais ao abrir parenteses.',
        ],
        keyConcepts: [
            'Propriedade distributiva',
            'Termos semelhantes',
            'Coeficiente e parte literal',
            'Organizacao da expressao',
        ],
        commonMistakes: [
            'Abrir parenteses sem distribuir para todos os termos.',
            'Trocar sinais com negativo na frente.',
            'Somar termos com letras diferentes.',
        ],
        topics: ['algebra', 'interpretacao-algebrica'],
        lessons: [
            { id: 'propriedades-da-algebra', title: 'Propriedades da algebra', summary: 'Regras de manipulacao simbolica e leitura de expressoes.', minutes: 15, file: 'propriedades-da-algebra.md' },
        ],
        artifacts: [
            { id: 'algebra-3d', title: 'Superficie algebrica 3D', description: 'Ganhe intuicao visual sobre comportamento de expressoes.', kind: 'visual', file: 'algebra_3d_superficie.html' },
            { id: 'algebra-produtos', title: 'Algebra, produtos e fatoracao', description: 'Painel integrado para comparar expansao e simplificacao.', kind: 'laboratorio', file: 'algebra_produtos_fatoracao.html' },
        ],
    },
    {
        id: 'page-modulo-produtos-notaveis',
        slug: 'produtos-notaveis',
        title: 'Produtos notaveis',
        summary: 'Quadrado da soma, quadrado da diferenca e produto da soma pela diferenca.',
        order: 5,
        studyPrompt: 'Use este modulo para reconhecer padroes algoritimicos antes de expandir tudo no bruto.',
        learningGoals: [
            'Reconhecer padroes de quadrado da soma e da diferenca.',
            'Aplicar produto da soma pela diferenca.',
            'Checar termo do meio com seguranca.',
        ],
        keyConcepts: [
            'Quadrado da soma',
            'Quadrado da diferenca',
            'Diferenca de quadrados',
            'Termo do meio',
        ],
        commonMistakes: [
            'Esquecer o 2ab.',
            'Usar sinal errado no termo do meio.',
            'Expandir sem notar um padrao mais curto.',
        ],
        topics: ['algebra', 'interpretacao-algebrica'],
        lessons: [
            { id: 'produtos-notaveis', title: 'Produtos notaveis', summary: 'Reconhecimento rapido de padroes e economia de contas.', minutes: 18, file: 'produtos-notaveis.md' },
        ],
        artifacts: [
            { id: 'expansor', title: 'Expansor de produtos notaveis', description: 'Compare o padrao conhecido com a expansao termo a termo.', kind: 'laboratorio', file: 'expansor_produtos_notaveis.html' },
            { id: 'cubo-soma', title: 'Cubo da soma em 3D', description: 'Visualize a composicao volumetrica do produto notavel.', kind: 'visual', file: 'cubo_soma_3d.html' },
            { id: 'algebra-produtos-2', title: 'Painel integrado', description: 'Relacione produtos notaveis com fatoracao em um unico espaco.', kind: 'laboratorio', file: 'algebra_produtos_fatoracao.html' },
        ],
    },
    {
        id: 'page-modulo-fatoracao',
        slug: 'fatoracao',
        title: 'Fatoracao',
        summary: 'Fator comum, diferenca de quadrados, trinominio quadrado perfeito e leitura estrutural.',
        order: 6,
        studyPrompt: 'Use este modulo para encontrar a estrutura da expressao antes de cortar termos ou aplicar formulas soltas.',
        learningGoals: [
            'Encontrar fator comum em evidencia.',
            'Reconhecer diferenca de quadrados.',
            'Identificar trinominio quadrado perfeito.',
        ],
        keyConcepts: [
            'Fator comum',
            'Diferenca de quadrados',
            'Trinomio quadrado perfeito',
            'Agrupamento',
        ],
        commonMistakes: [
            'Nao testar fator comum antes de outros metodos.',
            'Confundir soma com diferenca de quadrados.',
            'Perder o termo central do quadrado perfeito.',
        ],
        topics: ['algebra', 'interpretacao-algebrica', 'funcao-quadratica'],
        lessons: [
            { id: 'fatoracao', title: 'Fatoracao', summary: 'Guia de leitura estrutural para decompor expressoes com estrategia.', minutes: 18, file: 'fatoracao.md' },
        ],
        artifacts: [
            { id: 'fatorador', title: 'Fatorador visual', description: 'Veja a expressao se reorganizar em fatores equivalentes.', kind: 'laboratorio', file: 'fatorador_visual.html' },
            { id: 'area-model', title: 'Area model para fatoracao', description: 'Use blocos para enxergar os fatores geometricamente.', kind: 'visual', file: 'area_model_fatoracao.html' },
            { id: 'bhaskara', title: 'Bhaskara animado', description: 'Conecte fatoracao, raizes e funcao quadratica em um caso classico.', kind: 'visual', file: 'bhaskara_animado.html' },
        ],
    },
];

export function getStudyModuleBySlug(slug: string) {
    return STUDY_MODULES.find((module) => module.slug === slug) || STUDY_MODULES[0];
}

