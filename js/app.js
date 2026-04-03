function maybeFixMojibake(value) {
    const text = String(value ?? '');
    if (!/[ÃÂâ]/.test(text)) return text;

    try {
        return decodeURIComponent(escape(text));
    } catch (_error) {
        return text;
    }
}

function repairTextNodes(root) {
    if (!root || typeof document === 'undefined' || !document.createTreeWalker) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const blockedParents = new Set(['SCRIPT', 'STYLE', 'TEXTAREA']);
    let current = walker.nextNode();

    while (current) {
        const parentTag = current.parentElement?.tagName || '';
        const rawValue = current.nodeValue || '';
        if (!blockedParents.has(parentTag)) {
            const nextValue = maybeFixMojibake(rawValue);
            if (nextValue !== rawValue) {
                current.nodeValue = nextValue;
            }
        }
        current = walker.nextNode();
    }
}

function escapeHtml(value) {
    return maybeFixMojibake(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
}

function normalizeChatText(value) {
    return maybeFixMojibake(String(value ?? ''))
        .replace(/\r\n?/g, '\n')
        .replace(/\u00a0/g, ' ')
        .trim();
}

function isCompactViewport() {
    if (typeof window.matchMedia !== 'function') return window.innerWidth <= 720;
    return window.matchMedia('(max-width: 720px)').matches;
}

function getHeaderScrollOffset() {
    if (typeof document === 'undefined') return 104;
    const header = document.querySelector('.header');
    const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    return Math.max(92, headerHeight + 16);
}

function splitSentences(text) {
    return String(text || '')
        .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
        ?.map((sentence) => sentence.trim())
        .filter(Boolean) || [];
}

function takeSnippet(text, maxLength = 240) {
    const normalized = String(text || '').trim();
    if (!normalized) return '';
    if (normalized.length <= maxLength) return normalized;

    const sentence = splitSentences(normalized).slice(0, 2).join(' ').trim();
    if (sentence && sentence.length <= maxLength + 30) return sentence;

    const clipped = normalized.slice(0, maxLength);
    const cutIndex = Math.max(
        clipped.lastIndexOf('.'),
        clipped.lastIndexOf('!'),
        clipped.lastIndexOf('?'),
        clipped.lastIndexOf('\n'),
    );

    return `${(cutIndex > 80 ? clipped.slice(0, cutIndex + 1) : clipped).trim()}${normalized.length > maxLength ? '...' : ''}`;
}

function renderMarkdownFragment(value) {
    const content = String(value ?? '');
    const markedApi = window.marked?.parse ? window.marked : window.marked?.marked?.parse ? window.marked.marked : null;
    return markedApi ? markedApi.parse(content) : escapeHtml(content).replace(/\n/g, '<br>');
}

function isRawHtmlSnippet(value) {
    const content = String(value ?? '').trim();
    return /^<(?:(?:div|span|section|article|p|ul|ol|li|small|strong|em|details|summary)\b)/i.test(content);
}

const CHAT_SECTION_ALIASES = {
    summary: ['resumo rapido', 'resumo', 'visao rapida', 'sintese', 'sintese rapida'],
    explanation: ['explicacao', 'desenvolvimento', 'explicacao guiada', 'explicar'],
    observe: ['o que observar', 'observe', 'repare', 'perceba'],
    mistakes: ['erros comuns', 'erros', 'armadilhas', 'cuidado'],
    example: ['exemplo', 'exemplo guiado', 'mini exemplo', 'passo a passo'],
};

function detectChatSectionTitle(line) {
    const normalizedLine = normalizeLookup(
        String(line || '')
            .replace(/^#{1,6}\s+/, '')
            .replace(/^\s*(?:[-*+]|[0-9]+\.)\s+/, '')
            .replace(/^\*\*(.+)\*\*$/, '$1')
            .replace(/[:\-]\s*$/, ''),
    );

    if (!normalizedLine) return null;

    for (const [section, aliases] of Object.entries(CHAT_SECTION_ALIASES)) {
        if (aliases.some((alias) => normalizedLine === alias || normalizedLine.startsWith(`${alias} `) || normalizedLine.startsWith(`${alias}:`))) {
            return section;
        }
    }

    return null;
}

function extractChatSections(content) {
    const normalized = normalizeChatText(content);
    const lines = normalized.split('\n');
    const sections = {
        summary: '',
        explanation: '',
        observe: '',
        mistakes: '',
        example: '',
    };

    let currentSection = null;
    let currentBuffer = [];
    let foundStructuredSection = false;

    function commitBuffer() {
        if (!currentSection || !currentBuffer.length) {
            currentBuffer = [];
            return;
        }

        const body = currentBuffer.join('\n').trim();
        if (body) {
            sections[currentSection] = sections[currentSection]
                ? `${sections[currentSection]}\n\n${body}`
                : body;
        }
        currentBuffer = [];
    }

    for (const line of lines) {
        const section = detectChatSectionTitle(line);
        if (section) {
            foundStructuredSection = true;
            commitBuffer();
            currentSection = section;
            continue;
        }

        currentBuffer.push(line);
    }

    commitBuffer();

    if (!foundStructuredSection) {
        const paragraphs = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
        const body = paragraphs.join('\n\n');
        const bullets = normalized
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => /^[-*+]\s+|^[0-9]+\.\s+/.test(line));

        sections.summary = paragraphs.length ? takeSnippet(paragraphs[0], 260) : takeSnippet(normalized, 260);
        sections.explanation = paragraphs.length > 1 ? paragraphs.slice(1).join('\n\n') : body;
        sections.observe = normalized
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => /observe|repare|perceba|veja|note|atencao|atenção/i.test(line))
            .slice(0, 3)
            .join('\n')
            || takeSnippet(body, 180);
        sections.mistakes = bullets.filter((line) => /erro|cuidado|evite|nao|não|armad/i.test(line)).slice(0, 3).join('\n') || '';
        sections.example = normalized.match(/(?:exemplo|passo a passo|gabarito)[\s\S]*$/i)?.[0]?.trim() || '';
    }

    if (!sections.summary) {
        sections.summary = takeSnippet(normalized, 260);
    }

    if (!sections.explanation) {
        const paragraphs = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
        sections.explanation = paragraphs.length > 1 ? paragraphs.join('\n\n') : normalized;
    }

    if (!sections.observe) {
        sections.observe = 'Observe o ponto central da resposta e relacione com a definicao do modulo.';
    }

    if (!sections.mistakes) {
        sections.mistakes = 'Confira sinais, ordem dos passos e a leitura do enunciado antes de concluir.';
    }

    if (!sections.example) {
        sections.example = 'Se quiser fixar melhor, peça um exemplo resolvido com o mesmo formato.';
    }

    return sections;
}

function renderTutorResponse(value) {
    const sections = extractChatSections(value);

    const cards = [
        {
            label: 'Resumo rapido',
            tone: 'summary',
            body: sections.summary,
        },
        {
            label: 'Explicacao',
            tone: 'explanation',
            body: sections.explanation,
        },
        {
            label: 'O que observar',
            tone: 'observe',
            body: sections.observe,
        },
        {
            label: 'Erros comuns',
            tone: 'mistakes',
            body: sections.mistakes,
        },
        {
            label: 'Exemplo',
            tone: 'example',
            body: sections.example,
        },
    ];

    return `
        <div class="chat-response">
            <div class="chat-response__intro">
                <span class="chat-response__eyebrow">Resposta guiada</span>
                <p class="chat-response__lede">Leitura em blocos curtos para ficar mais facil de escanear no celular e no desktop.</p>
            </div>
            <div class="chat-response__cards">
                ${cards.map((card) => `
                    <section class="chat-response__card chat-response__card--${card.tone}">
                        <span class="chat-response__label">${escapeHtml(card.label)}</span>
                        <div class="chat-response__body">${renderMarkdownFragment(card.body)}</div>
                    </section>
                `).join('')}
            </div>
        </div>
    `;
}

function normalizeLookup(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function resolveApiBaseUrl() {
    const explicitBase = typeof window.__APP_API_BASE__ === 'string' ? window.__APP_API_BASE__.trim() : '';
    if (explicitBase) return explicitBase.replace(/\/$/, '');
    if (window.location.protocol === 'file:') return 'http://127.0.0.1:3000';
    return window.location.origin.replace(/\/$/, '');
}

function buildApiUrl(path) {
    return `${resolveApiBaseUrl()}${path}`;
}

async function readJsonResponse(response) {
    const rawText = await response.text();
    if (!rawText) return {};
    try {
        return JSON.parse(rawText);
    } catch (_error) {
        return { rawText };
    }
}

function createApiError(message, meta = {}) {
    const error = new Error(message);
    Object.assign(error, meta);
    return error;
}

function withApiTimeout(promise, { ms, feature }) {
    let timerId = 0;

    const timeoutPromise = new Promise((_, reject) => {
        timerId = window.setTimeout(() => {
            reject(
                createApiError(`Request timed out for ${feature}.`, {
                    diagnostics: {
                        errorType: 'timeout',
                        detail: `A resposta excedeu ${ms}ms.`,
                    },
                }),
            );
        }, ms);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timerId) {
            window.clearTimeout(timerId);
        }
    });
}

function logApiDiagnostics(feature, error) {
    console.group(`[AI] ${feature} failed`);
    console.error(error);
    if (error?.diagnostics) console.info('[AI] diagnostics', error.diagnostics);
    if (error?.payload) console.info('[AI] payload', error.payload);
    if (error?.url) console.info('[AI] url', error.url);
    console.groupEnd();
}

async function apiRequest(path, { method = 'GET', body, feature = path } = {}) {
    const url = buildApiUrl(path);
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
    };

    if (body !== undefined) {
        options.body = JSON.stringify(body);
    }

    console.info('[AI] request', { feature, method, url, body });

    let response;
    try {
        response = await fetch(url, options);
    } catch (networkError) {
        throw createApiError(`Network failure while calling ${feature}.`, {
            cause: networkError,
            url,
            diagnostics: {
                errorType: 'network',
                detail: networkError instanceof Error ? networkError.message : String(networkError),
            },
        });
    }

    const payload = await readJsonResponse(response);
    if (!response.ok || payload?.ok === false || payload?.error) {
        if (response.status === 401) {
            console.warn('[auth] sessão ausente ou expirada; redirecionando para login.', { feature, url, payload });
            window.location.assign(buildApiUrl('/login'));
        }

        throw createApiError(payload?.error || `Request failed for ${feature}.`, {
            statusCode: response.status,
            diagnostics: payload?.diagnostics || {
                statusCode: response.status,
                detail: payload?.error || response.statusText || 'Unknown API error',
            },
            payload,
            url,
        });
    }

    return payload;
}

window.AppAPI = {
    apiRequest,
    buildApiUrl,
    resolveApiBaseUrl,
    async getCurrentUser() {
        return apiRequest('/me', { feature: 'me' });
    },
    async getSessionStatus() {
        return apiRequest('/auth/session-status', { feature: 'session-status' });
    },
    async refreshSession(reason = 'activity') {
        return apiRequest('/auth/refresh-session', {
            method: 'POST',
            body: { reason },
            feature: 'refresh-session',
        });
    },
    async logout() {
        return apiRequest('/logout', { method: 'POST', feature: 'logout' });
    },
    async testAIConnection() {
        try {
            return await apiRequest('/api/test-ai', { feature: 'test-ai' });
        } catch (error) {
            logApiDiagnostics('test-ai', error);
            return { ok: false, error: error.message, diagnostics: error.diagnostics || null };
        }
    },
};

function getRoleLabel(role) {
    return role === 'owner' ? 'Owner' : 'Member';
}

function renderAuthBadge(user) {
    const badge = document.getElementById('auth-user-badge');
    if (!badge || !user) return;

    badge.textContent = `${getRoleLabel(user.role)} • ${user.email}`;
    badge.classList.remove('hidden');
}

async function handleLogout(button) {
    const targetButton = button || document.getElementById('btn-logout');
    if (targetButton) {
        targetButton.disabled = true;
        targetButton.textContent = 'Saindo...';
    }

    try {
        if (window.SessionManager?.stop) {
            window.SessionManager.stop('logout');
        }
        if (window.Store?.clearAll) {
            window.Store.clearAll({ skipRemote: true });
        }
        await window.AppAPI.logout();
    } catch (error) {
        console.error('[auth] falha ao encerrar sessão', error);
    } finally {
        window.location.assign(buildApiUrl('/login'));
    }
}

