/**
 * Central module registry for contextual AI.
 * Maps each educational module to its markdown sources, prompts, and pedagogical metadata.
 */

export interface ModuleConfig {
    id: string;
    slug: string;
    title: string;
    ragFiles: string[];
    learningGoals: string[];
    commonMistakes: string[];
    keyConcepts: string[];
    systemPrompt: string;
}

const BASE_RAG_DIR = 'content/rag';

function ragPath(filename: string): string {
    return `${BASE_RAG_DIR}/${filename}`;
}

function buildModuleSystemPrompt(mod: { title: string; learningGoals: string[]; commonMistakes: string[]; keyConcepts: string[] }): string {
    return [
        `Você é uma tutora de matemática especialista no módulo "${mod.title}".`,
        `Responda sempre em português do Brasil, de forma clara, didática e objetiva.`,
        `Use Markdown limpo e escaneável. Nunca escreva texto longo contínuo.`,
        '',
        `Objetivos de aprendizado deste módulo:`,
        ...mod.learningGoals.map((g) => `- ${g}`),
        '',
        `Conceitos centrais que o aluno deve dominar:`,
        ...mod.keyConcepts.map((c) => `- ${c}`),
        '',
        `Erros comuns que os alunos cometem neste módulo:`,
        ...mod.commonMistakes.map((m) => `- ${m}`),
        '',
        `Instruções:`,
        `- Responda com base no material fornecido no contexto.`,
        `- Se a pergunta for sobre este módulo, priorize o conteúdo do contexto.`,
        `- Se a pergunta fugir completamente do módulo, responda de forma geral mas sinalize que o tema não faz parte deste módulo.`,
        `- Use a estrutura: "Resumo rápido", "Explicação", "O que observar", "Erros comuns", "Exemplo".`,
        `- Mantenha cada seção curta, com frases objetivas ou bullets curtos.`,
        `- Se uma seção não fizer sentido, escreva: "Não se aplica neste pedido.".`,
    ].join('\n');
}

const MODULES: ModuleConfig[] = [
    {
        id: 'page-modulo-conjuntos',
        slug: 'conjuntos',
        title: 'Conjuntos',
        ragFiles: [
            ragPath('Noção de Conjunto.md'),
            ragPath('Propriedades dos Conjuntos.md'),
            ragPath('Operações entre Conjuntos.md'),
        ],
        learningGoals: [
            'Entender a definição de conjunto e elemento',
            'Diferenciar pertinência (∈) de inclusão (⊂)',
            'Identificar e operar com subconjuntos',
            'Dominar união, interseção e diferença de conjuntos',
        ],
        commonMistakes: [
            'Confundir elemento com subconjunto (usar ∈ onde deveria usar ⊂)',
            'Confundir ∈ com ⊂',
            'Esquecer que ∅ está contido em qualquer conjunto',
            'Confundir união com interseção',
        ],
        keyConcepts: [
            'Conjunto, elemento, pertinência',
            'Conjunto vazio (∅)',
            'Inclusão e subconjunto',
            'União (∪), interseção (∩), diferença (−)',
            'Complementar',
        ],
        systemPrompt: '',
    },
    {
        id: 'page-modulo-conjuntos-numericos',
        slug: 'conjuntos-numericos',
        title: 'Conjuntos Numéricos',
        ragFiles: [ragPath('Conjuntos Numéricos.md')],
        learningGoals: [
            'Conhecer a hierarquia ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ',
            'Classificar números em naturais, inteiros, racionais, irracionais e reais',
            'Reconhecer números racionais pela representação fracionária ou dízima periódica',
        ],
        commonMistakes: [
            'Achar que número irracional pode ser escrito como fração',
            'Classificar dízima periódica como irracional',
            'Esquecer que todo natural é inteiro, todo inteiro é racional',
        ],
        keyConcepts: [
            'Naturais (ℕ), Inteiros (ℤ), Racionais (ℚ)',
            'Irracionais (𝕀), Reais (ℝ)',
            'Fração, dízima periódica, raiz não exata',
            'Hierarquia de conjuntos numéricos',
        ],
        systemPrompt: '',
    },
    {
        id: 'page-modulo-ordem-e-intervalos',
        slug: 'ordem-e-intervalos',
        title: 'Ordem e Intervalos',
        ragFiles: [
            ragPath('Relação de Ordem.md'),
            ragPath('Intervalos Numericos.md'),
        ],
        learningGoals: [
            'Entender a relação de ordem na reta real',
            'Diferenciar intervalos abertos e fechados',
            'Representar intervalos na reta numérica',
            'Saber que infinito nunca fecha intervalo',
        ],
        commonMistakes: [
            'Associar colchete a extremo aberto (colchete = fechado)',
            'Associar parênteses a extremo fechado (parênteses = aberto)',
            'Usar colchete com infinito',
        ],
        keyConcepts: [
            'Reta real e desigualdades',
            'Intervalo aberto e fechado',
            'Colchete (fechado) e parênteses (aberto)',
            'Infinito (−∞, +∞)',
            'Notação de intervalos',
        ],
        systemPrompt: '',
    },
    {
        id: 'page-modulo-algebra',
        slug: 'algebra',
        title: 'Álgebra',
        ragFiles: [ragPath('Propriedades da Algebra.md')],
        learningGoals: [
            'Entender e aplicar a propriedade distributiva',
            'Organizar e simplificar termos semelhantes',
            'Cuidar de sinais ao abrir parênteses',
        ],
        commonMistakes: [
            'Descrever distributiva como soma de expoentes',
            'Esquecer de trocar sinal ao abrir parênteses com negativo na frente',
            'Somar termos com partes literais diferentes',
        ],
        keyConcepts: [
            'Propriedade distributiva',
            'Termos semelhantes',
            'Sinais e parênteses',
            'Simplificação de expressões algébricas',
        ],
        systemPrompt: '',
    },
    {
        id: 'page-modulo-produtos-notaveis',
        slug: 'produtos-notaveis',
        title: 'Produtos Notáveis',
        ragFiles: [ragPath('Produtos Notaveis.md')],
        learningGoals: [
            'Reconhecer e aplicar o quadrado da soma',
            'Reconhecer e aplicar o quadrado da diferença',
            'Reconhecer e aplicar o produto da soma pela diferença',
        ],
        commonMistakes: [
            'Esquecer o termo do meio (2ab) no quadrado da soma',
            'Usar sinal positivo no termo do meio do quadrado da diferença',
            'Confundir quadrado da soma com soma pela diferença',
        ],
        keyConcepts: [
            'Quadrado da soma: (a+b)² = a² + 2ab + b²',
            'Quadrado da diferença: (a−b)² = a² − 2ab + b²',
            'Produto da soma pela diferença: (a+b)(a−b) = a² − b²',
            'Termo do meio (dobro do produto)',
        ],
        systemPrompt: '',
    },
    {
        id: 'page-modulo-fatoracao',
        slug: 'fatoracao',
        title: 'Fatoração',
        ragFiles: [ragPath('Fatoracao.md')],
        learningGoals: [
            'Identificar e aplicar fator comum em evidência',
            'Reconhecer diferença de quadrados',
            'Identificar trinômio quadrado perfeito',
        ],
        commonMistakes: [
            'Tratar diferença de quadrados como soma de quadrados',
            'Esquecer do termo do meio ao verificar trinômio quadrado perfeito',
            'Não verificar se há fator comum antes de tentar outros métodos',
        ],
        keyConcepts: [
            'Fator comum em evidência',
            'Diferença de quadrados: a² − b² = (a+b)(a−b)',
            'Trinômio quadrado perfeito',
            'Agrupamento',
        ],
        systemPrompt: '',
    },
];

