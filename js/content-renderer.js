(function () {
    const contentCache = new Map();
    const manualCache = { value: null };

    const markedApi = window.marked && typeof window.marked.parse === 'function'
        ? window.marked
        : window.marked && window.marked.marked && typeof window.marked.marked.parse === 'function'
            ? window.marked.marked
            : null;

    if (!markedApi) {
        throw new Error('Parser Markdown não encontrado. Verifique o carregamento de marked.');
    }

    markedApi.setOptions({
        gfm: true,
        breaks: true,
    });

    const artifactsLibrary = window.ARTIFACTS_LIBRARY || { items: [], categories: [], hostPage: '/ferramentas/artefato.html' };
    const artifactMap = new Map((artifactsLibrary.items || []).map((artifact) => [artifact.slug, artifact]));
    const PRIORITY_LABELS = {
        high: 'Prioridade alta',
        medium: 'Exploracao complementar',
    };

    const SECTION_ORDER = [
        'summary',
        'explanation',
        'definitions',
        'examples',
        'mistakes',
        'tips',
        'exercises',
        'review',
        'default',
    ];

    const SECTION_LABELS = {
        summary: 'Resumo rápido',
        explanation: 'Explicação',
        definitions: 'Definições importantes',
        examples: 'Exemplos resolvidos',
        mistakes: 'Erros comuns',
        tips: 'Macetes',
        exercises: 'Exercícios',
        review: 'Revisão rápida',
        default: 'Conteúdo',
    };

    const PROTECTED_MATH_PATTERN = /(\$\$[\s\S]+?\$\$|\$(?:\\.|[^$\n])+\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/g;
    const TEX_ATOM_PATTERN = /\\(?:frac\{[^{}]+\}\{[^{}]+\}|sqrt\{[^{}]+\}|overline\{[^}]+\}|xrightarrow\{[^}]+\}|mathbb\{[^}]+\}|mathcal\{[^}]+\}|text\{[^}]+\}|emptyset|infty|pi|phi|alpha|beta|gamma|delta|theta|lambda|mu|neq|ne|equiv|leftrightarrow|Rightarrow|rightarrow|implies?|implie|leq?|geq?|subseteq|supseteq|nsubseteq|nsupseteq|nsubset|nsupset|notin|in|cup|cap|mid|land|lor|cdot|times|div|pm|approx|dots|ldots)/g;
    const SIMPLE_MATH_OPERAND = String.raw`(?:\\\{.*?\\\}|\\frac\{[^}]+\}\{[^}]+\}|\\sqrt\{[^}]+\}|\\mathbb\{[^}]+\}|\\mathcal\{[^}]+\}|\\text\{[^}]+\}|[+\-]?(?:\d+(?:[.,]\d+)?)?[A-Za-z](?:\^\{?[^}\s]+\}?)?|[+\-]?\d+(?:[.,]\d+)?|\([^)\n]+\)(?:\^\{?[^}\s]+\}?)?|\\emptyset|\\infty|\\pi|\\phi)`;
    const STRICT_TEX_EXPRESSION_PATTERN = new RegExp(
        String.raw`(?<![$\\\w])(${SIMPLE_MATH_OPERAND}(?:\s*(?:=|<|>|\\subseteq|\\supseteq|\\nsubseteq|\\nsupseteq|\\nsubset|\\nsupset|\\subset|\\supset|\\notin|\\in|\\cup|\\cap|\\leq?|\\geq?|\\neq|\\mid|\\land|\\lor|\\to|\\Rightarrow|\\cdot|\\times|\\div|\\pm|\\approx|\+|-|\/)\s*${SIMPLE_MATH_OPERAND})+)(?![\w$])`,
        'g',
    );
    const ALGEBRAIC_TERM_PATTERN = String.raw`(?:\([A-Za-z0-9+\-*/^.,\s]+\)(?:\^\{?[^}\s]+\}?)?|[+\-]?(?:\d+(?:[.,]\d+)?)?[A-Za-z](?:\^\{?[^}\s]+\}?)?|[+\-]?\d+(?:[.,]\d+)?)`;
    const ALGEBRAIC_FORMULA_PATTERN = new RegExp(
        String.raw`(?<![$\\\w])(${ALGEBRAIC_TERM_PATTERN}(?:\s*(?:=|<|>|≤|≥|\+|-|\/|×|·|÷)\s*${ALGEBRAIC_TERM_PATTERN})+)(?![\w$])`,
        'g',
    );
    const BROKEN_ARTIFACT_PATTERN = /\\?\[span_[^\]]+\]\((?:start|end)_span\)|span_\d+|tv\/images\/slides\/\d+|bitstream\/handle\/\d+\/[^\s)]+/gi;
    const RESIDUAL_TEX_PATTERN = /\\(?:[A-Za-z]+|[()[\]{}=<>+\-*/|,.!?:;%])/;
    const REFERENCE_NOISE_PATTERN = /(ICTI-UFBA|tv\/images|bitstream\/handle|Referências citadas)/i;

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttribute(value) {
        return escapeHtml(value).replace(/`/g, '&#96;');
    }

    function slugify(text) {
        return String(text)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function maybeFixMojibake(text) {
        if (!/[ÃƒÃ‚Ã¢â‚¬]/.test(text)) {
            return text;
        }

        try {
            return decodeURIComponent(escape(text));
        } catch (_error) {
            return text;
        }
    }

    function cleanHeading(text) {
        return String(text)
            .replace(/[#*`]/g, '')
            .replace(/^[^\p{L}\p{N}]+/u, '')
            .replace(/^\d+\s*\\?\.\s*/u, '')
            .replace(/\((?:2[-–]4\s+linhas?|com gabarito)\)/giu, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalizeKey(text) {
        return cleanHeading(text)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\b(n|z|q|i|r)\b/g, ' ')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function normalizeMarkdownSource(source) {
        return maybeFixMojibake(source)
            .replace(/\r\n?/g, '\n')
            .replace(/\\\\/g, '\\')
            .replace(/\\frac\{\$([^{}]+)\$\}\{\$([^{}]+)\$\}/g, String.raw`\frac{$1}{$2}`)
            .replace(/\\frac\{\$([^{}]+)\$\}\{([^{}]+)\}/g, String.raw`\frac{$1}{$2}`)
            .replace(/\\frac\{([^{}]+)\}\{\$([^{}]+)\$\}/g, String.raw`\frac{$1}{$2}`)
            .replace(/\\sqrt\{\$([^{}]+)\$\}/g, String.raw`\sqrt{$1}`)
            .replace(/\\text\{\$([^{}]+)\$\}/g, String.raw`\text{$1}`)
            .replace(/\\([()[\]=<>!%:+\-.])/g, '$1')
            .replace(/\\,/g, ',')
            .replace(/\\;/g, ';')
            .replace(/\u00A0/g, ' ')
            .trim();
    }

    function withProtectedMath(text, transformer) {
        const protectedSegments = [];
        const safeText = text.replace(PROTECTED_MATH_PATTERN, (match) => {
            const token = `@@MATH${protectedSegments.length}@@`;
            protectedSegments.push(match);
            return token;
        });

        const transformed = transformer(safeText);
        return transformed.replace(/@@MATH(\d+)@@/g, (_match, index) => protectedSegments[Number(index)]);
    }

    function wrapMatches(text, pattern, validator) {
        return withProtectedMath(text, (safeText) =>
            safeText.replace(pattern, (match, expression) => {
                const candidate = (typeof expression === 'string' ? expression : match).trim();

                if (!candidate || (validator && !validator(candidate))) {
                    return match;
                }

                return `$${candidate}$`;
            }),
        );
    }

    function looksLikeMathExpression(expression) {
        return /[A-Za-z0-9\\]/.test(expression) && /(?:=|<|>|\+|-|\/|\^|\\cup|\\cap|\\in|\\subset|\\le|\\ge|\\cdot|\\times|\\div|\\frac|\\sqrt)/.test(expression);
    }

    function normalizeInlineMath(line) {
        let text = line;

        text = wrapMatches(text, STRICT_TEX_EXPRESSION_PATTERN, looksLikeMathExpression);
        text = wrapMatches(text, ALGEBRAIC_FORMULA_PATTERN, looksLikeMathExpression);
        text = wrapMatches(text, TEX_ATOM_PATTERN);

        text = withProtectedMath(text, (safeText) =>
            safeText.replace(/(:\s*)((?:\\\{.*?\\\}|\\mathbb\{[^}]+\}|\\mathcal\{[^}]+\}|\\frac\{[^}]+\}\{[^}]+\}|\\sqrt\{[^}]+\}|[+\-]?(?:\d+(?:[.,]\d+)?)?[A-Za-z](?:\^\{?[^}\s]+\}?)?|\([^)\n]+\)(?:\^\{?[^}\s]+\}?)?)(?:\s*(?:=|<|>|\+|-|\/|×|·|÷|\\cup|\\cap|\\in|\\subseteq|\\subset|\\leq?|\\geq?|\\cdot|\\times|\\div|\\pm)\s*(?:\\\{.*?\\\}|\\mathbb\{[^}]+\}|\\mathcal\{[^}]+\}|\\frac\{[^}]+\}\{[^}]+\}|\\sqrt\{[^}]+\}|[+\-]?(?:\d+(?:[.,]\d+)?)?[A-Za-z](?:\^\{?[^}\s]+\}?)?|\([^)\n]+\)(?:\^\{?[^}\s]+\}?)?))+)(?=\s*(?:[.)]|$))/g, (_match, prefix, expression) => {
                const candidate = expression.trim();
                return looksLikeMathExpression(candidate) ? `${prefix}$${candidate}$` : `${prefix}${candidate}`;
            }),
        );

        return text;
    }

    function markDisplayFormulaLines(text) {
        return withProtectedMath(text, (safeText) =>
            safeText
                .split('\n')
                .map((line) => {
                    const trimmed = line.trim();

                    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('|') || trimmed.startsWith('>')) {
                        return line;
                    }

                    const candidate = trimmed
                        .replace(/^[-*]\s+/, '')
                        .replace(/^\d+\.\s+/, '')
                        .trim();

                    const mathDense =
                        looksLikeMathExpression(candidate) &&
                        !/[.!?]/.test(candidate) &&
                        candidate.length <= 96 &&
                        candidate.replace(/[A-Za-zÀ-ÿ0-9\\{}()[\]^_+\-*/=<>|.,;:\s$]/g, '').length === 0 &&
                        candidate.split(/\s+/).filter((token) => /[A-Za-zÀ-ÿ]{4,}/.test(token)).length <= 2;

                    if (mathDense && !trimmed.startsWith('-') && !trimmed.startsWith('*') && !/^\d+\./.test(trimmed)) {
                        return line.replace(candidate, `$$${candidate}$$`);
                    }

                    return line;
                })
                .join('\n'),
        );
    }

    function formatTeachingMarkdown(markdown, sectionType) {
        let text = markdown
            .replace(/\*\*Exemplo\s+(\d+):\*\*/gi, '\n\n##### Exemplo $1\n')
            .replace(/\*\*Pergunta:\*\*/gi, '\n\n**Enunciado:** ')
            .replace(/\*(?:Passo a passo):\*|\*\*(?:Passo a passo):\*\*/gi, '\n\n**Passo a passo**\n')
            .replace(/\*(?:Resposta):\*|\*\*(?:Resposta):\*\*/gi, '\n\n**Resposta final:** ')
            .replace(/\*\*Gabarito com passo a passo:\*\*/gi, '\n\n**Gabarito comentado**\n')
            .replace(/\*\*Gabarito:\*\*/gi, '\n\n**Gabarito**\n');

        if (sectionType === 'exercises') {
            text = text.replace(/\*\*(\d+)\.?\*\*/g, '\n$1.');
        }

        return text.replace(/\n{3,}/g, '\n\n').trim();
    }

    function hasCorruptedReferenceContent(body) {
        const oddInlineDelimiters = (body.match(/\$/g) || []).length % 2 !== 0;
        const badArtifacts = hasBrokenArtifacts(body) || REFERENCE_NOISE_PATTERN.test(body);
        const brokenTable = /^\|.*\$\]|\|\s*\*\*Passo a passo:\*\*/m.test(body);
        const brokenDisplay = /\*\*\$\$\*\*|\\f\[|\\implie\b|\\text\{[^}]+\}\s*[A-Za-z]\)/.test(body);
        return oddInlineDelimiters || badArtifacts || brokenTable || brokenDisplay;
    }

    function latexToReadableText(text, { stripMarkdown = true } = {}) {
        let output = normalizeMarkdownSource(text)
            .replace(/^\\?\[\s*[xX]?\s*\\?\]\s*/, '')
            .replace(BROKEN_ARTIFACT_PATTERN, '')
            .replace(/\$\$(?:\s|\\.)*\$\$/g, '')
            .replace(/\\xrightarrow\{[^}]*\}/g, '→')
            .replace(/\\text\{([^{}]+)\}/g, '$1')
            .replace(/\\overline\{([^{}]+)\}/g, '$1̅')
            .replace(/\\f(?=\[)/g, '');

        for (let attempt = 0; attempt < 6; attempt += 1) {
            const next = output
                .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')
                .replace(/\\sqrt\{([^{}]+)\}/g, '√$1');

            if (next === output) {
                break;
            }

            output = next;
        }

        output = output
            .replace(/\\leftrightarrow/g, '↔')
            .replace(/\\Rightarrow|\\implies?|\\implie/g, '⇒')
            .replace(/\\rightarrow/g, '→')
            .replace(/\\not\\subseteq/g, '⊈')
            .replace(/\\not\\supseteq/g, '⊉')
            .replace(/\\not\\subset/g, '⊄')
            .replace(/\\not\\supset/g, '⊅')
            .replace(/\\mathbb\{N\}/g, 'ℕ')
            .replace(/\\mathbb\{Z\}/g, 'ℤ')
            .replace(/\\mathbb\{Q\}/g, 'ℚ')
            .replace(/\\mathbb\{R\}/g, 'ℝ')
            .replace(/\\mathbb\{I\}/g, '𝕀')
            .replace(/\\mathcal\{P\}/g, 'P')
            .replace(/\\subseteq/g, '⊆')
            .replace(/\\supseteq/g, '⊇')
            .replace(/\\subset/g, '⊂')
            .replace(/\\supset/g, '⊃')
            .replace(/\\notin/g, '∉')
            .replace(/\\emptyset/g, '∅')
            .replace(/\\cup/g, '∪')
            .replace(/\\cap/g, '∩')
            .replace(/\\land/g, '∧')
            .replace(/\\lor/g, '∨')
            .replace(/\\infty/g, '∞')
            .replace(/\\mid/g, '|')
            .replace(/\\neq|\\ne/g, '≠')
            .replace(/\\(?:leq|le)/g, '≤')
            .replace(/\\(?:geq|ge)/g, '≥')
            .replace(/\\approx/g, '≈')
            .replace(/\\equiv/g, '≡')
            .replace(/\\times/g, '×')
            .replace(/\\cdot/g, '·')
            .replace(/\\div/g, '÷')
            .replace(/\\pm/g, '±')
            .replace(/\\pi/g, 'π')
            .replace(/\\phi/g, 'φ')
            .replace(/\\circC/g, '°C')
            .replace(/\\dots|\\ldots/g, '…')
            .replace(/\\in/g, '∈')
            .replace(/\\([{}[\]()=<>+\-*/|,.!?:;%])/g, '$1')
            .replace(/\$/g, '')
            .replace(/\\(?=\s|$)/g, '')
            .replace(/\\/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (stripMarkdown) {
            output = output
                .replace(/\*\*([^*]+)\*\*/g, '$1')
                .replace(/\*([^*]+)\*/g, '$1')
                .trim();
        }

        return output;
    }

    function hasBrokenArtifacts(text) {
        BROKEN_ARTIFACT_PATTERN.lastIndex = 0;
        return BROKEN_ARTIFACT_PATTERN.test(text);
    }

    function containsResidualLatex(text) {
        return RESIDUAL_TEX_PATTERN.test(text) || /\$\$/.test(text);
    }

    function normalizeSectionMarkdown(markdown, { sectionType = 'default', source = 'primary' } = {}) {
        let text = normalizeLegacyMathDelimiters(normalizeMarkdownSource(markdown));
        text = formatTeachingMarkdown(text, sectionType);

        if (source === 'reference' && hasCorruptedReferenceContent(text)) {
            return '';
        }

        return text.trim();
    }

    function normalizeLegacyMathDelimiters(markdown) {
        let text = markdown;

        text = text
            .replace(BROKEN_ARTIFACT_PATTERN, '')
            .replace(/\\skull/g, 'caveira')
            .replace(/\\not\\subseteq/g, '⊈')
            .replace(/\\not\\supseteq/g, '⊉')
            .replace(/\\not\\subset/g, '⊄')
            .replace(/\\not\\supset/g, '⊅')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        text = withProtectedMath(text, (safeText) => safeText.split('\n').map((line) => normalizeInlineMath(line)).join('\n'));
        text = markDisplayFormulaLines(text);

        return text.trim();

        text = wrapMatches(text, TEX_EXPRESSION_PATTERN);
        text = wrapMatches(text, SET_EXPRESSION_PATTERN);
        text = wrapMatches(text, PLAIN_FORMULA_PATTERN, looksLikePlainFormula);
        text = wrapMatches(text, TEX_ATOM_PATTERN);

        text = withProtectedMath(text, (safeText) =>
            safeText
                .split('\n')
                .map((line) => {
                    const trimmed = line.trim();

                    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('|') || trimmed.startsWith('>')) {
                        return line;
                    }

                    const isDisplayCandidate =
                        /(?:\\frac|\\sqrt|\\mathbb|\\begin\{|=|\\subset|\\cup|\\cap|\\le|\\ge|\^)/.test(trimmed) &&
                        !/[.!?]/.test(trimmed) &&
                        trimmed.length <= 90 &&
                        trimmed.replace(/[A-Za-zÀ-ÿ0-9\\{}()[\]^_+\-*/=<>|.,;:\s$]/g, '').length === 0 &&
                        trimmed.split(/\s+/).filter((token) => /[A-Za-zÀ-ÿ]{4,}/.test(token)).length <= 2;

                    if (isDisplayCandidate && !trimmed.startsWith('*') && !trimmed.startsWith('-') && !/^\d+\./.test(trimmed)) {
                        return line.replace(trimmed, `$$${trimmed}$$`);
                    }

                    return line;
                })
                .join('\n'),
        );

        return text;
    }

    function normalizeMarkdown(markdown, options) {
        return normalizeSectionMarkdown(markdown, options);
    }

    function getSectionType(title) {
        const key = normalizeKey(title);

        if (key.includes('resumo')) return 'summary';
        if (key.includes('explicacao')) return 'explanation';
        if (key.includes('definicoes')) return 'definitions';
        if (key.includes('exemplos')) return 'examples';
        if (key.includes('erros')) return 'mistakes';
        if (key.includes('macetes')) return 'tips';
        if (key.includes('exercicios')) return 'exercises';
        if (key.includes('revisao')) return 'review';

        return 'default';
    }

    function parseArticleSections(markdown, headingPattern) {
        const matches = [...markdown.matchAll(headingPattern)];
        const sections = [];

        matches.forEach((match, index) => {
            const start = match.index + match[0].length;
            const end = index < matches.length - 1 ? matches[index + 1].index : markdown.length;

            sections.push({
                rawTitle: match[1],
                title: cleanHeading(match[1]),
                type: getSectionType(match[1]),
                body: markdown.slice(start, end).trim(),
            });
        });

        return sections;
    }

    function parsePrimaryArticle(markdown, fileMeta) {
        const normalized = normalizeMarkdownSource(markdown);
        const titleMatch = normalized.match(/^###\s+(.+)$/m);
        const sections = parseArticleSections(normalized, /^####\s+(.+)$/gm)
            .map((section) => ({
                ...section,
                body: normalizeMarkdown(section.body, {
                    sectionType: section.type,
                    source: 'primary',
                }),
            }))
            .filter((section) => section.body);

        return {
            title: cleanHeading(titleMatch?.[1] || fileMeta.title),
            sections,
        };
    }

    function parseManualReference(markdown) {
        const normalized = normalizeMarkdownSource(markdown);
        const matches = [...normalized.matchAll(/^###\s+(.+)$/gm)];
        const articles = new Map();

        matches.forEach((match, index) => {
            const title = cleanHeading(match[1]);
            const key = normalizeKey(title);

            if (key === 'referencias citadas') {
                return;
            }

            const start = match.index + match[0].length;
            const end = index < matches.length - 1 ? matches[index + 1].index : normalized.length;
            const body = normalized.slice(start, end).trim();

            const sections = parseArticleSections(body, /^####\s+(.+)$/gm)
                .map((section) => ({
                    ...section,
                    body: normalizeMarkdown(section.body, {
                        sectionType: section.type,
                        source: 'reference',
                    }),
                }))
                .filter((section) => section.body);

            if (!sections.length) {
                return;
            }

            articles.set(key, {
                title,
                sections,
            });
        });

        return articles;
    }

    function normalizeComparable(markdown) {
        return String(markdown)
            .replace(PROTECTED_MATH_PATTERN, (match) => match.replace(/\s+/g, ' '))
            .replace(/[#*`>|-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function areBodiesEquivalent(firstBody, secondBody) {
        return normalizeComparable(firstBody) === normalizeComparable(secondBody);
    }

    function getSectionMap(article) {
        const map = new Map();
        article.sections.forEach((section) => {
            if (!map.has(section.type)) {
                map.set(section.type, section);
            }
        });
        return map;
    }

    function normalizeReviewItem(text) {
        return normalizeMarkdownSource(text)
            .replace(/^\\?\[\s*[xX]?\s*\\?\]\s*/, '')
            .replace(/\\?\[span_[^\]]+\]\((?:start|end)_span\)/g, '')
            .replace(/\$\$(?:\s|\\.)*\$\$/g, '')
            .replace(/\\text\{([^}]+)\}/g, '$1')
            .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
            .replace(/\\sqrt\{([^}]+)\}/g, '√$1')
            .replace(/\\mathbb\{N\}/g, 'ℕ')
            .replace(/\\mathbb\{Z\}/g, 'ℤ')
            .replace(/\\mathbb\{Q\}/g, 'ℚ')
            .replace(/\\mathbb\{R\}/g, 'ℝ')
            .replace(/\\mathbb\{I\}/g, '𝕀')
            .replace(/\\mathcal\{P\}/g, 'P')
            .replace(/\\leftrightarrow/g, '↔')
            .replace(/\\Rightarrow|\\implies/g, '⇒')
            .replace(/\\rightarrow/g, '→')
            .replace(/\\subseteq/g, '⊆')
            .replace(/\\supseteq/g, '⊇')
            .replace(/\\subset/g, '⊂')
            .replace(/\\supset/g, '⊃')
            .replace(/\\notin/g, '∉')
            .replace(/\\emptyset/g, '∅')
            .replace(/\\cup/g, '∪')
            .replace(/\\cap/g, '∩')
            .replace(/\\land/g, '∧')
            .replace(/\\lor/g, '∨')
            .replace(/\\infty/g, '∞')
            .replace(/\\in/g, '∈')
            .replace(/\\mid/g, '|')
            .replace(/\\neq/g, '≠')
            .replace(/\\(?:leq|le)/g, '≤')
            .replace(/\\(?:geq|ge)/g, '≥')
            .replace(/\\approx/g, '≈')
            .replace(/\\times/g, '×')
            .replace(/\\cdot/g, '·')
            .replace(/\\div/g, '÷')
            .replace(/\\pm/g, '±')
            .replace(/\\pi/g, 'π')
            .replace(/\\phi/g, 'φ')
            .replace(/\\dots|\\ldots/g, '…')
            .replace(/\\([{}[\]()=<>+\-*/|,.!?:;%])/g, '$1')
            .replace(/\\(?=\s)/g, '')
            .replace(/\$/g, '')
            .replace(/\(ex:\s*[^A-Za-z0-9)]*\)\.?/gi, '')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/\\/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function isUsefulReviewItem(text) {
        return Boolean(text) && !/span/i.test(text);
    }

    function normalizeReviewPillItem(text) {
        return latexToReadableText(text)
            .replace(/\(ex:\s*[^A-Za-z0-9)]*\)\.?/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function collectReviewItems(body) {
        return body
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => /^[*-]\s+/.test(line))
            .map((line) => normalizeReviewPillItem(line.replace(/^[*-]\s+/, '')))
            .filter(isUsefulReviewItem);
    }

    function mergeArticleSources(primaryArticle, referenceArticle, fileMeta, module) {
        const primaryMap = getSectionMap(primaryArticle);
        const referenceMap = referenceArticle ? getSectionMap(referenceArticle) : new Map();
        const types = Array.from(new Set([...primaryMap.keys(), ...referenceMap.keys()])).sort(
            (left, right) => SECTION_ORDER.indexOf(left) - SECTION_ORDER.indexOf(right),
        );

        const sections = types.map((type) => {
            const primarySection = primaryMap.get(type) || null;
            const referenceSection = referenceMap.get(type) || null;

            const mainSection = primarySection || referenceSection;
            const supplementSection =
                primarySection && referenceSection && !areBodiesEquivalent(primarySection.body, referenceSection.body)
                    ? referenceSection
                    : null;

            return {
                type,
                title: mainSection?.title || SECTION_LABELS[type] || 'Conteúdo',
                mainBody: mainSection?.body || '',
                supplementBody: supplementSection?.body || '',
            };
        });

        const summaryTexts = sections
            .filter((section) => section.type === 'summary')
            .flatMap((section) => [section.mainBody, section.supplementBody])
            .filter(Boolean);

        const reviewItems = Array.from(
            new Set(
                sections
                    .filter((section) => section.type === 'review')
                    .flatMap((section) => collectReviewItems(section.mainBody).concat(collectReviewItems(section.supplementBody))),
            ),
        );

        return {
            ...fileMeta,
            title: primaryArticle.title || referenceArticle?.title || fileMeta.title,
            anchor: `${module.slug}-${slugify(fileMeta.title)}`,
            intro: excerpt(summaryTexts.join(' '), 220) || module.description,
            reviewItems,
            sections,
        };
    }

    function stripMarkdown(text) {
        return String(text)
            .replace(PROTECTED_MATH_PATTERN, ' ')
            .replace(/[#*`>|-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function excerpt(text, maxLength) {
        const plain = stripMarkdown(text);

        if (plain.length <= maxLength) {
            return plain;
        }

        return `${plain.slice(0, maxLength).trimEnd()}…`;
    }

    function decorateRenderedMarkdown(html) {
        return String(html)
            .replace(/<table>/g, '<div class="study-table-wrap"><table class="study-table">')
            .replace(/<\/table>/g, '</table></div>')
            .replace(/<blockquote>/g, '<blockquote class="study-callout">')
            .replace(/<pre>/g, '<pre class="study-code-block">')
            .replace(/<code>/g, '<code class="study-inline-code">')
            .replace(/<(h[1-4])>/g, '<$1 class="study-inline-heading">')
            .replace(/<(ul|ol)>/g, '<$1 class="study-list">');
    }

    function renderMarkdown(markdown) {
        return decorateRenderedMarkdown(markedApi.parse(markdown));
    }

    function renderSubsection(label, markdown, tone) {
        const modifier = tone ? ` study-subsection--${tone}` : '';

        return `
            <div class="study-subsection${modifier}">
                ${label ? `<div class="study-subsection__label">${escapeHtml(label)}</div>` : ''}
                <div class="study-prose">
                    ${renderMarkdown(markdown)}
                </div>
            </div>
        `;
    }

    function splitExerciseBody(markdown) {
        const parts = markdown.split(/\*\*Gabarito(?: com passo a passo| comentado)?(?::)?\*\*/i);
        return {
            prompt: (parts[0] || '').trim(),
            answer: (parts[1] || '').trim(),
        };
    }

    function renderExerciseStack(label, markdown, tone) {
        const { prompt, answer } = splitExerciseBody(markdown);

        return `
            <div class="study-subsection study-subsection--exercise ${tone ? `study-subsection--${tone}` : ''}">
                <div class="study-subsection__label">${escapeHtml(label)}</div>
                <div class="study-prose">
                    ${renderMarkdown(prompt)}
                </div>
                ${
                    answer
                        ? `
                    <details class="study-answer">
                        <summary>Ver gabarito</summary>
                        <div class="study-prose">
                            ${renderMarkdown(answer)}
                        </div>
                    </details>
                `
                        : ''
                }
            </div>
        `;
    }

    function renderReviewSection(section) {
        const reviewItems = Array.from(new Set(collectReviewItems(section.mainBody).concat(collectReviewItems(section.supplementBody))));

        if (reviewItems.length) {
            return `
                <div class="review-pill-grid">
                    ${reviewItems.map((item) => `<span class="review-pill">${escapeHtml(item)}</span>`).join('')}
                </div>
            `;
        }

        return `
            <div class="study-prose">
                ${renderMarkdown(section.mainBody)}
                ${section.supplementBody ? renderMarkdown(section.supplementBody) : ''}
            </div>
        `;
    }

    function renderSection(section) {
        let bodyHtml = renderSubsection('', section.mainBody, 'main');

        if (section.type === 'exercises') {
            bodyHtml = renderExerciseStack('Lista principal', section.mainBody, 'main');
            if (section.supplementBody) {
                bodyHtml += renderExerciseStack('Exercícios complementares do manual', section.supplementBody, 'reference');
            }
        } else if (section.type === 'review') {
            bodyHtml = renderReviewSection(section);
        } else if (section.supplementBody) {
            bodyHtml = `
                ${renderSubsection('Material-base do assunto', section.mainBody, 'main')}
                ${renderSubsection('Aprofundamento do manual completo', section.supplementBody, 'reference')}
            `;
        }

        return `
            <section class="study-section study-section--${section.type}">
                <div class="study-section__header">
                    <span class="study-section__eyebrow">${SECTION_LABELS[section.type] || SECTION_LABELS.default}</span>
                    <h4 class="study-section__title">${escapeHtml(section.title)}</h4>
                </div>
                ${bodyHtml}
            </section>
        `;
    }

    function buildModuleTutorPrompt(module, focus) {
        return [
            `Explique o modulo "${module.title}" em linguagem simples.`,
            focus ? `Foque em: ${focus}.` : '',
            'Quero resumo rapido, explicacao, o que observar, erros comuns e um exemplo curto.',
        ]
            .filter(Boolean)
            .join(' ');
    }

    function buildModulePracticePrompt(module) {
        return [
            `Crie 3 exercicios graduais sobre ${module.quizTopic || module.title}.`,
            'Quero enunciado curto, dica breve, erro comum e gabarito comentado.',
        ].join(' ');
    }

    function renderModuleFlowCard(module) {
        const artifactTarget = module.artifacts?.length ? `${module.slug}-artifacts` : '';

        return `
            <article class="content-sheet content-sheet--flow">
                <header class="content-sheet__header">
                    <div>
                        <span class="content-sheet__kicker">Rota sugerida</span>
                        <h3>Estude, observe, pratique e confira</h3>
                    </div>
                    <p>Use esta ordem para nao transformar o modulo em uma colecao de blocos soltos. A ideia e fechar um ciclo curto de entendimento.</p>
                </header>
                <div class="module-flow-card">
                    <div class="module-flow-card__steps">
                        <section class="module-flow-step">
                            <span class="module-flow-step__index">1</span>
                            <h4>Estude o bloco principal</h4>
                            <p>Leia a explicacao com calma e anote a ideia central antes de correr para o exercicio.</p>
                        </section>
                        <section class="module-flow-step">
                            <span class="module-flow-step__index">2</span>
                            <h4>Observe no artefato</h4>
                            <p>${escapeHtml(module.artifacts?.length ? 'Abra um recurso visual deste modulo para ver o conceito em movimento.' : 'Use o Tutor IA para pedir um exemplo curto e visual deste assunto.')}</p>
                        </section>
                        <section class="module-flow-step">
                            <span class="module-flow-step__index">3</span>
                            <h4>Faca pratica curta</h4>
                            <p>Teste o padrao em uma pergunta simples antes de partir para uma bateria maior.</p>
                        </section>
                        <section class="module-flow-step">
                            <span class="module-flow-step__index">4</span>
                            <h4>Cheque com o tutor</h4>
                            <p>Se restar duvida, abra o Tutor IA para revisar o erro comum ou pedir um exemplo guiado.</p>
                        </section>
                    </div>
                    <div class="content-next-step__actions">
                        ${
                            artifactTarget
                                ? `<button class="btn btn--primary" data-scroll-target="${escapeAttribute(artifactTarget)}">Ir para artefatos</button>`
                                : `<button class="btn btn--primary" data-chat-launcher="${escapeAttribute(buildModuleTutorPrompt(module, 'um exemplo visual do conceito principal'))}">Abrir Tutor IA</button>`
                        }
                        <button class="btn btn--secondary" data-quiz-topic="${escapeAttribute(module.quizTopic || module.title)}">Fazer pratica curta</button>
                    </div>
                </div>
            </article>
        `;
    }

    function renderArticleNextStep(module, article, articleIndex) {
        const nextArticle = module.articles[articleIndex + 1];
        const artifactTarget = module.artifacts?.length ? `${module.slug}-artifacts` : '';
        const tutorPrompt = buildModuleTutorPrompt(module, article.title);
        const guidance = nextArticle
            ? `Se este bloco ficou claro, avance para "${nextArticle.title}" ou leve a ideia para um artefato do modulo.`
            : module.artifacts?.length
                ? 'Agora leve esta leitura para um artefato e depois feche com uma pratica curta.'
                : 'Agora feche com uma pratica curta ou abra o Tutor IA para revisar um exemplo do mesmo assunto.';

        return `
            <div class="content-next-step">
                <span class="content-next-step__eyebrow">Depois deste bloco</span>
                <h4>Feche a leitura com uma acao clara.</h4>
                <p>${escapeHtml(guidance)}</p>
                <div class="content-next-step__actions">
                    ${
                        artifactTarget
                            ? `<button class="btn btn--primary" data-scroll-target="${escapeAttribute(artifactTarget)}">Ver artefato relacionado</button>`
                            : `<button class="btn btn--primary" data-quiz-topic="${escapeAttribute(module.quizTopic || module.title)}">Fazer pratica curta</button>`
                    }
                    ${
                        nextArticle
                            ? `<button class="btn btn--secondary" data-scroll-target="${escapeAttribute(nextArticle.anchor)}">Ir para ${escapeHtml(nextArticle.title)}</button>`
                            : `<button class="btn btn--secondary" data-chat-launcher="${escapeAttribute(buildModulePracticePrompt(module))}">Pedir exercicios ao Tutor IA</button>`
                    }
                    <button class="btn btn--secondary" data-chat-launcher="${escapeAttribute(tutorPrompt)}">Revisar com Tutor IA</button>
                </div>
            </div>
        `;
    }

    function renderModuleTutorLauncher(module) {
        return `
            <article class="content-sheet content-sheet--support">
                <header class="content-sheet__header">
                    <div>
                        <span class="content-sheet__kicker">Tutor IA</span>
                        <h3>Use o tutor como apoio, nao como bloco solto</h3>
                    </div>
                    <p>Em vez de responder dentro do modulo, o tutor abre no painel dedicado com leitura em blocos curtos. Escolha uma acao clara e continue estudando sem poluicao visual.</p>
                </header>
                <div class="module-tutor-card">
                    <p class="module-tutor-card__lead">Escolha um pedido objetivo para receber resposta curta, organizada e facil de escanear.</p>
                    <div class="module-tutor-card__actions">
                        <button class="btn btn--primary" data-chat-launcher="${escapeAttribute(buildModuleTutorPrompt(module, module.aiTopic || module.title))}">Explicar este modulo</button>
                        <button class="btn btn--secondary" data-chat-launcher="${escapeAttribute(buildModulePracticePrompt(module))}">Gerar exercicios</button>
                        <button class="btn btn--secondary" data-chat-launcher="${escapeAttribute(`Quais sao os erros mais comuns em ${module.title} e como evita-los na prova?`)}">Erros comuns</button>
                    </div>
                    <p class="module-tutor-card__note">Dica: cite o bloco ou o artefato que voce acabou de estudar para receber uma resposta mais precisa.</p>
                </div>
            </article>
        `;
    }

    async function fetchMarkdown(path) {
        if (contentCache.has(path)) {
            return contentCache.get(path);
        }

        const request = fetch(path)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Não foi possível carregar ${path}`);
                }

                return response.text();
            })
            .catch((error) => {
                contentCache.delete(path);
                throw error;
            });

        contentCache.set(path, request);
        return request;
    }

    async function getManualReferenceMap() {
        if (manualCache.value) {
            return manualCache.value;
        }

        manualCache.value = fetchMarkdown(window.CONTENT_LIBRARY.referenceManual)
            .then(parseManualReference)
            .catch((error) => {
                console.warn('[content] manual de referência indisponível; seguindo apenas com o material-base.', error);
                return new Map();
            });
        return manualCache.value;
    }

    function createEmptyArticle(title) {
        return {
            title: title || '',
            sections: [],
        };
    }

    function createFallbackArticle(fileMeta, module, referenceArticle, reason = '') {
        const referenceMap = referenceArticle ? getSectionMap(referenceArticle) : new Map();
        const reviewSection = referenceMap.get('review');
        const summarySection = referenceMap.get('summary');
        const reviewItems = Array.from(
            new Set(
                []
                    .concat(module.reviewHighlights || [])
                    .concat(reviewSection ? collectReviewItems(reviewSection.body) : []),
            ),
        ).slice(0, 6);
        const fallbackNote = reason
            ? `O arquivo principal deste tópico não carregou agora (${reason}). Esta versão resumida mantém os pontos essenciais para você continuar estudando.`
            : 'Esta versão resumida foi montada para preservar a navegação e os principais conceitos do módulo.';

        const sections = [
            {
                type: 'summary',
                title: 'Resumo rápido',
                mainBody: summarySection?.body || `${module.subtitle || module.description}\n\n${fallbackNote}`,
                supplementBody: '',
            },
            {
                type: 'review',
                title: 'Revisão rápida',
                mainBody: reviewItems.length
                    ? reviewItems.map((item) => `- ${item}`).join('\n')
                    : `- ${module.description || module.subtitle || 'Revise os conceitos centrais deste assunto.'}`,
                supplementBody: '',
            },
        ];

        return {
            ...fileMeta,
            title: referenceArticle?.title || fileMeta.title,
            anchor: `${module.slug}-${slugify(fileMeta.title)}`,
            intro: excerpt(`${module.description || module.subtitle || fileMeta.title} ${fallbackNote}`, 220),
            reviewItems,
            sections,
        };
    }

    async function loadCourseContent(modules) {
        const manualMap = await getManualReferenceMap();

        return Promise.all(
            modules.map(async (module) => {
                const articles = await Promise.all(
                    module.files.map(async (fileMeta) => {
                        const referenceArticle =
                            fileMeta.useManual === false
                                ? null
                                : manualMap.get(normalizeKey(fileMeta.manualTitle || fileMeta.title)) || null;

                        try {
                            const primaryMarkdown = await fetchMarkdown(fileMeta.path);
                            const primaryArticle = parsePrimaryArticle(primaryMarkdown, fileMeta);
                            const mergedArticle = mergeArticleSources(primaryArticle, referenceArticle, fileMeta, module);

                            return mergedArticle.sections?.length
                                ? mergedArticle
                                : createFallbackArticle(fileMeta, module, referenceArticle, 'arquivo sem seções utilizáveis');
                        } catch (error) {
                            console.error(`[content] falha ao carregar ${fileMeta.path}`, error);

                            const recoveredArticle = mergeArticleSources(
                                createEmptyArticle(fileMeta.title),
                                referenceArticle,
                                fileMeta,
                                module,
                            );

                            return recoveredArticle.sections?.length
                                ? recoveredArticle
                                : createFallbackArticle(
                                      fileMeta,
                                      module,
                                      referenceArticle,
                                      error instanceof Error ? error.message : String(error),
                                  );
                        }
                    }),
                );

                return {
                    ...module,
                    articles,
                    artifacts: (module.artifactSlugs || []).map((slug) => artifactMap.get(slug)).filter(Boolean),
                };
            }),
        );
    }

    function buildModuleLabelMap(modules) {
        return new Map((modules || []).map((module) => [module.slug, module.title]));
    }

    function getArtifactCategory(artifact) {
        return (artifactsLibrary.categories || []).find((category) => category.slug === artifact.category) || null;
    }

    function buildArtifactFrameId(scopeId, artifact) {
        return `${scopeId}-${slugify(artifact.slug || artifact.title)}`;
    }

    function buildArtifactEmbedUrl(artifact, frameId) {
        const params = new URLSearchParams({
            frameId,
            src: `/content/artifacts/raw/${artifact.file}`,
        });

        return `${artifactsLibrary.hostPage}?${params.toString()}`;
    }

    function normalizeArtifactText(value) {
        return String(value || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function renderArtifactContextBox(label, value) {
        const text = normalizeArtifactText(value);

        if (!text) {
            return '';
        }

        return `
            <div class="artifact-context-box">
                <span class="artifact-context-box__label">${escapeHtml(label)}</span>
                <p>${escapeHtml(text)}</p>
            </div>
        `;
    }

    function getArtifactPedagogy(artifact) {
        const override = artifactsLibrary.pedagogyBySlug?.[artifact.slug] || {};

        return {
            teaches: normalizeArtifactText(artifact.teaches || override.teaches || artifact.summary || ''),
            whyHere: normalizeArtifactText(override.whyHere || artifact.whenToUse || ''),
            whenToUse: normalizeArtifactText(artifact.whenToUse || ''),
            observe: normalizeArtifactText(artifact.observe || ''),
            examBridge: normalizeArtifactText(override.examBridge || ''),
            gain: normalizeArtifactText(override.gain || ''),
            hint: normalizeArtifactText(artifact.hint || ''),
        };
    }

    function renderArtifactDidacticGrid(artifact) {
        const pedagogy = getArtifactPedagogy(artifact);
        const learningBoxes = [
            renderArtifactContextBox('Ideia central', pedagogy.teaches),
            renderArtifactContextBox('Por que esta aqui', pedagogy.whyHere),
            renderArtifactContextBox('Quando usar', pedagogy.whenToUse),
        ].filter(Boolean);
        const practiceBoxes = [
            renderArtifactContextBox('O que observar', pedagogy.observe),
            renderArtifactContextBox('Na prova', pedagogy.examBridge),
        ].filter(Boolean);
        const closingNotes = [pedagogy.gain && `Ganho de entendimento: ${pedagogy.gain}`, pedagogy.hint && `Como explorar: ${pedagogy.hint}`].filter(Boolean);

        if (!learningBoxes.length && !practiceBoxes.length && !closingNotes.length) {
            return '';
        }

        return `
            <div class="artifact-lesson-stack">
                ${
                    learningBoxes.length
                        ? `
                <section class="artifact-lesson-section">
                    <span class="artifact-lesson-section__eyebrow">Leitura guiada</span>
                    <div class="artifact-context-grid artifact-context-grid--lesson">
                        ${learningBoxes.join('')}
                    </div>
                </section>
            `
                        : ''
                }
                ${
                    practiceBoxes.length
                        ? `
                <section class="artifact-lesson-section">
                    <span class="artifact-lesson-section__eyebrow">Pensando na prova</span>
                    <div class="artifact-context-grid artifact-context-grid--lesson">
                        ${practiceBoxes.join('')}
                    </div>
                </section>
            `
                        : ''
                }
                ${
                    closingNotes.length
                        ? `
                <div class="artifact-lesson-note">
                    <span class="artifact-lesson-note__label">Fechamento</span>
                    <p>${escapeHtml(closingNotes.join(' '))}</p>
                </div>
            `
                        : ''
                }
            </div>
        `;
    }

    function renderArtifactModulePills(artifact, moduleLabelMap) {
        const labels = artifact.moduleSlugs?.length
            ? artifact.moduleSlugs.map((slug) => moduleLabelMap.get(slug) || slug)
            : ['Exploracao complementar'];

        return labels
            .map((label) => `<span class="artifact-chip">${escapeHtml(label)}</span>`)
            .join('');
    }

    function renderArtifactCard(artifact, { scopeId = 'lab', moduleLabelMap = new Map() } = {}) {
        const category = getArtifactCategory(artifact);
        const priorityLabel = PRIORITY_LABELS[artifact.priority] || PRIORITY_LABELS.medium;
        const pedagogy = getArtifactPedagogy(artifact);

        return `
            <article class="artifact-card" data-artifact-id="${escapeAttribute(artifact.slug || '')}" onclick="window.appOpenLaboratoryExperience(this.dataset.artifactId)">
                <div class="artifact-card__header">
                    <div>
                        <span class="artifact-card__eyebrow">${escapeHtml(category?.title || 'Artefato interativo')}</span>
                        <h4>${escapeHtml(artifact.title)}</h4>
                    </div>
                    <span class="artifact-priority artifact-priority--${escapeAttribute(artifact.priority || 'medium')}">${escapeHtml(priorityLabel)}</span>
                </div>

                <p class="artifact-card__summary artifact-card__summary--lead">${escapeHtml(artifact.summary)}</p>
                <div class="artifact-chip-row" style="margin-bottom: 6px;">
                    ${renderArtifactModulePills(artifact, moduleLabelMap)}
                </div>

                ${renderArtifactDidacticGrid(artifact)}

                ${
                    pedagogy.hint
                        ? `<p class="artifact-card__summary artifact-card__summary--hint">${escapeHtml(`Como explorar: ${pedagogy.hint}`)}</p>`
                        : ''
                }

                <div class="artifact-card__meta" style="margin-top:auto">
                    <button class="btn btn--secondary" type="button" style="pointer-events:none;">
                        Abrir artefato →
                    </button>
                </div>
            </article>
        `;
    }

    function renderModuleArtifactsSection(module, moduleLabelMap) {
        if (!module.artifacts?.length) {
            return '';
        }

        return `
            <section id="${escapeAttribute(`${module.slug}-artifacts`)}" class="module-artifacts">
                <div class="section-heading">
                    <div>
                        <span class="topic-label">Aprendizado visual</span>
                        <h3>Artefatos como mini aulas</h3>
                        <p>Cada artefato abaixo foi pensado para ser lido em sequencia: entenda a ideia central, observe o padrao e use a leitura para ganhar seguranca na resolucao.</p>
                    </div>
                    <button class="btn btn--secondary" data-nav="page-laboratorio">Ver laboratorio completo</button>
                </div>
                <div class="artifact-context-grid" style="margin-bottom: 18px;">
                    ${renderArtifactContextBox('Antes de abrir', 'Leia a ideia principal e tente prever o que o recurso vai revelar.')}
                    ${renderArtifactContextBox('Enquanto explora', 'Observe como simbolo, figura e variacao dos controles mudam a resposta.')}
                    ${renderArtifactContextBox('Depois de fechar', 'Resuma o padrao em uma frase e leve essa leitura para os exercicios.')}
                </div>
                <div class="artifact-grid">
                    ${module.artifacts.map((artifact) => renderArtifactCard(artifact, { scopeId: module.slug, moduleLabelMap })).join('')}
                </div>
            </section>
        `;
    }

    function renderLaboratoryPage(modules) {
        const moduleLabelMap = buildModuleLabelMap(modules);
        const featuredArtifacts = (artifactsLibrary.items || []).filter((artifact) => artifact.priority === 'high');
        const categories = (artifactsLibrary.categories || [])
            .map((category) => ({
                ...category,
                items: (artifactsLibrary.items || []).filter((artifact) => artifact.category === category.slug),
            }))
            .filter((category) => category.items.length);

        return `
            <section id="page-laboratorio" class="page page--narrow">
                <div class="lab-hero" data-accent="blue">
                    <div>
                        <span class="topic-label">Laboratorio Matematico</span>
                        <h2>Artefatos interativos organizados como estudo guiado</h2>
                        <p class="home-hero__lead">
                            Todos os ${artifactsLibrary.totalArtifacts || categories.reduce((count, category) => count + category.items.length, 0)} artefatos do projeto agora funcionam como pequenas aulas visuais: cada um explica um padrao, mostra o que observar e ajuda a levar a leitura para a prova.
                        </p>
                    </div>
                    <div class="lab-hero__stats">
                        <div class="lab-stat-card">
                            <strong>${modules.length}</strong>
                            <span>modulos com apoio visual</span>
                        </div>
                        <div class="lab-stat-card">
                            <strong>${featuredArtifacts.length}</strong>
                            <span>recursos com leitura prioritária</span>
                        </div>
                        <div class="lab-stat-card">
                            <strong>${categories.length}</strong>
                            <span>frentes tematicas organizadas</span>
                        </div>
                    </div>
                </div>
                <div class="artifact-context-grid" style="margin: 0 0 22px;">
                    ${renderArtifactContextBox('Como estudar', 'Comece pela ideia central, explore os controles e volte ao texto para nomear o padrao que apareceu.')}
                    ${renderArtifactContextBox('Quando abrir', 'Use na explicacao, na revisao ou quando um conteudo precisar sair do abstrato e ganhar forma.')}
                    ${renderArtifactContextBox('O que levar', 'Leve a relacao entre conceito, figura e prova para transformar a visualizacao em entendimento duradouro.')}
                </div>

                <section class="home-section">
                    <div class="section-heading">
                        <div>
                            <h3>Comece pelas mini aulas mais fortes</h3>
                            <p>Estes recursos entregam a ideia com mais rapidez e costumam ser os melhores pontos de entrada quando o assunto ainda parece abstrato.</p>
                        </div>
                    </div>
                    <div class="artifact-grid">
                        ${featuredArtifacts.map((artifact) => renderArtifactCard(artifact, { scopeId: 'featured', moduleLabelMap })).join('')}
                    </div>
                </section>

                ${categories
                    .map(
                        (category) => `
                            <section id="${escapeAttribute(`lab-${category.slug}`)}" class="lab-category" data-accent="${escapeAttribute(category.accent || 'blue')}">
                                <div class="section-heading">
                                    <div>
                                        <span class="topic-label">Tema</span>
                                        <h3>${escapeHtml(category.title)}</h3>
                                        <p>${escapeHtml(category.description)}</p>
                                    </div>
                                </div>
                                <div class="artifact-grid artifact-grid--dense">
                                    ${category.items.map((artifact) => renderArtifactCard(artifact, { scopeId: category.slug, moduleLabelMap })).join('')}
                                </div>
                            </section>
                        `,
                    )
                    .join('')}
            </section>
        `;
    }

    function renderHomeModules(modules) {
        return modules
            .map((module) => {
                const tags = module.files.map((file) => `<span class="module-chip">${escapeHtml(file.title)}</span>`).join('');
                const artifactCount = module.artifacts?.length || module.artifactSlugs?.length || 0;
                const metaParts = [`${module.files.length} assunto${module.files.length > 1 ? 's' : ''}`];
                const supportPills = [
                    '<span class="module-card__stat">Conteúdo real</span>',
                    artifactCount
                        ? `<span class="module-card__stat">${artifactCount} ${artifactCount > 1 ? 'recursos visuais' : 'recurso visual'}</span>`
                        : '',
                ]
                    .filter(Boolean)
                    .join('');

                if (artifactCount) {
                    metaParts.push(`${artifactCount} recurso${artifactCount > 1 ? 's' : ''} visuais`);
                }

                return `
                    <article class="module-card" data-accent="${escapeAttribute(module.accent)}">
                        <div class="module-card__topline">
                            <span class="topic-label">Módulo ${module.order}</span>
                            <span class="module-card__meta">${metaParts.join(' · ')}</span>
                        </div>
                        <div class="module-card__body">
                            <h3>${escapeHtml(module.title)}</h3>
                            <p class="module-card__description">${escapeHtml(module.subtitle)}</p>
                            <div class="module-card__stats">${supportPills}</div>
                            <div class="module-card__chips">${tags}</div>
                        </div>
                        <div class="module-card__footer">
                            <button class="btn--module" data-nav="${escapeAttribute(module.id)}">
                                <span>Abrir módulo</span>
                                <span class="module-arrow">→</span>
                            </button>
                        </div>
                    </article>
                `;
            })
            .join('');
    }

    function renderModulePage(module) {
        const moduleLabelMap = buildModuleLabelMap(window.COURSE_MODULES || window.MODULES_DATA || []);
        const articleLinks = module.articles
            .map(
                (article) => `
                    <button class="module-jump" data-scroll-target="${escapeAttribute(article.anchor)}">
                        <span>${escapeHtml(article.title)}</span>
                        <small>${escapeHtml(article.tag || 'Material')}</small>
                    </button>
                `,
            )
            .join('');
        const artifactsSection = renderModuleArtifactsSection(module, moduleLabelMap);
        const moduleFlowCard = renderModuleFlowCard(module);
        const tutorLauncher = renderModuleTutorLauncher(module);

        const articleCards = module.articles
            .map(
                (article, articleIndex) => `
                    <article id="${escapeAttribute(article.anchor)}" class="content-sheet">
                        <header class="content-sheet__header">
                            <div>
                                <span class="content-sheet__kicker">${escapeHtml(article.tag || 'Material de estudo')}</span>
                                <h3>${escapeHtml(article.title)}</h3>
                            </div>
                            <p>${escapeHtml(article.intro)}</p>
                        </header>
                        <div class="content-sheet__sections">
                            ${article.sections.map(renderSection).join('')}
                        </div>
                        ${renderArticleNextStep(module, article, articleIndex)}
                    </article>
                `,
            )
            .join('');

        return `
            <section id="${escapeAttribute(module.id)}" class="page module-page">
                <header class="module-hero" data-accent="${escapeAttribute(module.accent)}">
                    <div class="module-hero__copy">
                        <span class="topic-label">Módulo ${module.order}</span>
                        <h2 class="topic-title">${escapeHtml(module.title)}</h2>
                        <p class="module-hero__subtitle">${escapeHtml(module.subtitle)}</p>
                        <p class="module-hero__description">${escapeHtml(module.description)}</p>
                    </div>
                    <div class="module-hero__actions">
                        <button
                            class="btn btn--secondary feynman-btn"
                            data-ai-action="feynman"
                            data-ai-topic="${escapeAttribute(module.aiTopic)}"
                            data-feynman-title="${escapeAttribute(module.title)}"
                            data-feynman-module-id="${escapeAttribute(module.id)}"
                            data-feynman-module-slug="${escapeAttribute(module.slug)}"
                            data-feynman-module-name="${escapeAttribute(module.title)}"
                        >🧠 Testar se aprendi (Modo Feynman)</button>
                        <button class="btn btn--primary" data-quiz-topic="${escapeAttribute(module.quizTopic)}">Quiz deste módulo</button>
                        <button class="btn btn--secondary" data-nav="page-revisao">Revisão de véspera</button>
                    </div>
                </header>

                <div class="module-shell">
                    <div class="module-shell__content">
                        ${moduleFlowCard}
                        ${articleCards}
                        ${artifactsSection}
                        ${tutorLauncher}

                        <div class="ai-section">
                            <h3>Assistente de IA</h3>
                            <button
                                class="btn btn--secondary ai-btn"
                                data-ai-action="explain"
                                data-ai-topic="${escapeAttribute(module.aiTopic)}"
                            >
                                Explicar este módulo de forma mais simples
                            </button>
                            <button
                                class="btn btn--secondary ai-btn"
                                data-ai-action="exercises"
                                data-ai-topic="${escapeAttribute(module.quizTopic)}"
                            >
                                Gerar exercícios adicionais
                            </button>
                            <button
                                class="btn btn--primary feynman-btn"
                                data-ai-action="feynman"
                                data-ai-topic="${escapeAttribute(module.aiTopic)}"
                                data-feynman-title="${escapeAttribute(module.title)}"
                                data-feynman-module-id="${escapeAttribute(module.id)}"
                                data-feynman-module-slug="${escapeAttribute(module.slug)}"
                                data-feynman-module-name="${escapeAttribute(module.title)}"
                            >
                                🧠 Testar se aprendi (Modo Feynman)
                            </button>
                            <div class="ai-response-box hidden"></div>
                        </div>
                    </div>

                    <aside class="module-shell__aside">
                        <div class="card module-panel module-panel--map">
                            <h3>Mapa do módulo</h3>
                            <p>Navegação rápida pelos assuntos e pelos blocos aprofundados pelo manual.</p>
                            <div class="module-jump-list">
                                ${articleLinks}
                            </div>
                        </div>

                        <div class="card module-panel module-panel--focus">
                            <h3>Foco de prova</h3>
                            <p>Os pontos com maior chance de reaparecer em exercícios, revisões e simulado.</p>
                            <div class="review-pill-grid review-pill-grid--compact">
                                ${module.reviewHighlights
                                    .map((item) => `<span class="review-pill">${escapeHtml(item)}</span>`)
                                    .join('')}
                            </div>
                        </div>

                        ${
                            module.artifacts?.length
                                ? `
                            <div class="card module-panel module-panel--visual">
                                <h3>Proximo passo</h3>
                                <p>${module.artifacts.length} recurso${module.artifacts.length > 1 ? 's' : ''} visual${module.artifacts.length > 1 ? 's' : ''} espera logo abaixo. Use um artefato, feche com pratica curta e so depois avance.</p>
                                <div class="module-panel__actions">
                                    <button class="btn btn--secondary" data-scroll-target="${escapeAttribute(`${module.slug}-artifacts`)}">Ir para os artefatos</button>
                                    <button class="btn btn--secondary" data-quiz-topic="${escapeAttribute(module.quizTopic || module.title)}">Fazer pratica curta</button>
                                    <button class="btn btn--secondary" data-nav="page-laboratorio">Abrir laboratorio</button>
                                </div>
                            </div>
                        `
                                : ''
                        }
                    </aside>
                </div>
            </section>
        `;
    }

    function buildReviewItems(module) {
        const items = [];

        module.articles.forEach((article) => {
            if (article.reviewItems?.length) {
                items.push(...article.reviewItems);
            }
        });

        if (!items.length) {
            items.push(...module.reviewHighlights);
        }

        return Array.from(new Set(items)).slice(0, 6);
    }

    function renderReviewDashboard(modules) {
        return `
            <div class="review-dashboard">
                <div class="review-dashboard__intro card">
                    <span class="topic-label">Revisão integrada</span>
                    <h3>${window.CONTENT_LIBRARY.subjectFiles} arquivos por assunto + manual completo organizados em ${modules.length} módulos</h3>
                    <p>
                        Cada assunto agora combina o material-base entregue com a seção correspondente do manual amplo, enriquecendo explicações, exemplos, exercícios e revisão.
                    </p>
                </div>

                <div class="review-module-grid">
                    ${modules
                        .map((module) => {
                            const reviewItems = buildReviewItems(module);

                            return `
                                <article class="review-module-card" data-accent="${escapeAttribute(module.accent)}">
                                    <div class="review-module-card__head">
                                        <span class="topic-label">Módulo ${module.order}</span>
                                        <h3>${escapeHtml(module.title)}</h3>
                                        <p>${escapeHtml(module.subtitle)}</p>
                                    </div>
                                    <div class="review-pill-grid review-pill-grid--compact">
                                        ${reviewItems.map((item) => `<span class="review-pill">${escapeHtml(item)}</span>`).join('')}
                                    </div>
                                    <div class="review-module-card__actions">
                                        <button class="btn btn--secondary" data-nav="${escapeAttribute(module.id)}">Abrir módulo</button>
                                        <button class="btn btn--primary" data-quiz-topic="${escapeAttribute(module.quizTopic)}">Quiz rápido</button>
                                    </div>
                                </article>
                            `;
                        })
                        .join('')}
                </div>
            </div>
        `;
    }

    function sanitizeMathInput(math) {
        return maybeFixMojibake(String(math))
            .replace(BROKEN_ARTIFACT_PATTERN, '')
            .replace(/\$/g, '')
            .replace(/\\circC/g, String.raw`\!^\circ\mathrm{C}`)
            .replace(/\\f(?=\[)/g, '')
            .replace(/\\\\/g, '\\')
            .trim();
    }

    function replaceResidualLatexInTextNodes(root) {
        if (!root || !root.ownerDocument) {
            return;
        }

        const view = root.ownerDocument.defaultView || window;
        const nodeFilter = view.NodeFilter || window.NodeFilter;

        if (!nodeFilter) {
            return;
        }

        const walker = root.ownerDocument.createTreeWalker(
            root,
            nodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    if (!node?.nodeValue?.trim()) {
                        return nodeFilter.FILTER_REJECT;
                    }

                    const parent = node.parentElement;

                    if (!parent || parent.closest('.katex, script, style, textarea, code, pre')) {
                        return nodeFilter.FILTER_REJECT;
                    }

                    return containsResidualLatex(node.nodeValue) || hasBrokenArtifacts(node.nodeValue)
                        ? nodeFilter.FILTER_ACCEPT
                        : nodeFilter.FILTER_REJECT;
                },
            },
        );

        const pending = [];

        while (walker.nextNode()) {
            pending.push(walker.currentNode);
        }

        pending.forEach((node) => {
            const original = node.nodeValue;
            const normalized = latexToReadableText(original, { stripMarkdown: false });

            if (normalized && normalized !== original) {
                node.nodeValue = normalized;
            }

            if (containsResidualLatex(node.nodeValue)) {
                console.warn('[math] trecho residual após fallback:', node.nodeValue);
            }
        });
    }

    function renderMathIn(root) {
        if (!root) {
            return;
        }

        if (typeof window.renderMathInElement === 'function') {
            window.renderMathInElement(root, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '\\[', right: '\\]', display: true },
                    { left: '\\begin{equation}', right: '\\end{equation}', display: true },
                    { left: '\\begin{align}', right: '\\end{align}', display: true },
                ],
                throwOnError: false,
                strict: 'ignore',
                output: 'htmlAndMathML',
                preProcess: (math) => sanitizeMathInput(math),
                errorCallback: (message, error) => {
                    console.warn('[math] falha ao renderizar expressão:', message, error);
                },
            });
        }

        replaceResidualLatexInTextNodes(root);
    }

    window.ContentRenderer = {
        loadCourseContent,
        renderHomeModules,
        renderModulePage,
        renderLaboratoryPage,
        renderReviewDashboard,
        renderMathIn,
    };
})();