const LOCAL_FALLBACK_BLUEPRINTS = {
    conjuntos: {
        summary: 'Conjunto e uma colecao de elementos. O mais importante e distinguir pertinencia, inclusao e as operacoes de uniao, intersecao e diferenca.',
        keyPoints: [
            'Use $\\in$ para elemento e $\\subset$ para conjunto.',
            'A ordem dos elementos nao altera o conjunto.',
            '$A \\cup B$ junta tudo; $A \\cap B$ mantem o que e comum.',
        ],
        example: {
            prompt: 'Se $A = \\{1, 2, 3\\}$ e $B = \\{2, 3, 4\\}$, calcule $A \\cup B$ e $A \\cap B$.',
            steps: ['Na uniao entram todos os elementos sem repetir.', 'Na intersecao entram apenas os elementos em comum.'],
            answer: '$A \\cup B = \\{1, 2, 3, 4\\}$ e $A \\cap B = \\{2, 3\\}$.',
        },
        memoryTips: ['Pergunte sempre se voce esta comparando elemento com conjunto ou conjunto com conjunto.', 'Na diferenca, a ordem importa.'],
    },
    'conjuntos-numericos': {
        summary: 'Classificar numeros significa encontrar o conjunto mais especifico a que eles pertencem.',
        keyPoints: [
            '$\\mathbb{N} \\subset \\mathbb{Z} \\subset \\mathbb{Q} \\subset \\mathbb{R}$.',
            'Toda dizima periodica e racional.',
            '$\\pi$ e raizes nao exatas sao irracionais.',
        ],
        example: {
            prompt: 'Classifique $-3$, $0,25$ e $\\sqrt{2}$.',
            steps: ['Veja se o numero pode ser escrito como fracao.', 'Se puder, ele e racional; se nao puder, ele e irracional.'],
            answer: '$-3 \\in \\mathbb{Z}, \\mathbb{Q}, \\mathbb{R}$; $0,25 \\in \\mathbb{Q}, \\mathbb{R}$; $\\sqrt{2} \\in \\mathbb{I}, \\mathbb{R}$.',
        },
        memoryTips: ['Dizima periodica sempre vira fracao.', 'Use o conjunto mais especifico quando a questao pedir classificacao.'],
    },
    'ordem-e-intervalos': {
        summary: 'Na reta real, quem esta mais a direita e maior. Intervalos traduzem desigualdades com extremos abertos ou fechados.',
        keyPoints: [
            'Multiplicar desigualdade por numero negativo inverte o sinal.',
            'Colchete fecha; parenteses abrem.',
            'Infinito nunca fecha intervalo.',
        ],
        example: {
            prompt: 'Escreva em desigualdade o intervalo $[-2, 5[$.',
            steps: ['O $-2$ entra no intervalo.', 'O $5$ fica de fora.'],
            answer: '$-2 \\le x < 5$.',
        },
        memoryTips: ['Leia cada extremo separadamente.', 'Desenhar a reta ajuda a evitar trocas de sinal.'],
    },
    algebra: {
        summary: 'A algebra organiza letras e numeros por meio de propriedades e da distributiva.',
        keyPoints: [
            'Soma e multiplicacao sao comutativas; subtracao e divisao, em geral, nao.',
            'Na distributiva, o fator externo multiplica todos os termos do parenteses.',
            'Sinais negativos merecem atencao redobrada.',
        ],
        example: {
            prompt: 'Desenvolva $3(x - 4)$.',
            steps: ['Multiplique 3 por cada termo do parenteses.', 'Some os resultados com o sinal correto.'],
            answer: '$3x - 12$.',
        },
        memoryTips: ['Se ha parenteses, confira se todos os termos receberam o fator externo.', 'Trocar ordem nao e a mesma coisa que trocar sinal.'],
    },
    'produtos-notaveis': {
        summary: 'Produtos notaveis sao atalhos para expandir expressoes sem repetir a distributiva completa.',
        keyPoints: [
            '$(a + b)^2 = a^2 + 2ab + b^2$.',
            '$(a - b)^2 = a^2 - 2ab + b^2$.',
            '$(a + b)(a - b) = a^2 - b^2$.',
        ],
        example: {
            prompt: 'Desenvolva $(x + 3)^2$.',
            steps: ['Use o quadrado da soma.', 'Substitua $a = x$ e $b = 3$.'],
            answer: '$x^2 + 6x + 9$.',
        },
        memoryTips: ['No quadrado da soma e da diferenca, o termo do meio envolve $2ab$.', 'Na soma pela diferenca, os termos mistos desaparecem.'],
    },
    fatoracao: {
        summary: 'Fatorar e escrever a expressao como produto, procurando fator comum ou um padrao conhecido.',
        keyPoints: [
            'Comece pelo fator comum.',
            'Reconheca diferenca de quadrados e trinomio quadrado perfeito.',
            'Fatorar e o processo inverso de desenvolver.',
        ],
        example: {
            prompt: 'Fatore $6x + 12$.',
            steps: ['Procure o maior fator comum.', 'Coloque esse fator em evidencia.'],
            answer: '$6(x + 2)$.',
        },
        memoryTips: ['Pergunte qual numero ou expressao aparece em todos os termos.', 'Nem todo trinomio e quadrado perfeito: confira o termo do meio.'],
    },
};

function getCourseModules() {
    if (Array.isArray(window.COURSE_MODULES) && window.COURSE_MODULES.length) return window.COURSE_MODULES;
    if (Array.isArray(window.MODULES_DATA)) return window.MODULES_DATA;
    return [];
}

function findModuleByTopic(topic) {
    const normalizedTopic = normalizeLookup(topic);
    return getCourseModules().find((module) =>
        [module.slug, module.title, module.aiTopic, module.quizTopic, module.subtitle, module.description]
            .filter(Boolean)
            .some((value) => {
                const normalizedValue = normalizeLookup(value);
                return normalizedValue && (normalizedValue.includes(normalizedTopic) || normalizedTopic.includes(normalizedValue));
            }),
    );
}