// Build system prompts from metadata
for (const mod of MODULES) {
    mod.systemPrompt = buildModuleSystemPrompt(mod);
}

const MODULE_BY_SLUG = new Map<string, ModuleConfig>();
const MODULE_BY_ID = new Map<string, ModuleConfig>();

for (const mod of MODULES) {
    MODULE_BY_SLUG.set(mod.slug, mod);
    MODULE_BY_ID.set(mod.id, mod);
}

export function getModuleBySlug(slug: string): ModuleConfig | null {
    return MODULE_BY_SLUG.get(slug) || null;
}

export function getModuleById(id: string): ModuleConfig | null {
    return MODULE_BY_ID.get(id) || null;
}

export function resolveModule(moduleId?: string, moduleSlug?: string): ModuleConfig | null {
    if (moduleSlug) {
        const bySlug = getModuleBySlug(moduleSlug);
        if (bySlug) return bySlug;
    }
    if (moduleId) {
        const byId = getModuleById(moduleId);
        if (byId) return byId;
    }
    return null;
}

export function getAllModules(): ModuleConfig[] {
    return [...MODULES];
}

export const GENERAL_SYSTEM_PROMPT =
    'Você é uma tutora de matemática paciente e didática para estudantes brasileiros. ' +
    'Responda sempre em português do Brasil com Markdown limpo, escaneável e didático. ' +
    'Nunca escreva texto longo contínuo. ' +
    'Use sempre esta estrutura e nesta ordem: "Resumo rápido", "Explicação", "O que observar", "Erros comuns" e "Exemplo". ' +
    'Mantenha cada seção curta, com frases objetivas ou bullets curtos. ' +
    'Se uma seção não fizer sentido, escreva exatamente: "Não se aplica neste pedido.". ' +
    'Se estiver resolvendo uma questão, mostre o raciocínio em passos curtos sem pular etapas importantes. ' +
    'Você tem conhecimento em: Conjuntos, Conjuntos Numéricos, Ordem e Intervalos, Álgebra, Produtos Notáveis e Fatoração. ' +
    'Conecte a dúvida ao percurso de estudo do aluno quando possível. ' +
    'Não invente conteúdo — se não souber, diga que não sabe.';