function slugifyForDom(value) {
    return normalizeLookup(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'topico';
}

function getArtifactsForModule(module) {
    const items = window.ARTIFACTS_LIBRARY?.items || [];
    const slugs = module?.artifactSlugs || [];
    return items.filter((artifact) => slugs.includes(artifact.slug));
}

function buildBootFallbackModules(moduleSeeds) {
    return (moduleSeeds || []).map((module) => {
        const blueprint = LOCAL_FALLBACK_BLUEPRINTS[module.slug] || null;
        const reviewItems = Array.from(new Set([...(module.reviewHighlights || []), ...(blueprint?.keyPoints || [])])).slice(0, 6);
        const summaryBody = [module.subtitle || module.description || 'Conteudo essencial disponivel em modo reduzido.']
            .concat(reviewItems.length ? ['', ...reviewItems.map((item) => `- ${item}`)] : [])
            .join('\n');
        const explanationBody = blueprint
            ? [
                  blueprint.summary,
                  '',
                  '**Pontos-chave**',
                  ...blueprint.keyPoints.map((item) => `- ${item}`),
                  '',
                  '**Exemplo guiado**',
                  `- Enunciado: ${blueprint.example.prompt}`,
                  ...blueprint.example.steps.map((step, index) => `${index + 1}. ${step}`),
                  `- Resposta final: ${blueprint.example.answer}`,
                  '',
                  '**Macetes**',
                  ...blueprint.memoryTips.map((item) => `- ${item}`),
              ].join('\n')
            : module.description || module.subtitle || 'Conteudo resumido para preservar o acesso ao modulo.';
        const reviewBody = reviewItems.length
            ? reviewItems.map((item) => `- ${item}`).join('\n')
            : '- Revise os conceitos centrais deste modulo.';

        return {
            ...module,
            artifacts: getArtifactsForModule(module),
            articles: (module.files || []).map((fileMeta, index) => ({
                ...fileMeta,
                title: fileMeta.title,
                anchor: `${module.slug}-${slugifyForDom(fileMeta.title || `topico-${index + 1}`)}`,
                intro: module.description || module.subtitle || 'Conteudo montado em modo de seguranca.',
                reviewItems,
                sections: [
                    { type: 'summary', title: 'Resumo rapido', mainBody: summaryBody, supplementBody: '' },
                    { type: 'explanation', title: 'Visao guiada', mainBody: explanationBody, supplementBody: '' },
                    { type: 'review', title: 'Revisao rapida', mainBody: reviewBody, supplementBody: '' },
                ],
            })),
        };
    });
}

function renderPlainTextStudyBlock(text) {
    const lines = String(text || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    if (!lines.length) return '<p>Conteudo indisponivel neste momento.</p>';

    const html = [];
    let listBuffer = [];

    function flushList() {
        if (!listBuffer.length) return;
        html.push(`<ul>${listBuffer.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
        listBuffer = [];
    }

    lines.forEach((line) => {
        if (/^[-*]\s+/.test(line)) {
            listBuffer.push(line.replace(/^[-*]\s+/, ''));
            return;
        }

        if (/^\d+\.\s+/.test(line)) {
            listBuffer.push(line.replace(/^\d+\.\s+/, ''));
            return;
        }

        flushList();
        html.push(`<p>${escapeHtml(line)}</p>`);
    });

    flushList();
    return html.join('');
}

function renderPlainFallbackHomeModules(modules) {
    return modules
        .map((module) => {
            const artifactCount = module.artifacts?.length || module.artifactSlugs?.length || 0;
            const metaParts = [`${module.files?.length || 0} assunto${module.files?.length > 1 ? 's' : ''}`];

            if (artifactCount) metaParts.push(`${artifactCount} recurso${artifactCount > 1 ? 's' : ''} visuais`);

            return `
                <article class="module-card" data-accent="${escapeHtml(module.accent || 'blue')}">
                    <div class="module-card__topline">
                        <span class="topic-label">Modulo ${module.order}</span>
                        <span class="module-card__meta">${metaParts.join(' · ')}</span>
                    </div>
                    <div class="module-card__body">
                        <h3>${escapeHtml(module.title)}</h3>
                        <p class="module-card__description">${escapeHtml(module.subtitle || module.description || '')}</p>
                        <div class="module-card__stats">
                            <span class="module-card__stat">Conteudo essencial</span>
                            ${artifactCount ? `<span class="module-card__stat">${artifactCount} recursos visuais</span>` : ''}
                        </div>
                        <div class="module-card__chips">
                            ${(module.files || []).map((file) => `<span class="module-chip">${escapeHtml(file.title)}</span>`).join('')}
                        </div>
                    </div>
                    <div class="module-card__footer">
                        <button class="btn--module" data-nav="${escapeHtml(module.id)}">
                            <span>Abrir modulo</span>
                            <span class="module-arrow">→</span>
                        </button>
                    </div>
                </article>
            `;
        })
        .join('');
}

function renderPlainFallbackModulePages(modules) {
    return modules
        .map((module) => `
            <section id="${escapeHtml(module.id)}" class="page module-page">
                <header class="module-hero" data-accent="${escapeHtml(module.accent || 'blue')}">
                    <div class="module-hero__copy">
                        <span class="topic-label">Modulo ${module.order}</span>
                        <h2 class="topic-title">${escapeHtml(module.title)}</h2>
                        <p class="module-hero__subtitle">${escapeHtml(module.subtitle || '')}</p>
                        <p class="module-hero__description">${escapeHtml(module.description || module.subtitle || '')}</p>
                    </div>
                    <div class="module-hero__actions">
                        <button class="btn btn--primary" data-quiz-topic="${escapeHtml(module.quizTopic || module.title)}">Quiz deste modulo</button>
                        <button class="btn btn--secondary" data-nav="page-revisao">Revisao de vespera</button>
                    </div>
                </header>
                <div class="module-layout">
                    <aside class="module-side">
                        <div class="module-panel module-panel--map">
                            <h3>Mapa do modulo</h3>
                            <div class="module-jump-list">
                                ${(module.articles || []).map((article) => `
                                    <button class="module-jump" data-scroll-target="${escapeHtml(article.anchor)}">
                                        <span>${escapeHtml(article.title)}</span>
                                        <small>${escapeHtml(article.tag || 'Material')}</small>
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                        <div class="module-panel module-panel--focus">
                            <h3>Foco de prova</h3>
                            <p>Versao de seguranca montada a partir dos dados do modulo.</p>
                            <div class="review-pill-grid review-pill-grid--compact">
                                ${(module.reviewHighlights || []).map((item) => `<span class="review-pill">${escapeHtml(item)}</span>`).join('')}
                            </div>
                        </div>
                    </aside>
                    <section class="module-content">
                        ${(module.articles || []).map((article) => `
                            <article id="${escapeHtml(article.anchor)}" class="content-sheet">
                                <header class="content-sheet__header">
                                    <div>
                                        <span class="content-sheet__kicker">${escapeHtml(article.tag || 'Material de estudo')}</span>
                                        <h3>${escapeHtml(article.title)}</h3>
                                    </div>
                                    <p>${escapeHtml(article.intro || module.subtitle || '')}</p>
                                </header>
                                <div class="content-sheet__sections">
                                    ${(article.sections || []).map((section) => `
                                        <section class="study-section study-section--${escapeHtml(section.type || 'default')}">
                                            <div class="study-section__header">
                                                <span class="study-section__eyebrow">${escapeHtml(section.title || 'Conteudo')}</span>
                                                <h4 class="study-section__title">${escapeHtml(section.title || 'Conteudo')}</h4>
                                            </div>
                                            <div class="study-subsection study-subsection--main">
                                                <div class="study-markdown">${renderPlainTextStudyBlock(section.mainBody)}</div>
                                            </div>
                                        </section>
                                    `).join('')}
                                </div>
                            </article>
                        `).join('')}
                    </section>
                </div>
            </section>
        `)
        .join('');
}

function renderPlainFallbackReviewDashboard(modules) {
    return `
        <div class="review-dashboard">
            <div class="review-dashboard__intro card">
                <span class="topic-label">Revisao integrada</span>
                <h3>Modo de seguranca ativo</h3>
                <p>A home e os modulos continuam acessiveis mesmo quando o carregamento rico de conteudo falha.</p>
            </div>
            <div class="review-module-grid">
                ${modules.map((module) => `
                    <article class="review-module-card" data-accent="${escapeHtml(module.accent || 'blue')}">
                        <div class="review-module-card__head">
                            <span class="topic-label">Modulo ${module.order}</span>
                            <h3>${escapeHtml(module.title)}</h3>
                            <p>${escapeHtml(module.subtitle || '')}</p>
                        </div>
                        <div class="review-pill-grid review-pill-grid--compact">
                            ${(module.reviewHighlights || []).map((item) => `<span class="review-pill">${escapeHtml(item)}</span>`).join('')}
                        </div>
                        <div class="review-module-card__actions">
                            <button class="btn btn--secondary" data-nav="${escapeHtml(module.id)}">Abrir modulo</button>
                            <button class="btn btn--primary" data-quiz-topic="${escapeHtml(module.quizTopic || module.title)}">Quiz rapido</button>
                        </div>
                    </article>
                `).join('')}
            </div>
        </div>
    `;
}

function renderPlainFallbackLaboratoryPage(modules) {
    const artifactItems = window.ARTIFACTS_LIBRARY?.items || [];
    return `
        <section id="page-laboratorio" class="page page--narrow">
            <div class="lab-hero" data-accent="blue">
                <div>
                    <span class="topic-label">Laboratorio Matematico</span>
                    <h2>Artefatos interativos disponiveis</h2>
                    <p class="home-hero__lead">O painel visual permanece acessivel mesmo se o carregamento rico da home falhar.</p>
                </div>
                <div class="lab-hero__stats">
                    <div class="lab-stat-card"><strong>${modules.length}</strong><span>modulos</span></div>
                    <div class="lab-stat-card"><strong>${artifactItems.length}</strong><span>artefatos</span></div>
                </div>
            </div>
            <section class="home-section">
                <div class="section-heading">
                    <div>
                        <h3>Explorar artefatos</h3>
                        <p>Selecione um recurso visual para abrir a experiencia interativa.</p>
                    </div>
                </div>
                <div class="artifact-grid">
                    ${artifactItems.map((artifact) => `
                        <article class="artifact-card" data-artifact-id="${escapeHtml(artifact.slug || '')}" onclick="window.appOpenLaboratoryExperience(this.dataset.artifactId)">
                            <div class="artifact-card__header">
                                <div>
                                    <span class="artifact-card__eyebrow">${escapeHtml(artifact.categoryLabel || 'Artefato interativo')}</span>
                                    <h4>${escapeHtml(artifact.title)}</h4>
                                </div>
                            </div>
                            <p class="artifact-card__summary">${escapeHtml(artifact.summary || '')}</p>
                            <div class="artifact-card__meta" style="margin-top:auto">
                                <button class="btn btn--secondary" type="button" style="pointer-events:none;">Explorar experiencia →</button>
                            </div>
                        </article>
                    `).join('')}
                </div>
            </section>
        </section>
    `;
}

function listHtml(items, ordered = false) {
    const tag = ordered ? 'ol' : 'ul';
    return `<${tag}>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>`;
}

window.testArtifactLoad = async function (slug = 'diagrama-venn-interativo') {
    const artifact = (window.ARTIFACTS_LIBRARY?.items || []).find((item) => item.slug === slug);

    if (!artifact) {
        const result = { ok: false, error: `Artifact "${slug}" not found in registry.` };
        console.error('[artifact-test] registry miss', result);
        return result;
    }

    const path = `/content/artifacts/raw/${artifact.file}`;
    console.info('[artifact-test] trying to load artifact', { slug, file: artifact.file, path });

    try {
        const response = await fetch(path);
        const html = await response.text();
        const looksLikeShell = /id=["']page-home["']|class=["'][^"']*app-container/.test(html);
        const result = {
            ok: response.ok && !looksLikeShell,
            slug,
            file: artifact.file,
            path,
            status: response.status,
            contentType: response.headers.get('content-type'),
            looksLikeShell,
        };

        if (result.ok) {
            console.info('[artifact-test] artifact file found', result);
        } else {
            console.error('[artifact-test] artifact fetch failed', result);
        }

        return result;
    } catch (error) {
        const result = {
            ok: false,
            slug,
            file: artifact.file,
            path,
            error: error instanceof Error ? error.message : String(error),
        };
        console.error('[artifact-test] artifact fetch threw', result, error);
        return result;
    }
};

function renderExplainHtml(payload, note) {
    return `${note ? `<p><small>${escapeHtml(note)}</small></p>` : ''}<p>${escapeHtml(payload.summary)}</p><h5>Pontos-chave</h5>${listHtml(payload.keyPoints)}<h5>Exemplo guiado</h5><p><strong>Enunciado:</strong> ${escapeHtml(payload.example.prompt)}</p>${listHtml(payload.example.steps, true)}<p><strong>Resposta final:</strong> ${escapeHtml(payload.example.answer)}</p><h5>Macetes</h5>${listHtml(payload.memoryTips)}`;
}

function renderReviewHtml(payload, note) {
    return `${note ? `<p><small>${escapeHtml(note)}</small></p>` : ''}<p>${escapeHtml(payload.overview)}</p><h5>Pontos essenciais</h5>${listHtml(payload.essentials)}<h5>Erros comuns</h5>${listHtml(payload.mistakes)}<h5>Dicas</h5>${listHtml(payload.tips)}`;
}

function renderExercisesHtml(payload, note) {
    return `${note ? `<p><small>${escapeHtml(note)}</small></p>` : ''}<p>${escapeHtml(payload.intro)}</p>${payload.exercises.map((exercise, index) => `<section class="ai-exercise-item"><h5>${escapeHtml(exercise.title || `Exercicio ${index + 1}`)}</h5><p><strong>Enunciado:</strong> ${escapeHtml(exercise.statement)}</p><p><strong>Dica:</strong> ${escapeHtml(exercise.hint)}</p><details><summary>Ver passo a passo</summary>${listHtml(exercise.steps, true)}<p><strong>Resposta final:</strong> ${escapeHtml(exercise.answer)}</p></details></section>`).join('')}`;
}

function buildFallbackReason(error) {
    switch (error?.diagnostics?.errorType) {
        case 'quota_exceeded':
            return 'A cota atual do provider foi excedida. Mostrando uma versao local confiavel.';
        case 'missing_key':
            return 'A chave GEMINI_API_KEY nao esta configurada no backend. Mostrando uma versao local.';
        case 'auth':
            return 'A chave configurada foi rejeitada pelo provider. Mostrando uma versao local.';
        case 'parse_error':
            return 'A IA respondeu em formato invalido. Mostrando uma versao local.';
        case 'network':
            return 'O frontend nao conseguiu alcancar o backend ou o provider. Mostrando uma versao local.';
        case 'timeout':
            return 'A IA demorou demais para responder. Mostrando uma versao local confiavel.';
        default:
            return 'A IA nao respondeu corretamente agora. Mostrando uma versao local.';
    }
}

function buildLocalExplainPayload(topic) {
    const module = findModuleByTopic(topic);
    const blueprint = LOCAL_FALLBACK_BLUEPRINTS[module?.slug];
    if (blueprint) return { title: module?.title || topic, ...blueprint };

    const fallbackQuiz = Array.isArray(module?.fallbackQuiz) ? module.fallbackQuiz : [];
    return {
        title: module?.title || topic,
        summary: module?.description || `Resumo local de ${topic}.`,
        keyPoints: Array.isArray(module?.reviewHighlights) && module.reviewHighlights.length ? module.reviewHighlights.slice(0, 3) : ['Revise o resumo rapido e os exemplos resolvidos deste modulo.'],
        example: fallbackQuiz[0] ? { prompt: fallbackQuiz[0].question, steps: ['Identifique o conceito central.', 'Compare a resposta com a definicao correta.'], answer: fallbackQuiz[0].explanation } : { prompt: `Explique a ideia principal de ${topic}.`, steps: ['Leia o resumo rapido.', 'Recupere um exemplo do modulo.'], answer: 'Use os exemplos resolvidos da pagina para montar a resposta.' },
        memoryTips: ['Volte ao mapa do modulo para revisar os blocos centrais.', 'Use os quizzes locais para fixar o conteudo.'],
    };
}

function buildLocalExercisesPayload(topic) {
    const module = findModuleByTopic(topic);
    const explain = buildLocalExplainPayload(topic);
    const fallbackQuiz = Array.isArray(module?.fallbackQuiz) ? module.fallbackQuiz.slice(0, 2) : [];
    const exercises = [
        {
            title: 'Exercicio 1',
            statement: explain.example.prompt,
            hint: explain.memoryTips[0] || 'Use a definicao principal do modulo.',
            steps: explain.example.steps,
            answer: explain.example.answer,
        },
        ...fallbackQuiz.map((item, index) => ({
            title: `Exercicio ${index + 2}`,
            statement: `${item.question} Justifique sua resposta.`,
            hint: 'Use o conceito central do modulo antes de responder.',
            steps: ['Identifique o conceito cobrado.', 'Compare as opcoes ou possibilidades com a definicao correta.', 'Escreva uma conclusao curta e objetiva.'],
            answer: item.explanation,
        })),
    ];

    return {
        intro: `A IA nao respondeu agora, entao montei uma lista local de exercicios sobre ${module?.title || topic}.`,
        exercises,
    };
}

function buildLocalReviewPayload(topic) {
    const explain = buildLocalExplainPayload(topic);
    return {
        overview: explain.summary,
        essentials: explain.keyPoints,
        mistakes: ['Pular a definicao principal antes de resolver.', 'Trocar simbolos, sinais ou operacoes por leitura apressada.'],
        tips: explain.memoryTips,
    };
}

function getAIContainer(buttonElement) {
    return buttonElement.closest('.ai-section')?.querySelector('.ai-response-box') || null;
}

function setAILoading(container, message) {
    if (!container) return;
    container.classList.remove('hidden');
    container.innerHTML = `<div class="ai-loading-state"><div class="loader"></div><span>${message}</span></div>`;
}

function setAIError(container, message, retryHandler) {
    if (!container) return;
    container.classList.remove('hidden');
    container.innerHTML = `<div class="ai-error-state"><span>${message}</span><button class="btn-retry" type="button">Tentar novamente</button></div>`;
    container.querySelector('.btn-retry')?.addEventListener('click', retryHandler);
}

function setAIResult(container, title, html) {
    if (!container) return;
    container.classList.remove('hidden');
    container.innerHTML = `<h4 class="ai-result-title">${title}</h4>${html}`;
    if (window.ContentRenderer?.renderMathIn) window.ContentRenderer.renderMathIn(container);
}

function getArtifactPedagogy(artifact) {
    const pedagogy = window.ARTIFACTS_LIBRARY?.pedagogyBySlug?.[artifact?.slug] || {};
    return {
        whyHere: pedagogy.whyHere || 'Este artefato foi escolhido para transformar uma ideia abstrata em algo que voce consegue enxergar e testar.',
        examBridge: pedagogy.examBridge || 'Use este recurso para reconhecer o padrao com mais rapidez em exercicios e revisoes.',
        gain: pedagogy.gain || 'O ganho principal aqui e ligar teoria, leitura visual e tomada de decisao.',
    };
}

function getArtifactModules(artifact) {
    const moduleSlugs = Array.isArray(artifact?.moduleSlugs) ? artifact.moduleSlugs : [];
    return getCourseModules().filter((module) => moduleSlugs.includes(module.slug));
}

function buildArtifactStudyPlan(artifact) {
    return [
        `Releia o foco do artefato: ${artifact.teaches || 'entender a ideia central do recurso'}.`,
        `Use quando: ${artifact.whenToUse || 'estiver revisando o modulo e quiser consolidar a intuicao.'}`,
        `Observe principalmente: ${artifact.observe || artifact.summary || 'como a representacao muda quando voce interage.'}`,
        'Feche a exploracao explicando em voz alta qual padrao apareceu e em que tipo de questao ele ajuda.',
    ];
}

function buildArtifactTutorPrompt(artifact, modules) {
    const moduleNames = modules.length ? modules.map((module) => module.title).join(', ') : 'a trilha atual';
    return [
        `Explique o artefato "${artifact.title}" como tutor de matematica.`,
        `Considere que ele apoia: ${moduleNames}.`,
        'Quero: o que observar, erro comum, conexao com prova e um mini exercicio guiado.',
    ].join(' ');
}

function buildArtifactPracticePrompt(artifact, modules) {
    const moduleNames = modules.length ? modules.map((module) => module.title).join(', ') : 'a trilha atual';
    return [
        `Monte uma pratica curta a partir do artefato "${artifact.title}".`,
        `Considere que ele apoia: ${moduleNames}.`,
        'Quero 2 questoes curtas, um erro comum e gabarito comentado em passos breves.',
    ].join(' ');
}

function renderArtifactExperiencePage(artifact) {
    const sourcePageId = window.__LAST_ARTIFACT_SOURCE_PAGE__ || 'page-laboratorio';
    const modules = getArtifactModules(artifact);
    const pedagogy = getArtifactPedagogy(artifact);
    const frameId = `lab-${artifact.slug}`;
    const embedUrl = `${window.ARTIFACTS_LIBRARY.hostPage}?frameId=${frameId}&src=/content/artifacts/raw/${artifact.file}`;
    const sourceModule = getCourseModules().find((module) => module.id === sourcePageId) || null;
    const sourceLabel = sourcePageId === 'page-laboratorio'
        ? 'Voltar a galeria'
        : sourceModule
            ? `Voltar a ${sourceModule.title}`
            : 'Voltar';
    const moduleChips = modules.length
        ? modules.map((module) => `<span class="artifact-chip">${escapeHtml(module.title)}</span>`).join('')
        : '<span class="artifact-chip">Exploracao complementar</span>';
    const moduleButtons = modules
        .map(
            (module) => `
                <button class="btn btn--secondary" type="button" onclick="window.navigateTo('${escapeAttribute(module.id)}')">
                    Ir para ${escapeHtml(module.title)}
                </button>
            `,
        )
        .join('');
    const studyPlan = buildArtifactStudyPlan(artifact)
        .map((step) => `<span class="review-pill">${escapeHtml(step)}</span>`)
        .join('');
    const tutorPrompt = buildArtifactTutorPrompt(artifact, modules);
    const practicePrompt = buildArtifactPracticePrompt(artifact, modules);
    const practiceTopic = modules[0]?.quizTopic || modules[0]?.title || artifact.title;

    return `
        <div class="lab-experience-layout">
            <header class="module-hero" data-accent="${escapeAttribute(artifact.accent || 'blue')}">
                <div class="module-hero__copy">
                    <span class="topic-label">Experiencia guiada</span>
                    <h2 class="topic-title">${escapeHtml(artifact.title)}</h2>
                    <p class="module-hero__subtitle">${escapeHtml(artifact.summary || artifact.teaches || 'Artefato interativo para estudo visual.')}</p>
                    <p class="module-hero__description">${escapeHtml(pedagogy.whyHere)}</p>
                    <div class="artifact-chip-row" style="margin-top: 18px;">
                        ${moduleChips}
                    </div>
                </div>
                <div class="module-hero__actions">
                    <button class="btn btn--secondary" type="button" onclick="window.navigateTo('${escapeAttribute(sourcePageId)}')">${escapeHtml(sourceLabel)}</button>
                    <button class="btn btn--primary" type="button" data-chat-launcher="${escapeAttribute(tutorPrompt)}">Abrir Tutor IA com contexto</button>
                    ${moduleButtons}
                </div>
            </header>

            <div class="module-shell">
                <div class="module-shell__content">
                    <article class="content-sheet content-sheet--artifact-stage">
                        <header class="content-sheet__header">
                            <div>
                                <span class="content-sheet__kicker">Interacao guiada</span>
                                <h3>Entre no artefato com um objetivo claro</h3>
                            </div>
                            <p>Veja primeiro a ideia central, mexa em uma variavel por vez e use a leitura visual para confirmar o raciocinio.</p>
                        </header>
                        <div class="artifact-panel__hint">
                            <strong>Objetivo curto:</strong> ${escapeHtml(artifact.teaches || 'Visualizar a ideia principal com mais clareza.')}
                        </div>
                        <div class="artifact-frame-shell">
                            <iframe
                                class="artifact-frame"
                                data-artifact-frame="${escapeAttribute(frameId)}"
                                title="${escapeAttribute(artifact.title)}"
                                src="${escapeAttribute(embedUrl)}"
                                style="height: ${Number(artifact.height) || 600}px;"
                            ></iframe>
                        </div>
                    </article>

                    <article class="content-sheet">
                        <header class="content-sheet__header">
                            <div>
                                <span class="content-sheet__kicker">Interpretacao guiada</span>
                                <h3>Transforme o que voce viu em entendimento</h3>
                            </div>
                            <p>Depois de mexer no recurso, nomeie o padrao, ligue isso ao conceito e antecipe onde a prova costuma cobrar esse raciocinio.</p>
                        </header>
                        <div class="artifact-context-grid artifact-context-grid--lesson">
                            <div class="artifact-context-box">
                                <span class="artifact-context-box__label">O que ensina</span>
                                <p>${escapeHtml(artifact.teaches || 'Ajuda a visualizar o conceito principal do modulo.')}</p>
                            </div>
                            <div class="artifact-context-box">
                                <span class="artifact-context-box__label">O que observar</span>
                                <p>${escapeHtml(artifact.observe || 'Observe como a representacao muda a cada interacao.')}</p>
                            </div>
                            <div class="artifact-context-box">
                                <span class="artifact-context-box__label">Na prova</span>
                                <p>${escapeHtml(pedagogy.examBridge)}</p>
                            </div>
                        </div>
                        <div class="artifact-panel__hint" style="margin-top: 16px;">
                            <strong>Como explorar:</strong> ${escapeHtml(artifact.hint || artifact.whenToUse || artifact.summary || '')}
                        </div>
                        <div class="review-pill-grid review-pill-grid--compact" style="margin-top: 16px;">
                            ${studyPlan}
                        </div>
                    </article>

                    <article class="content-sheet content-sheet--practice">
                        <header class="content-sheet__header">
                            <div>
                                <span class="content-sheet__kicker">Fechamento</span>
                                <h3>Feche o ciclo com pratica curta</h3>
                            </div>
                            <p>O ganho aparece quando voce sai da observacao e testa a ideia em uma pergunta curta, no quiz do topico ou no Tutor IA.</p>
                        </header>
                        <div class="content-next-step">
                            <span class="content-next-step__eyebrow">Proximo passo recomendado</span>
                            <h4>Observe, nomeie o padrao e aplique logo em seguida.</h4>
                            <p>Se o artefato ficou claro, faca uma pratica curta agora. Se ainda restou duvida, abra o Tutor IA com o contexto deste recurso.</p>
                            <div class="content-next-step__actions">
                                <button class="btn btn--primary" type="button" data-quiz-topic="${escapeAttribute(practiceTopic)}">Fazer pratica curta</button>
                                <button class="btn btn--secondary" type="button" data-chat-launcher="${escapeAttribute(practicePrompt)}">Pedir exercicios ao Tutor IA</button>
                                <button class="btn btn--secondary" type="button" onclick="window.generateSimulado()">Levar para o simulado</button>
                            </div>
                        </div>
                    </article>
                </div>

                <aside class="module-shell__aside">
                    <div class="card module-panel module-panel--visual">
                        <h3>Por que este artefato esta aqui</h3>
                        <p>${escapeHtml(pedagogy.whyHere)}</p>
                    </div>

                    <div class="card module-panel module-panel--focus">
                        <h3>Conexao com prova</h3>
                        <p>${escapeHtml(pedagogy.examBridge)}</p>
                        <div class="box box--example" style="margin-bottom: 0;">
                            <h4 class="box__title">Ganho de entendimento</h4>
                            <p>${escapeHtml(pedagogy.gain)}</p>
                        </div>
                    </div>

                    <div class="card module-panel module-panel--map">
                        <h3>Proximo passo recomendado</h3>
                        <p>${escapeHtml(modules.length ? `Depois de explorar, revise ${modules[0].title}, faca uma pratica curta e so depois avance para o simulado.` : 'Depois de explorar, explique o padrao sem olhar a tela e teste a ideia em uma questao curta.')}</p>
                        ${modules.length ? `<button class="btn btn--secondary" type="button" onclick="window.navigateTo('${escapeAttribute(modules[0].id)}')">Revisar modulo agora</button>` : ''}
                        <button class="btn btn--secondary" type="button" data-chat-launcher="${escapeAttribute(tutorPrompt)}">Revisar com Tutor IA</button>
                    </div>
                </aside>
            </div>
        </div>
    `;
}

window.generateSimulado = function () {
    window.navigateTo('page-simulado');
    const intro = document.getElementById('simulado-intro');
    const container = document.getElementById('simulado-container');
    const result = document.getElementById('simulado-result');
    if (intro) intro.style.display = 'block';
    if (container) container.style.display = 'none';
    if (result) result.style.display = 'none';
};

window.__legacyAppOpenLaboratoryExperience = function(artifactId) {
    const items = window.ARTIFACTS_LIBRARY?.items || [];
    const artifact = items.find(a => a.slug === artifactId);
    if (!artifact) return;

    window.navigateTo('page-laboratory-experience');
    const container = document.getElementById('lab-experience-container');
    if (container) {
        const embedUrl = `${window.ARTIFACTS_LIBRARY.hostPage}?frameId=lab-${artifact.slug}&src=/content/artifacts/raw/${artifact.file}`;
        container.innerHTML = `
            <div class="lab-experience-layout" style="padding-top: 20px;">
                <header class="lab-experience-header" style="margin-bottom: 24px;">
                    <button class="btn btn--secondary" style="width: auto; padding: 10px 16px; margin-bottom: 24px;" onclick="window.navigateTo('page-laboratorio')">← Voltar à galeria</button>
                    <h2 style="font-size: 2.2rem; margin-bottom: 8px;">${escapeHtml(artifact.title)}</h2>
                    <p style="color: var(--text-muted); font-size: 1.1rem; max-width: 60ch;">${escapeHtml(artifact.summary)}</p>
                    <div style="margin-top: 16px; padding: 12px 16px; background: var(--secondary-container); border-radius: 12px; color: var(--on-secondary-container); font-size: 0.9rem;">
                        <strong>Como explorar:</strong> ${escapeHtml(artifact.hint || artifact.observe)}
                    </div>
                </header>
                <div class="lab-experience-content">
                    <div class="artifact-frame-shell" style="border-radius: var(--radius-box); overflow: hidden; background: #fff; box-shadow: var(--shadow-soft);">
                        <iframe
                            class="artifact-frame"
                            title="${escapeAttribute(artifact.title)}"
                            src="${escapeAttribute(embedUrl)}"
                            style="width: 100%; height: ${Number(artifact.height) || 600}px; border: none; display: block;"
                        ></iframe>
                    </div>
                </div>
            </div>
        `;
    }
};

window.appOpenLaboratoryExperience = function(artifactId) {
    const items = window.ARTIFACTS_LIBRARY?.items || [];
    const artifact = items.find((item) => item.slug === artifactId);
    if (!artifact) return;

    window.__LAST_ARTIFACT_SOURCE_PAGE__ = (typeof window.location.hash === 'string'
        ? window.location.hash.replace('#', '').trim()
        : '') || 'page-home';
    window.navigateTo('page-laboratory-experience');

    const container = document.getElementById('lab-experience-container');
    if (!container) return;

    container.innerHTML = renderArtifactExperiencePage(artifact);
    if (window.ContentRenderer?.renderMathIn) {
        window.ContentRenderer.renderMathIn(container);
    }
};

window.explainTopic = async function (topic, buttonElement) {
    const container = getAIContainer(buttonElement);
    if (!container) return;
    setAILoading(container, 'Gerando explicacao com IA...');

    try {
        const data = await window.AppAPI.apiRequest('/api/explain-topic', {
            method: 'POST',
            body: { topic },
            feature: 'explain-topic',
        });
        setAIResult(container, 'Explicacao do modulo', renderExplainHtml(data.explanation, 'Gerado pela IA em tempo real.'));
    } catch (error) {
        logApiDiagnostics('explain-topic', error);
        setAIResult(container, 'Explicacao do modulo', renderExplainHtml(buildLocalExplainPayload(topic), buildFallbackReason(error)));
    }
};

window.generateReview = async function (topic, buttonElement) {
    const container = getAIContainer(buttonElement);
    if (!container) return;
    setAILoading(container, 'Gerando revisao com IA...');

    try {
        const data = await window.AppAPI.apiRequest('/api/generate-review', {
            method: 'POST',
            body: { topic },
            feature: 'generate-review',
        });
        setAIResult(container, 'Revisao rapida', renderReviewHtml(data.review, 'Gerado pela IA em tempo real.'));
    } catch (error) {
        logApiDiagnostics('generate-review', error);
        setAIResult(container, 'Revisao rapida', renderReviewHtml(buildLocalReviewPayload(topic), buildFallbackReason(error)));
    }
};

window.generateExercises = async function (topic, buttonElement) {
    const container = getAIContainer(buttonElement);
    if (!container) return;
    setAILoading(container, 'Gerando exercicios com IA...');

    try {
        const data = await window.AppAPI.apiRequest('/api/generate-exercises', {
            method: 'POST',
            body: { topic },
            feature: 'generate-exercises',
        });
        setAIResult(container, 'Exercicios adicionais', renderExercisesHtml(data.exercises, 'Gerado pela IA em tempo real.'));
    } catch (error) {
        logApiDiagnostics('generate-exercises', error);
        setAIResult(container, 'Exercicios adicionais', renderExercisesHtml(buildLocalExercisesPayload(topic), buildFallbackReason(error)));
    }
};

// ── Feynman Mode ──────────────────────────────────────────────────────────────

(function initFeynmanMode() {
    const backdrop = document.getElementById('feynman-backdrop');
    const modal = document.getElementById('feynman-modal');
    const modalTitle = document.getElementById('feynman-modal-title');
    const questionLabel = document.getElementById('feynman-question-label');
    const inputPhase = document.getElementById('feynman-input-phase');
    const loadingPhase = document.getElementById('feynman-loading-phase');
    const resultPhase = document.getElementById('feynman-result-phase');
    const textarea = document.getElementById('feynman-input');
    const submitBtn = document.getElementById('feynman-submit');
    const retryBtn = document.getElementById('feynman-retry');
    let idealBtn = document.getElementById('feynman-ideal');
    const closeBtn = document.getElementById('feynman-close');
    const scoreBanner = document.getElementById('feynman-score-banner');
    const feedbackBox = document.getElementById('feynman-feedback');
    const inlineError = document.getElementById('feynman-inline-error');
    const idealPanel = document.getElementById('feynman-ideal-panel');

    if (!modal) return;
    window.__disableLegacyFeynman = true;
    if (window.__disableLegacyFeynman) return;

    let currentTopic = '';
    let currentTitle = '';
    let restoreFocusTarget = null;

    function showPhase(phase) {
        inputPhase.classList.toggle('hidden', phase !== 'input');
        loadingPhase.classList.toggle('hidden', phase !== 'loading');
        resultPhase.classList.toggle('hidden', phase !== 'result');
    }

    function setInlineError(message = '') {
        if (!inlineError) return;
        inlineError.textContent = message;
        inlineError.classList.toggle('hidden', !message);
    }

    function resetIdealPanel() {
        if (!idealPanel) return;
        idealPanel.classList.add('hidden');
        idealPanel.innerHTML = '';
        idealBtn.textContent = 'Ver explicacao ideal';
        idealBtn.disabled = false;
    }

    function openModal(topic, title) {
        restoreFocusTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        currentTopic = topic;
        currentTitle = title || topic;
        modalTitle.textContent = currentTitle;
        questionLabel.textContent = `Explique com suas proprias palavras o que voce entendeu sobre "${currentTitle}".`;
        textarea.value = '';
        submitBtn.disabled = false;
        setInlineError('');
        resetIdealPanel();
        showPhase('input');
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        backdrop.classList.remove('hidden');
        backdrop.removeAttribute('aria-hidden');
        document.body.style.overflow = 'hidden';
        setTimeout(() => textarea.focus({ preventScroll: true }), 60);
    }

    function closeModal() {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        backdrop.classList.add('hidden');
        backdrop.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (restoreFocusTarget instanceof HTMLElement && document.contains(restoreFocusTarget)) {
            setTimeout(() => restoreFocusTarget.focus({ preventScroll: true }), 40);
        }
    }

    function getScoreLabel(score) {
        if (score <= 4) return { label: 'Não entendeu ainda', cls: 'feynman-score--low' };
        if (score <= 7) return { label: 'Entendimento parcial', cls: 'feynman-score--mid' };
        return { label: 'Dominou o conteúdo!', cls: 'feynman-score--high' };
    }

    function renderList(items, emptyText) {
        if (!items || !items.length) return `<span class="feynman-empty">${escapeHtml(emptyText)}</span>`;
        return `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
    }

    function renderFeedback(result) {
        const { score, acertos, falhas, erros, recomendacao } = result;
        const { label, cls } = getScoreLabel(score);

        scoreBanner.className = `feynman-score-banner ${cls}`;
        scoreBanner.innerHTML = `
            <span class="feynman-score-number">${score}<span>/10</span></span>
            <span class="feynman-score-label">${escapeHtml(label)}</span>
        `;

        feedbackBox.innerHTML = `
            <div class="feynman-feedback-section feynman-feedback-section--ok">
                <h4>✔ Acertos</h4>
                ${renderList(acertos, 'Nenhum acerto identificado.')}
            </div>
            <div class="feynman-feedback-section feynman-feedback-section--warn">
                <h4>⚠ Falhas</h4>
                ${renderList(falhas, 'Nenhuma falha identificada.')}
            </div>
            <div class="feynman-feedback-section feynman-feedback-section--err">
                <h4>✕ Erros conceituais</h4>
                ${renderList(erros, 'Nenhum erro conceitual encontrado.')}
            </div>
            <div class="feynman-feedback-section feynman-feedback-section--tip">
                <h4>Recomendação</h4>
                <p>${escapeHtml(recomendacao)}</p>
            </div>
        `;
    }

    function renderIdealExplanation(payload, note = '') {
        if (!idealPanel) return;
        idealPanel.classList.remove('hidden');
        idealPanel.innerHTML = `
            <div class="feynman-ideal-card">
                <div class="feynman-ideal-card__header">
                    <span class="feynman-ideal-card__eyebrow">Explicacao ideal</span>
                    <h4>${escapeHtml(payload.title || currentTitle)}</h4>
                </div>
                <div class="feynman-ideal-card__body">
                    ${renderExplainHtml(payload, note)}
                </div>
            </div>
        `;
        idealBtn.textContent = 'Ocultar explicacao ideal';
        if (window.ContentRenderer?.renderMathIn) window.ContentRenderer.renderMathIn(idealPanel);
    }

    async function submitExplanation() {
        const text = textarea.value.trim();
        if (!text) {
            setInlineError('Escreva sua resposta antes de enviar.');
            textarea.focus();
            return;
        }
        if (text.length < 20) {
            setInlineError('Escreva pelo menos 20 caracteres para a avaliacao fazer sentido.');
            textarea.focus();
            return;
        }

        setInlineError('');
        resetIdealPanel();
        submitBtn.disabled = true;
        showPhase('loading');

        try {
            const data = await window.AppAPI.apiRequest('/api/feynman/evaluate', {
                method: 'POST',
                body: { tema: currentTopic, resposta: text, nivel: 'iniciante' },
                feature: 'feynman-evaluate',
            });
            renderFeedback(data.result || data);
            showPhase('result');
        } catch (error) {
            logApiDiagnostics('feynman-evaluate', error);
            scoreBanner.className = 'feynman-score-banner feynman-score--low';
            scoreBanner.innerHTML = '<span class="feynman-score-label">Não foi possível avaliar. Tente novamente.</span>';
            feedbackBox.innerHTML = `
                <div class="feynman-feedback-section feynman-feedback-section--err">
                    <h4>Erro na avaliacao</h4>
                    <p>${escapeHtml(error?.message || 'Tente novamente em instantes.')}</p>
                </div>
            `;
            showPhase('result');
        }
        submitBtn.disabled = false;
    }

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    submitBtn.addEventListener('click', submitExplanation);

    retryBtn.addEventListener('click', () => {
        showPhase('input');
        textarea.value = '';
        setInlineError('');
        submitBtn.disabled = false;
        resetIdealPanel();
        setTimeout(() => textarea.focus(), 60);
    });

    idealBtn.addEventListener('click', () => {
        closeModal();
        if (window.ChatWidget) {
            window.ChatWidget.openWithPrompt(
                `Dê a explicação ideal e completa sobre: "${currentTitle}". Seja didático e estruturado.`,
            );
        }
    });

    idealBtn.replaceWith(idealBtn.cloneNode(true));
    idealBtn = document.getElementById('feynman-ideal');
    idealBtn.addEventListener('click', async () => {
        if (idealPanel && !idealPanel.classList.contains('hidden')) {
            resetIdealPanel();
            return;
        }

        if (!idealPanel) return;

        idealBtn.disabled = true;
        idealBtn.textContent = 'Carregando...';
        idealPanel.classList.remove('hidden');
        idealPanel.innerHTML = '<div class="feynman-ideal-loading"><div class="loader"></div><span>Montando explicacao ideal...</span></div>';

        try {
            const data = await withApiTimeout(
                window.AppAPI.apiRequest('/api/explain-topic', {
                    method: 'POST',
                    body: { topic: currentTopic },
                    feature: 'feynman-ideal-explanation',
                }),
                { ms: 9000, feature: 'feynman-ideal-explanation' },
            );
            renderIdealExplanation(data.explanation, 'Gerado a partir do fluxo de explicacao contextual.');
        } catch (error) {
            logApiDiagnostics('feynman-ideal-explanation', error);
            renderIdealExplanation(buildLocalExplainPayload(currentTopic), buildFallbackReason(error));
        } finally {
            idealBtn.disabled = false;
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !modal.classList.contains('hidden')) {
            if (!submitBtn.disabled && !inputPhase.classList.contains('hidden')) {
                void submitExplanation();
            }
        }
    });

    window.FeynmanMode = {
        open(topic, title) {
            openModal(topic, title);
        },
    };
})();

(function initFeynmanWorkspace() {
    const backdrop = document.getElementById('feynman-backdrop');
    const modal = document.getElementById('feynman-modal');
    const modalTitle = document.getElementById('feynman-modal-title');
    const modalDescription = document.getElementById('feynman-modal-description');
    const topicTitle = document.getElementById('feynman-topic-title');
    const topicSummary = document.getElementById('feynman-topic-summary');
    const topicKeywords = document.getElementById('feynman-topic-keywords');
    const questionLabel = document.getElementById('feynman-question-label');
    const charCount = document.getElementById('feynman-char-count');
    const inputPhase = document.getElementById('feynman-input-phase');
    const loadingPhase = document.getElementById('feynman-loading-phase');
    const resultPhase = document.getElementById('feynman-result-phase');
    const textarea = document.getElementById('feynman-input');
    const submitBtn = document.getElementById('feynman-submit');
    const cancelBtn = document.getElementById('feynman-cancel');
    const retryBtn = document.getElementById('feynman-retry');
    const idealBtn = document.getElementById('feynman-ideal');
    const closeBtn = document.getElementById('feynman-close');
    const scoreBanner = document.getElementById('feynman-score-banner');
    const feedbackBox = document.getElementById('feynman-feedback');
    const inlineError = document.getElementById('feynman-inline-error');
    const idealPanel = document.getElementById('feynman-ideal-panel');
    const stepItems = Array.from(document.querySelectorAll('[data-feynman-step]'));

    if (!modal || !backdrop || !textarea || !submitBtn || !retryBtn || !idealBtn || !closeBtn) return;

    const UI_CONTEXT_BY_SLUG = {
        conjuntos: {
            summary: 'Explique o que e conjunto, como funcionam pertinencia e inclusao e o papel de uniao, intersecao e diferenca.',
            keywords: ['conjunto', 'elemento', 'pertence', 'subconjunto', 'uniao', 'intersecao'],
        },
        'conjuntos-numericos': {
            summary: 'Mostre como voce classifica numeros em N, Z, Q, I e R e como separa racionais de irracionais.',
            keywords: ['naturais', 'inteiros', 'racionais', 'irracionais', 'reais', 'fracao'],
        },
        'ordem-e-intervalos': {
            summary: 'Explique a leitura da reta real, das desigualdades e a diferenca entre extremos abertos e fechados.',
            keywords: ['reta real', 'desigualdade', 'intervalo aberto', 'intervalo fechado', 'parentese', 'colchete'],
        },
        algebra: {
            summary: 'Explique como a distributiva funciona, como reconhecer termos semelhantes e como os sinais interferem na conta.',
            keywords: ['distributiva', 'termos semelhantes', 'sinal', 'parenteses', 'coeficiente'],
        },
        'produtos-notaveis': {
            summary: 'Mostre que voce entende os padroes do quadrado da soma, quadrado da diferenca e produto da soma pela diferenca.',
            keywords: ['quadrado da soma', 'quadrado da diferenca', '2ab', 'dobro do produto', 'diferenca de quadrados'],
        },
        fatoracao: {
            summary: 'Explique como identificar fator comum, diferenca de quadrados e trinomio quadrado perfeito antes de fatorar.',
            keywords: ['fator comum', 'evidencia', 'diferenca de quadrados', 'trinomio quadrado perfeito', 'produto'],
        },
    };

    const state = {
        topic: '',
        title: '',
        moduleId: '',
        moduleSlug: '',
        moduleName: '',
        summary: '',
        keywords: [],
        currentPhase: 'input',
        restoreFocusTarget: null,
    };

    function findModuleByIdentity(moduleId, moduleSlug, topic) {
        const modules = getCourseModules();
        return (
            modules.find((module) => (moduleSlug && module.slug === moduleSlug) || (moduleId && module.id === moduleId)) ||
            findModuleByTopic(topic)
        );
    }

    function resolveContext(input, title) {
        const payload = typeof input === 'string' ? { topic: input, title } : { ...(input || {}) };
        const module = findModuleByIdentity(payload.moduleId, payload.moduleSlug, payload.topic || payload.tema || payload.title || '');
        const resolvedSlug = payload.moduleSlug || module?.slug || '';
        const uiContext = UI_CONTEXT_BY_SLUG[resolvedSlug] || null;

        return {
            topic: payload.topic || payload.tema || module?.aiTopic || module?.title || payload.title || '',
            title: payload.title || payload.moduleName || module?.title || payload.topic || '',
            moduleId: payload.moduleId || module?.id || '',
            moduleSlug: resolvedSlug,
            moduleName: payload.moduleName || module?.title || payload.title || payload.topic || '',
            summary: uiContext?.summary || module?.description || 'Explique a ideia central do tema, o que ela significa e como voce usaria isso em um exemplo simples.',
            keywords:
                Array.isArray(uiContext?.keywords) && uiContext.keywords.length
                    ? uiContext.keywords
                    : Array.isArray(module?.reviewHighlights)
                      ? module.reviewHighlights.slice(0, 5)
                      : [],
        };
    }

    function setBackgroundLock(nextLocked) {
        document.body.classList.toggle('feynman-open', nextLocked);
    }

    function updateStepper(phase = state.currentPhase, supportVisible = false) {
        const flags = {
            explain: phase === 'input' ? 'active' : 'done',
            evaluate: phase === 'loading' || phase === 'result' ? 'active' : '',
            support: supportVisible ? 'active' : '',
        };

        stepItems.forEach((item) => {
            const step = item.getAttribute('data-feynman-step');
            item.classList.remove('is-active', 'is-done');
            if (flags[step] === 'active') item.classList.add('is-active');
            if (flags[step] === 'done') item.classList.add('is-done');
        });
    }

    function updateCharCount() {
        if (!charCount) return;
        charCount.textContent = `${textarea.value.length} / 4000`;
    }

    function showPhase(phase) {
        state.currentPhase = phase;
        inputPhase.classList.toggle('hidden', phase !== 'input');
        loadingPhase.classList.toggle('hidden', phase !== 'loading');
        resultPhase.classList.toggle('hidden', phase !== 'result');
        updateStepper(phase, idealPanel && !idealPanel.classList.contains('hidden'));
    }

    function setInlineError(message = '') {
        if (!inlineError) return;
        inlineError.textContent = message;
        inlineError.classList.toggle('hidden', !message);
    }

    function renderTopicContext() {
        if (modalTitle) modalTitle.textContent = state.title;
        if (modalDescription) {
            modalDescription.textContent = `Explique com suas palavras o que voce entendeu sobre ${state.title}. A IA vai avaliar sua compreensao neste modulo antes de mostrar uma explicacao ideal.`;
        }
        if (questionLabel) {
            questionLabel.textContent = `Explique com suas palavras o que voce entendeu sobre "${state.title}".`;
        }
        if (topicTitle) topicTitle.textContent = state.moduleName || state.title;
        if (topicSummary) topicSummary.textContent = state.summary;
        if (topicKeywords) {
            topicKeywords.innerHTML = state.keywords.length
                ? state.keywords.map((item) => `<span class="feynman-chip">${escapeHtml(item)}</span>`).join('')
                : '<span class="feynman-empty-chip">A avaliacao vai focar na ideia central, nos conceitos principais e na clareza da sua explicacao.</span>';
        }
    }

    function resetIdealPanel() {
        if (!idealPanel) return;
        idealPanel.classList.add('hidden');
        idealPanel.innerHTML = '';
        idealBtn.textContent = 'Ver explicacao ideal';
        idealBtn.disabled = false;
        updateStepper(state.currentPhase, false);
    }

    function openModal(input, title) {
        state.restoreFocusTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        Object.assign(state, resolveContext(input, title));
        renderTopicContext();
        textarea.value = '';
        updateCharCount();
        setInlineError('');
        resetIdealPanel();
        submitBtn.disabled = false;
        if (cancelBtn) cancelBtn.disabled = false;
        showPhase('input');
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        backdrop.classList.remove('hidden');
        backdrop.setAttribute('aria-hidden', 'false');
        setBackgroundLock(true);
        setTimeout(() => textarea.focus({ preventScroll: true }), 60);
    }

    function closeModal() {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        backdrop.classList.add('hidden');
        backdrop.setAttribute('aria-hidden', 'true');
        setBackgroundLock(false);
        if (state.restoreFocusTarget instanceof HTMLElement && document.contains(state.restoreFocusTarget)) {
            setTimeout(() => state.restoreFocusTarget.focus({ preventScroll: true }), 40);
        }
    }

    function getScoreLabel(score) {
        if (score <= 4) return { label: 'Nao entendeu ainda', cls: 'feynman-score--low' };
        if (score <= 7) return { label: 'Entendimento parcial', cls: 'feynman-score--mid' };
        return { label: 'Dominou o conteudo', cls: 'feynman-score--high' };
    }

    function renderList(items, emptyText) {
        if (!items || !items.length) return `<span class="feynman-empty">${escapeHtml(emptyText)}</span>`;
        return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    }

    function renderFeedback(result) {
        const { score, acertos, falhas, erros, recomendacao } = result;
        const { label, cls } = getScoreLabel(score);

        scoreBanner.className = `feynman-score-banner ${cls}`;
        scoreBanner.innerHTML = `
            <span class="feynman-score-number">${score}<span>/10</span></span>
            <span class="feynman-score-label">${escapeHtml(label)}</span>
        `;

        feedbackBox.innerHTML = `
            <div class="feynman-feedback-section feynman-feedback-section--ok">
                <h4>Acertos</h4>
                ${renderList(acertos, 'Nenhum acerto identificado.')}
            </div>
            <div class="feynman-feedback-section feynman-feedback-section--warn">
                <h4>Falhas</h4>
                ${renderList(falhas, 'Nenhuma falha identificada.')}
            </div>
            <div class="feynman-feedback-section feynman-feedback-section--err">
                <h4>Erros conceituais</h4>
                ${renderList(erros, 'Nenhum erro conceitual encontrado.')}
            </div>
            <div class="feynman-feedback-section feynman-feedback-section--tip">
                <h4>Recomendacao</h4>
                <p>${escapeHtml(recomendacao)}</p>
            </div>
        `;
    }

    function renderIdealExplanation(payload, note = '') {
        if (!idealPanel) return;
        idealPanel.classList.remove('hidden');
        idealPanel.innerHTML = `
            <div class="feynman-ideal-card">
                <div class="feynman-ideal-card__header">
                    <span class="feynman-ideal-card__eyebrow">Explicacao ideal</span>
                    <h4>${escapeHtml(payload.title || state.title)}</h4>
                </div>
                <div class="feynman-ideal-card__body">
                    ${renderExplainHtml(payload, note)}
                </div>
            </div>
        `;
        idealBtn.textContent = 'Ocultar explicacao ideal';
        updateStepper('result', true);
        if (window.ContentRenderer?.renderMathIn) window.ContentRenderer.renderMathIn(idealPanel);
    }

    async function submitExplanation() {
        const text = textarea.value.trim();
        if (!text) {
            setInlineError('Escreva sua resposta antes de enviar.');
            textarea.focus();
            return;
        }
        if (text.length < 20) {
            setInlineError('Escreva pelo menos 20 caracteres para a avaliacao fazer sentido.');
            textarea.focus();
            return;
        }

        setInlineError('');
        resetIdealPanel();
        submitBtn.disabled = true;
        if (cancelBtn) cancelBtn.disabled = true;
        showPhase('loading');

        try {
            const data = await window.AppAPI.apiRequest('/api/feynman/evaluate', {
                method: 'POST',
                body: {
                    tema: state.topic,
                    resposta: text,
                    nivel: 'iniciante',
                    moduleId: state.moduleId,
                    moduleSlug: state.moduleSlug,
                    moduleName: state.moduleName || state.title,
                },
                feature: 'feynman-evaluate',
            });
            renderFeedback(data.result || data);
            showPhase('result');
        } catch (error) {
            logApiDiagnostics('feynman-evaluate', error);
            scoreBanner.className = 'feynman-score-banner feynman-score--low';
            scoreBanner.innerHTML = '<span class="feynman-score-label">Nao foi possivel avaliar. Tente novamente.</span>';
            feedbackBox.innerHTML = `
                <div class="feynman-feedback-section feynman-feedback-section--err">
                    <h4>Erro na avaliacao</h4>
                    <p>${escapeHtml(error?.message || 'Tente novamente em instantes.')}</p>
                </div>
            `;
            showPhase('result');
        } finally {
            submitBtn.disabled = false;
            if (cancelBtn) cancelBtn.disabled = false;
        }
    }

    function resetToInput() {
        showPhase('input');
        textarea.value = '';
        updateCharCount();
        setInlineError('');
        submitBtn.disabled = false;
        if (cancelBtn) cancelBtn.disabled = false;
        resetIdealPanel();
        setTimeout(() => textarea.focus({ preventScroll: true }), 60);
    }

    closeBtn.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    submitBtn.addEventListener('click', () => void submitExplanation());
    retryBtn.addEventListener('click', resetToInput);

    textarea.addEventListener('input', () => {
        updateCharCount();
        if (textarea.value.trim().length >= 20) setInlineError('');
    });

    idealBtn.addEventListener('click', async () => {
        if (idealPanel && !idealPanel.classList.contains('hidden')) {
            resetIdealPanel();
            return;
        }

        idealBtn.disabled = true;
        idealBtn.textContent = 'Carregando...';
        idealPanel.classList.remove('hidden');
        idealPanel.innerHTML = '<div class="feynman-ideal-loading"><div class="loader"></div><span>Montando explicacao ideal...</span></div>';

        try {
            const data = await withApiTimeout(
                window.AppAPI.apiRequest('/api/explain-topic', {
                    method: 'POST',
                    body: { topic: state.topic },
                    feature: 'feynman-ideal-explanation',
                }),
                { ms: 9000, feature: 'feynman-ideal-explanation' },
            );
            renderIdealExplanation(data.explanation, 'Gerado a partir do fluxo de explicacao contextual.');
        } catch (error) {
            logApiDiagnostics('feynman-ideal-explanation', error);
            renderIdealExplanation(buildLocalExplainPayload(state.topic), buildFallbackReason(error));
        } finally {
            idealBtn.disabled = false;
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !modal.classList.contains('hidden')) {
            if (!submitBtn.disabled && !inputPhase.classList.contains('hidden')) {
                void submitExplanation();
            }
        }
    });

    updateCharCount();

    window.FeynmanMode = {
        open(input, title) {
            openModal(input, title);
        },
        close() {
            closeModal();
        },
    };
})();

// ── End Feynman Mode ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    repairTextNodes(document.body);

    const btnBack = document.getElementById('btn-back');
    const btnLogout = document.getElementById('btn-logout');
    const modulesList = document.getElementById('modules-list');
    const modulePages = document.getElementById('module-pages');
    const laboratoryDashboard = document.getElementById('laboratory-dashboard');
    const reviewDashboard = document.getElementById('review-dashboard');
    const chatToggle = document.getElementById('chat-toggle');
    const chatWindow = document.getElementById('chat-window');
    const chatBackdrop = document.getElementById('chat-backdrop');
    const chatClose = document.getElementById('chat-close');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');
    const chatMessages = document.getElementById('chat-messages');
    const chatModel = document.getElementById('chat-model');
    const sessionStatus = document.getElementById('session-status');
    const sessionCountdown = document.getElementById('session-countdown');
    const sessionWarningText = document.getElementById('session-warning-text');
    const appMain = document.querySelector('main.app-container');
    const appFooter = document.querySelector('.app-footer');

    let pages = [];
    let chatHistory = [];
    let currentUser = null;
    let chatIsOpen = false;
    let chatRestoreFocusTarget = null;
    let chatCurrentMode = null;
    const sessionState = {
        ttlMs: 30 * 60 * 1000,
        warningMs: 5 * 60 * 1000,
        expiresAtMs: 0,
        lastRefreshAt: 0,
        lastStatusSyncAt: 0,
        refreshInFlight: null,
        refreshTimer: 0,
        countdownTimer: 0,
        statusTimer: 0,
        expired: false,
        lastScrollY: window.scrollY || 0,
    };
    const SESSION_REFRESH_THROTTLE_MS = 60 * 1000;
    const SESSION_STATUS_POLL_MS = 2 * 60 * 1000;
    const SESSION_SCROLL_DELTA_PX = 140;

    if (chatMessages) {
        chatMessages.setAttribute('role', 'log');
        chatMessages.setAttribute('aria-live', 'polite');
        chatMessages.setAttribute('aria-relevant', 'additions text');
    }

    if (chatInput) {
        chatInput.setAttribute('enterkeyhint', 'send');
        chatInput.setAttribute('inputmode', 'text');
        chatInput.setAttribute('spellcheck', 'false');
    }

    function clearSessionTimers() {
        if (sessionState.refreshTimer) {
            window.clearTimeout(sessionState.refreshTimer);
            sessionState.refreshTimer = 0;
        }
        if (sessionState.countdownTimer) {
            window.clearInterval(sessionState.countdownTimer);
            sessionState.countdownTimer = 0;
        }
        if (sessionState.statusTimer) {
            window.clearInterval(sessionState.statusTimer);
            sessionState.statusTimer = 0;
        }
    }

    function syncAppScrollOffset() {
        document.documentElement.style.setProperty('--app-scroll-offset', `${getHeaderScrollOffset()}px`);
    }

    function syncChatPresentation() {
        if (!chatWindow) return;
        chatWindow.dataset.presentation = isCompactViewport() ? 'sheet' : 'panel';
        if (chatToggle) {
            chatToggle.dataset.presentation = isCompactViewport() ? 'sheet' : 'panel';
        }
    }

    function setBackgroundInteractionLock(nextLocked) {
        if (appMain) {
            appMain.toggleAttribute('inert', nextLocked);
            appMain.setAttribute('aria-hidden', nextLocked ? 'true' : 'false');
        }

        if (appFooter) {
            appFooter.toggleAttribute('inert', nextLocked);
            appFooter.setAttribute('aria-hidden', nextLocked ? 'true' : 'false');
        }
    }

    function formatSessionRemaining(totalMs) {
        const safeMs = Math.max(0, totalMs);
        const totalSeconds = Math.ceil(safeMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function getSessionRemainingMs() {
        return Math.max(0, sessionState.expiresAtMs - Date.now());
    }

    function renderSessionStatus() {
        if (!sessionStatus || !sessionCountdown) {
            return;
        }

        const remainingMs = getSessionRemainingMs();
        sessionCountdown.textContent = formatSessionRemaining(remainingMs);
        sessionStatus.classList.remove('hidden');
        sessionStatus.classList.toggle('session-status--warning', remainingMs > 0 && remainingMs <= sessionState.warningMs);
        sessionStatus.classList.toggle('session-status--danger', remainingMs > 0 && remainingMs <= 60 * 1000);

        if (sessionWarningText) {
            sessionWarningText.classList.toggle('hidden', !(remainingMs > 0 && remainingMs <= sessionState.warningMs));
        }
    }

    async function expireSession(reason = 'expired') {
        if (sessionState.expired) {
            return;
        }

        sessionState.expired = true;
        clearSessionTimers();
        console.warn('[session] expired', { reason });

        try {
            if (window.Store?.clearAll) {
                window.Store.clearAll({ skipRemote: true });
            }
        } catch (error) {
            console.error('[session] failed to clear local state on expiration', error);
        }

        window.location.assign(buildApiUrl('/login'));
    }

    function applySessionPayload(payload, { source = 'unknown', optimistic = false } = {}) {
        const ttlSeconds = Number(payload?.sessionTtlSeconds);
        const warningSeconds = Number(payload?.warningThresholdSeconds);
        const expiresAtRaw = payload?.sessionExpiresAt;
        const parsedExpiresAt = expiresAtRaw ? new Date(expiresAtRaw).getTime() : NaN;

        if (Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
            sessionState.ttlMs = ttlSeconds * 1000;
        }

        if (Number.isFinite(warningSeconds) && warningSeconds > 0) {
            sessionState.warningMs = warningSeconds * 1000;
        }

        sessionState.expiresAtMs = Number.isFinite(parsedExpiresAt) ? parsedExpiresAt : Date.now() + sessionState.ttlMs;
        if (!optimistic) {
            sessionState.lastRefreshAt = Date.now();
            sessionState.lastStatusSyncAt = Date.now();
        }
        sessionState.expired = false;

        renderSessionStatus();
        console.info('[session] status updated', {
            source,
            expiresAt: new Date(sessionState.expiresAtMs).toISOString(),
            ttlMs: sessionState.ttlMs,
            optimistic,
        });
    }

    async function syncSessionStatus(reason = 'poll') {
        if (sessionState.expired) {
            return null;
        }

        try {
            const payload = await window.AppAPI.getSessionStatus();
            applySessionPayload(payload, { source: `status:${reason}` });
            return payload;
        } catch (error) {
            console.error('[session] failed to sync status', { reason, error });
            if (error?.statusCode === 401) {
                await expireSession(`server-status:${reason}`);
            }
            return null;
        }
    }

    async function refreshSession(reason = 'activity') {
        if (sessionState.expired) {
            return null;
        }

        if (sessionState.refreshInFlight) {
            return sessionState.refreshInFlight;
        }

        console.info('[session] refresh requested', { reason });

        sessionState.refreshInFlight = window.AppAPI
            .refreshSession(reason)
            .then((payload) => {
                applySessionPayload(payload, { source: `refresh:${reason}` });
                return payload;
            })
            .catch(async (error) => {
                console.error('[session] refresh failed', { reason, error });
                if (error?.statusCode === 401) {
                    await expireSession(`server-refresh:${reason}`);
                }
                throw error;
            })
            .finally(() => {
                sessionState.refreshInFlight = null;
            });

        return sessionState.refreshInFlight;
    }

    function scheduleTrailingRefresh(reason) {
        if (sessionState.refreshTimer || sessionState.expired) {
            return;
        }

        const elapsed = Date.now() - sessionState.lastRefreshAt;
        const delay = Math.max(1500, SESSION_REFRESH_THROTTLE_MS - Math.max(0, elapsed));

        sessionState.refreshTimer = window.setTimeout(() => {
            sessionState.refreshTimer = 0;
            void refreshSession(`trail:${reason}`);
        }, delay);
    }

    function markSessionActivity(reason, options = {}) {
        if (sessionState.expired || !sessionState.expiresAtMs) {
            return;
        }

        sessionState.expiresAtMs = Date.now() + sessionState.ttlMs;
        renderSessionStatus();

        const shouldRefreshNow =
            options.force === true || Date.now() - sessionState.lastRefreshAt >= SESSION_REFRESH_THROTTLE_MS;

        if (shouldRefreshNow) {
            void refreshSession(reason);
        } else {
            scheduleTrailingRefresh(reason);
        }
    }

    function startSessionClock(initialPayload) {
        applySessionPayload(initialPayload, { source: 'bootstrap' });
        clearSessionTimers();

        sessionState.countdownTimer = window.setInterval(() => {
            const remainingMs = getSessionRemainingMs();
            if (remainingMs <= 0) {
                void expireSession('inactive-timeout');
                return;
            }
            renderSessionStatus();
        }, 1000);

        sessionState.statusTimer = window.setInterval(() => {
            void syncSessionStatus('poll');
        }, SESSION_STATUS_POLL_MS);
    }

    window.SessionManager = {
        markActivity(reason, options) {
            markSessionActivity(reason, options);
        },
        async refresh(reason) {
            return refreshSession(reason);
        },
        async sync(reason) {
            return syncSessionStatus(reason);
        },
        stop(reason = 'manual-stop') {
            sessionState.expired = true;
            clearSessionTimers();
            console.info('[session] timers stopped', { reason });
        },
    };

    function bindArtifactSessionActivity(iframe) {
        if (!iframe || iframe.dataset.sessionActivityBound === 'true') {
            return;
        }

        iframe.dataset.sessionActivityBound = 'true';
        iframe.addEventListener('load', () => {
            try {
                const frameWindow = iframe.contentWindow;
                const frameDocument = iframe.contentDocument;
                if (!frameWindow || !frameDocument) {
                    return;
                }

                frameDocument.addEventListener('click', () => markSessionActivity('artifact-click'));
                frameDocument.addEventListener('input', () => markSessionActivity('artifact-input'));
                frameDocument.addEventListener('submit', () => markSessionActivity('artifact-submit'), true);

                let frameLastScrollY = frameWindow.scrollY || 0;
                frameWindow.addEventListener(
                    'scroll',
                    () => {
                        const currentScrollY = frameWindow.scrollY || 0;
                        if (Math.abs(currentScrollY - frameLastScrollY) >= SESSION_SCROLL_DELTA_PX) {
                            frameLastScrollY = currentScrollY;
                            markSessionActivity('artifact-scroll');
                        }
                    },
                    { passive: true },
                );
            } catch (error) {
                console.warn('[session] unable to bind artifact iframe activity', error);
            }
        });
    }

    function refreshPages() {
        pages = Array.from(document.querySelectorAll('.page'));
    }

    function setLoadingCard(target, message) {
        if (!target) return;
        target.innerHTML = `<div class="card loading-card"><div class="loader"></div><p>${message}</p></div>`;
    }

    function setErrorCard(target, message) {
        if (!target) return;
        target.innerHTML = `<div class="card error-card"><h3>Falha ao carregar conteúdo</h3><p>${message}</p></div>`;
    }

    try {
        const me = await window.AppAPI.getCurrentUser();
        currentUser = me.user;
        window.__AUTH_USER__ = currentUser;
        renderAuthBadge(currentUser);
        startSessionClock(me);

        if (window.Store?.hydrateFromServer) {
            await window.Store.hydrateFromServer(window.AppAPI.apiRequest);
        } else if (window.Store?.configureRemote) {
            window.Store.configureRemote(window.AppAPI.apiRequest);
        }
    } catch (error) {
        console.error('[auth] falha ao carregar sessão atual', error);
        window.location.assign(buildApiUrl('/login'));
        return;
    }

    window.updateProgress = function () {
        const completed = Store.load('completedQuizzes') || [];
        const totalTopics = Array.isArray(window.MODULES_DATA) ? window.MODULES_DATA.length : 0;
        const count = Math.min(completed.length, totalTopics);
        const progressText = document.querySelector('.card--progress p');
        const progressFill = document.querySelector('.progress-fill');
        if (progressText) progressText.textContent = `Você revisou ${count} de ${totalTopics} módulos`;
        if (progressFill) progressFill.style.width = totalTopics ? `${(count / totalTopics) * 100}%` : '0%';
    };

    window.navigateTo = function (pageId) {
        refreshPages();
        closeChatWindow();
        pages.forEach((page) => page.classList.remove('active'));
        const target = document.getElementById(pageId);
        if (target) target.classList.add('active');
        btnBack.classList.toggle('hidden', pageId === 'page-home');
        const nextUrl = pageId === 'page-home' ? window.location.pathname : `${window.location.pathname}#${pageId}`;
        window.history.replaceState(null, '', nextUrl);
        window.scrollTo({ top: 0, behavior: 'auto' });

        // Update chat toggle label with module context
        const moduleCtx = getActiveModuleContext();
        const toggleLabel = chatToggle?.querySelector('.chat-toggle__label');
        if (toggleLabel) {
            toggleLabel.textContent = moduleCtx ? `Tutor · ${moduleCtx.module_title}` : 'Abrir tutor';
        }
    };

    function scrollToContentAnchor(anchorId) {
        const target = document.getElementById(anchorId);
        if (!target) return;
        closeChatWindow();
        const top = target.getBoundingClientRect().top + window.scrollY - getHeaderScrollOffset();
        window.scrollTo({ top, behavior: 'smooth' });
    }

    function toggleChecklist(item, eventTarget) {
        const checkbox = item.querySelector('input');
        if (!checkbox) return;
        if (eventTarget !== checkbox) checkbox.checked = !checkbox.checked;
        item.classList.toggle('checked', checkbox.checked);
    }

    function renderChatContent(role, value) {
        const content = String(value ?? '');
        if (role === 'model') {
            if (isRawHtmlSnippet(content)) return content;
            return renderTutorResponse(content);
        }

        return escapeHtml(content).replace(/\n/g, '<br>');
    }

    function appendMessage(role, html, id = null) {
        const message = document.createElement('div');
        message.className = `chat-message ${role}`;
        if (id) message.id = id;
        if (role === 'model') {
            message.classList.add('chat-message--structured');
        }
        if (/^<div class="loader"/.test(String(html || '').trim())) {
            message.classList.add('chat-message--loading');
        }
        message.innerHTML = renderChatContent(role, html);
        chatMessages.appendChild(message);
        if (window.ContentRenderer?.renderMathIn) window.ContentRenderer.renderMathIn(message);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function ensureChatGreeting() {
        if (chatHistory.length === 0 && !chatMessages.children.length) {
            appendMessage('model', [
                '### Resumo rapido',
                'Sou seu tutor de matematica. Posso explicar modulos, revisar teoria e montar exercicios guiados.',
                '',
                '### Explicacao',
                '- Posso resumir um modulo, um artefato ou uma questao em blocos curtos.',
                '- Tambem posso gerar pratica rapida, revisar erro comum e mostrar um exemplo curto.',
                '',
                '### O que observar',
                'Use perguntas com tema + objetivo, por exemplo: "explique fatoracao", "mostre um exemplo" ou "aponte erros comuns".',
                '',
                '### Erros comuns',
                '- Pedir algo amplo demais e receber uma resposta mais vaga do que voce precisa.',
                '- Pular direto para exercicios sem antes alinhar a ideia central.',
                '',
                '### Exemplo',
                '"Explique este modulo em blocos curtos e destaque o que mais cai na prova."',
            ].join('\n'));
        }
    }

    function syncChatVisibility(nextOpen) {
        chatIsOpen = Boolean(nextOpen);
        document.body.classList.toggle('chat-open', chatIsOpen);
        syncChatPresentation();
        setBackgroundInteractionLock(chatIsOpen);
        chatToggle?.setAttribute('aria-expanded', chatIsOpen ? 'true' : 'false');
        chatWindow?.setAttribute('aria-hidden', chatIsOpen ? 'false' : 'true');
        chatBackdrop?.classList.toggle('hidden', !chatIsOpen);
        chatWindow?.classList.toggle('hidden', !chatIsOpen);
        chatBackdrop?.setAttribute('aria-hidden', chatIsOpen ? 'false' : 'true');
    }

    function openChatWindow() {
        if (!chatIsOpen) {
            chatRestoreFocusTarget = document.activeElement instanceof HTMLElement && !chatWindow?.contains(document.activeElement)
                ? document.activeElement
                : chatToggle;
        }
        syncChatVisibility(true);
        ensureChatGreeting();
        updateChatContextBadge(getActiveModuleContext());
        requestAnimationFrame(() => {
            chatInput?.focus({ preventScroll: true });
            if (chatInput?.value) {
                chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
            }
        });
    }

    function closeChatWindow() {
        if (!chatIsOpen) return;
        syncChatVisibility(false);
        const target = chatRestoreFocusTarget instanceof HTMLElement && document.contains(chatRestoreFocusTarget)
            ? chatRestoreFocusTarget
            : chatToggle;
        chatRestoreFocusTarget = null;
        requestAnimationFrame(() => target?.focus?.({ preventScroll: true }));
    }

    function getChatFallbackMessage(error) {
        if (error?.diagnostics?.errorType === 'quota_exceeded') {
            return [
                '### Resumo rapido',
                'O chat nao respondeu porque a cota atual do provider foi excedida.',
                '',
                '### Explicacao',
                'Use os modulos, os quizzes locais e a revisao integrada enquanto isso.',
                '',
                '### O que observar',
                'O conteudo local continua disponivel e esta pronto para estudo.',
            ].join('\n');
        }
        if (error?.diagnostics?.errorType === 'missing_key') {
            return [
                '### Resumo rapido',
                'O chat nao esta configurado porque falta a variavel GEMINI_API_KEY no backend.',
                '',
                '### Explicacao',
                'Enquanto isso, use os modulos, os quizzes locais e os artefatos para seguir estudando.',
                '',
                '### Exemplo',
                'Abra um modulo e peça uma explicacao guiada para o mesmo tema.',
            ].join('\n');
        }
        return [
            '### Resumo rapido',
            'Nao consegui processar sua mensagem agora.',
            '',
            '### Explicacao',
            'O console mostra o diagnostico tecnico e o conteudo local do app continua disponivel.',
            '',
            '### Erros comuns',
            'Tente reformular com um tema especifico, por exemplo: "explique conjuntos numericos".',
        ].join('\n');
    }

    function getActiveModuleContext() {
        const activePage = document.querySelector('.page.active');
        if (!activePage) return null;

        const pageId = activePage.id || '';
        if (!pageId.startsWith('page-modulo-')) return null;

        const slug = pageId.replace('page-modulo-', '');
        const modules = getCourseModules();
        const mod = modules.find((m) => m.slug === slug);
        if (!mod) return null;

        return {
            module_id: mod.id,
            module_slug: mod.slug,
            module_title: mod.title,
        };
    }

    function updateChatContextBadge(moduleCtx) {
        const badge = document.getElementById('chat-context-badge');
        const label = document.getElementById('chat-context-label');
        if (!badge || !label) return;

        if (moduleCtx) {
            label.textContent = moduleCtx.module_title;
            badge.classList.remove('hidden');
            badge.classList.remove('chat-context-badge--general');
            badge.classList.add('chat-context-badge--module');
        } else {
            label.textContent = 'IA geral';
            badge.classList.remove('hidden');
            badge.classList.remove('chat-context-badge--module');
            badge.classList.add('chat-context-badge--general');
        }
    }

    function updateChatContextFromResponse(data) {
        const badge = document.getElementById('chat-context-badge');
        const label = document.getElementById('chat-context-label');
        if (!badge || !label) return;

        chatCurrentMode = data.mode || null;

        if (data.mode === 'module_context' && data.moduleTitle) {
            label.textContent = data.moduleTitle;
            badge.classList.remove('hidden', 'chat-context-badge--general');
            badge.classList.add('chat-context-badge--module');
        } else if (data.mode === 'general_fallback') {
            label.textContent = 'IA geral';
            badge.classList.remove('hidden', 'chat-context-badge--module');
            badge.classList.add('chat-context-badge--general');
        }
    }

    async function sendChatMessage() {
        const text = chatInput.value.trim();
        if (!text) return;
        appendMessage('user', text);
        chatInput.value = '';
        chatSend.disabled = true;

        const moduleCtx = getActiveModuleContext();

        const loadingId = `chat-loading-${Date.now()}`;
        appendMessage('model', '<div class="loader" style="border-top-color:var(--blue-ink);"></div>', loadingId);

        try {
            const body = {
                history: chatHistory,
                message: text,
                model: chatModel.value,
            };

            if (moduleCtx) {
                body.module_slug = moduleCtx.module_slug;
                body.module_id = moduleCtx.module_id;
            }

            const data = await window.AppAPI.apiRequest('/api/chat', {
                method: 'POST',
                body,
                feature: 'chat',
            });
            document.getElementById(loadingId)?.remove();
            appendMessage('model', data.text);
            chatHistory.push({ role: 'user', parts: [{ text }] });
            chatHistory.push({ role: 'model', parts: [{ text: data.text }] });

            updateChatContextFromResponse(data);
        } catch (error) {
            document.getElementById(loadingId)?.remove();
            logApiDiagnostics('chat', error);
            appendMessage('model', getChatFallbackMessage(error));
        } finally {
            chatSend.disabled = false;
            chatInput.focus({ preventScroll: true });
        }
    }

    async function openChatWithPrompt(prompt, { submit = true } = {}) {
        const normalizedPrompt = String(prompt || '').trim();
        if (!normalizedPrompt) return;
        openChatWindow();
        chatInput.value = normalizedPrompt;
        chatInput.focus({ preventScroll: true });
        chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);

        if (submit && !chatSend.disabled) {
            await sendChatMessage();
        }
    }

    window.ChatWidget = {
        openWithPrompt(prompt, options = {}) {
            void openChatWithPrompt(prompt, options);
        },
    };

    function toggleArtifactPanel(toggleButton) {
        const panelId = toggleButton.dataset.panelId;
        const panel = panelId ? document.getElementById(panelId) : null;

        if (!panel) {
            return;
        }

        const isOpening = panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !isOpening);
        toggleButton.setAttribute('aria-expanded', String(isOpening));
        toggleButton.textContent = isOpening
            ? toggleButton.dataset.closeLabel || 'Fechar visualizacao'
            : toggleButton.dataset.openLabel || 'Abrir visualizacao';

        if (isOpening) {
            const iframe = panel.querySelector('[data-artifact-frame]');
            if (iframe) {
                bindArtifactSessionActivity(iframe);
            }
            if (iframe && !iframe.getAttribute('src') && iframe.dataset.artifactSrc) {
                iframe.setAttribute('src', iframe.dataset.artifactSrc);
            }
            if (window.ContentRenderer?.renderMathIn) {
                window.ContentRenderer.renderMathIn(panel);
            }
        }
    }

    function updateArtifactFrameHeight(frameId, nextHeight) {
        const numericHeight = Math.max(380, Math.min(1800, Math.round(Number(nextHeight) || 0)));
        if (!numericHeight) return;

        const frame = Array.from(document.querySelectorAll('[data-artifact-frame]')).find(
            (node) => node.dataset.artifactFrame === frameId,
        );

        if (frame) {
            frame.style.height = `${numericHeight}px`;
        }
    }

    function handleArtifactMessage(event) {
        const payload = event.data;
        if (!payload || typeof payload !== 'object' || typeof payload.type !== 'string') {
            return;
        }

        if (!payload.type.startsWith('artifact-')) {
            return;
        }

        if (payload.type === 'artifact-height' && payload.frameId) {
            updateArtifactFrameHeight(payload.frameId, payload.height);
            return;
        }

        if (payload.type === 'artifact-prompt') {
            markSessionActivity('artifact-prompt', { force: true });
            console.info('[artifact] prompt requested', payload);
            void openChatWithPrompt(payload.prompt, { submit: true });
            return;
        }

        if (payload.type === 'artifact-ready') {
            markSessionActivity('artifact-ready');
            console.info('[artifact] ready', payload);
        }
    }

    document.addEventListener('click', (event) => {
        markSessionActivity('click');

        const navButton = event.target.closest('[data-nav]');
        if (navButton) {
            window.navigateTo(navButton.dataset.nav);
            return;
        }
        const jumpButton = event.target.closest('[data-scroll-target]');
        if (jumpButton) {
            scrollToContentAnchor(jumpButton.dataset.scrollTarget);
            return;
        }
        const quizButton = event.target.closest('[data-quiz-topic]');
        if (quizButton) {
            closeChatWindow();
            window.generateQuizForTopic(quizButton.dataset.quizTopic);
            return;
        }
        const aiButton = event.target.closest('[data-ai-action]');
        if (aiButton) {
            const action = aiButton.dataset.aiAction;
            const topic = aiButton.dataset.aiTopic;
            if (action === 'feynman') {
                closeChatWindow();
                window.FeynmanMode?.open({
                    topic,
                    title: aiButton.dataset.feynmanTitle || topic,
                    moduleId: aiButton.dataset.feynmanModuleId || '',
                    moduleSlug: aiButton.dataset.feynmanModuleSlug || '',
                    moduleName: aiButton.dataset.feynmanModuleName || aiButton.dataset.feynmanTitle || topic,
                });
                return;
            }
            closeChatWindow();
            if (action === 'explain') window.explainTopic(topic, aiButton);
            if (action === 'exercises') window.generateExercises(topic, aiButton);
            return;
        }
        const chatLauncher = event.target.closest('[data-chat-launcher]');
        if (chatLauncher) {
            void openChatWithPrompt(chatLauncher.dataset.chatLauncher || '', {
                submit: chatLauncher.dataset.chatSubmit !== 'false',
            });
            return;
        }
        const artifactToggle = event.target.closest('[data-artifact-toggle]');
        if (artifactToggle) {
            toggleArtifactPanel(artifactToggle);
            return;
        }
        const checklistItem = event.target.closest('.checklist-item');
        if (checklistItem) toggleChecklist(checklistItem, event.target);
    });

    document.addEventListener('input', () => markSessionActivity('input'));
    document.addEventListener('submit', () => markSessionActivity('submit', { force: true }), true);
    document.addEventListener('change', () => markSessionActivity('change'));
    document.addEventListener('pointerdown', () => markSessionActivity('pointerdown'));
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }
        if (event.key.length === 1 || event.key === 'Enter' || event.key === 'Backspace' || event.key === 'Delete') {
            markSessionActivity('keydown');
        }
    });
    window.addEventListener(
        'scroll',
        () => {
            const nextScrollY = window.scrollY || 0;
            if (Math.abs(nextScrollY - sessionState.lastScrollY) >= SESSION_SCROLL_DELTA_PX) {
                sessionState.lastScrollY = nextScrollY;
                markSessionActivity('scroll');
            }
        },
        { passive: true },
    );
    window.addEventListener('focus', () => {
        markSessionActivity('focus');
        void syncSessionStatus('focus');
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            markSessionActivity('visibility');
            void syncSessionStatus('visibility');
        }
    });

    if (btnBack) btnBack.addEventListener('click', () => window.navigateTo('page-home'));
    if (btnLogout) btnLogout.addEventListener('click', () => {
        void handleLogout(btnLogout);
    });
    if (chatToggle && chatWindow) {
        chatToggle.addEventListener('click', () => {
            if (chatWindow.classList.contains('hidden')) {
                openChatWindow();
            } else {
                closeChatWindow();
            }
        });
    }
    if (chatBackdrop) {
        chatBackdrop.addEventListener('click', closeChatWindow);
    }
    if (chatClose && chatWindow) chatClose.addEventListener('click', closeChatWindow);
    if (chatSend) chatSend.addEventListener('click', sendChatMessage);
    if (chatInput) {
        chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendChatMessage();
            }
        });
    }
    if (chatWindow) {
        chatWindow.addEventListener('click', (event) => {
            const suggestion = event.target.closest?.('[data-chat-prompt]');
            if (!suggestion) return;
            void openChatWithPrompt(suggestion.dataset.chatPrompt || '', { submit: true });
        });
    }
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && chatIsOpen) {
            closeChatWindow();
        }
    });
    window.addEventListener('message', handleArtifactMessage);
    window.addEventListener('resize', () => {
        syncAppScrollOffset();
        syncChatPresentation();
    }, { passive: true });
    window.addEventListener('orientationchange', () => {
        syncAppScrollOffset();
        syncChatPresentation();
    });
    syncAppScrollOffset();
    syncChatPresentation();

    setLoadingCard(modulesList, 'Carregando módulos...');
    setLoadingCard(reviewDashboard, 'Montando revisão...');
    setLoadingCard(laboratoryDashboard, 'Preparando laboratório visual...');

    const moduleSeeds = Array.isArray(window.MODULES_DATA) ? window.MODULES_DATA : [];
    const fallbackModules = buildBootFallbackModules(moduleSeeds);
    let modules = fallbackModules;
    let usedFallback = true;
    const artifactCount = Array.isArray(window.ARTIFACTS_LIBRARY?.items) ? window.ARTIFACTS_LIBRARY.items.length : 0;

    window.__APP_BOOT_DIAGNOSTICS__ = {
        rendererAvailable: Boolean(window.ContentRenderer),
        moduleSeedCount: moduleSeeds.length,
        artifactRegistryCount: artifactCount,
        usedFallback,
        stage: 'booting',
    };

    console.info('[boot] DOM ready', window.__APP_BOOT_DIAGNOSTICS__);
    console.info('[artifacts] registry loaded', { count: artifactCount, hostPage: window.ARTIFACTS_LIBRARY?.hostPage || null });

    if (window.ContentRenderer?.loadCourseContent && moduleSeeds.length) {
        try {
            const loadedModules = await window.ContentRenderer.loadCourseContent(moduleSeeds);
            if (Array.isArray(loadedModules) && loadedModules.length) {
                modules = loadedModules;
                usedFallback = false;
            }
        } catch (error) {
            console.error('[boot] rich content load failed; using fallback modules.', error);
            window.__APP_BOOT_DIAGNOSTICS__.contentLoadError = error instanceof Error ? error.message : String(error);
        }
    } else if (!window.ContentRenderer) {
        console.error('[boot] ContentRenderer unavailable; using plain fallback renderers.');
    }

    window.COURSE_MODULES = modules;
    window.__APP_BOOT_DIAGNOSTICS__.usedFallback = usedFallback;

    try {
        if (window.ContentRenderer?.renderHomeModules) {
            modulesList.innerHTML = window.ContentRenderer.renderHomeModules(modules);
        } else {
            modulesList.innerHTML = renderPlainFallbackHomeModules(modules);
        }
    } catch (error) {
        console.error('[boot] home render failed; falling back to plain module cards.', error);
        modulesList.innerHTML = renderPlainFallbackHomeModules(modules);
    }

    try {
        if (window.ContentRenderer?.renderModulePage) {
            modulePages.innerHTML = modules.map((module) => window.ContentRenderer.renderModulePage(module)).join('');
        } else {
            modulePages.innerHTML = renderPlainFallbackModulePages(modules);
        }
    } catch (error) {
        console.error('[boot] module page render failed; falling back to plain module pages.', error);
        modulePages.innerHTML = renderPlainFallbackModulePages(modules);
    }

    try {
        if (laboratoryDashboard) {
            if (window.ContentRenderer?.renderLaboratoryPage) {
                laboratoryDashboard.innerHTML = window.ContentRenderer.renderLaboratoryPage(modules);
            } else {
                laboratoryDashboard.innerHTML = renderPlainFallbackLaboratoryPage(modules);
            }
        }
    } catch (error) {
        console.error('[boot] laboratory render failed; falling back to plain laboratory page.', error);
        if (laboratoryDashboard) laboratoryDashboard.innerHTML = renderPlainFallbackLaboratoryPage(modules);
    }

    try {
        if (window.ContentRenderer?.renderReviewDashboard) {
            reviewDashboard.innerHTML = window.ContentRenderer.renderReviewDashboard(modules);
        } else {
            reviewDashboard.innerHTML = renderPlainFallbackReviewDashboard(modules);
        }
    } catch (error) {
        console.error('[boot] review render failed; falling back to plain review dashboard.', error);
        reviewDashboard.innerHTML = renderPlainFallbackReviewDashboard(modules);
    }

    document.querySelectorAll('[data-artifact-frame]').forEach((iframe) => {
        bindArtifactSessionActivity(iframe);
    });

    try {
        if (window.ContentRenderer?.renderMathIn) {
            window.ContentRenderer.renderMathIn(document.querySelector('.app-container'));
        }
    } catch (error) {
        console.error('[boot] math rendering failed after initial render.', error);
    }

    if (!modules.length) {
        setErrorCard(modulesList, 'Não foi possível montar os módulos principais.');
        setErrorCard(reviewDashboard, 'A revisão não pôde ser preparada.');
        setErrorCard(laboratoryDashboard, 'O laboratório visual não pôde ser montado.');
    }

    refreshPages();
    window.updateProgress();
    const initialPage = window.location.hash.replace('#', '') || 'page-home';
    if (document.getElementById(initialPage)) {
        window.navigateTo(initialPage);
    } else {
        window.navigateTo('page-home');
    }

    refreshPages();
    window.updateProgress();
    window.__APP_BOOT_DIAGNOSTICS__.stage = 'ready';
    console.info('[boot] ready', window.__APP_BOOT_DIAGNOSTICS__);
    console.info('[AI] API base resolved to', window.AppAPI.resolveApiBaseUrl());
});
