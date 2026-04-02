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

    const { protocol, hostname, port, origin } = window.location;
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
    return isLocalHost && port && port !== '3000' ? `${protocol}//${hostname}:3000` : origin.replace(/\/$/, '');
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

window.generateSimulado = function () {
    window.navigateTo('page-simulado');
    const intro = document.getElementById('simulado-intro');
    const container = document.getElementById('simulado-container');
    const result = document.getElementById('simulado-result');
    if (intro) intro.style.display = 'block';
    if (container) container.style.display = 'none';
    if (result) result.style.display = 'none';
};

window.appOpenLaboratoryExperience = function(artifactId) {
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

document.addEventListener('DOMContentLoaded', async () => {
    const btnBack = document.getElementById('btn-back');
    const btnLogout = document.getElementById('btn-logout');
    const modulesList = document.getElementById('modules-list');
    const modulePages = document.getElementById('module-pages');
    const laboratoryDashboard = document.getElementById('laboratory-dashboard');
    const reviewDashboard = document.getElementById('review-dashboard');
    const chatToggle = document.getElementById('chat-toggle');
    const chatWindow = document.getElementById('chat-window');
    const chatClose = document.getElementById('chat-close');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');
    const chatMessages = document.getElementById('chat-messages');
    const chatModel = document.getElementById('chat-model');
    const sessionStatus = document.getElementById('session-status');
    const sessionCountdown = document.getElementById('session-countdown');
    const sessionWarningText = document.getElementById('session-warning-text');

    let pages = [];
    let chatHistory = [];
    let currentUser = null;
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
        pages.forEach((page) => page.classList.remove('active'));
        const target = document.getElementById(pageId);
        if (target) target.classList.add('active');
        btnBack.classList.toggle('hidden', pageId === 'page-home');
        const nextUrl = pageId === 'page-home' ? window.location.pathname : `${window.location.pathname}#${pageId}`;
        window.history.replaceState(null, '', nextUrl);
        window.scrollTo({ top: 0, behavior: 'auto' });
    };

    function scrollToContentAnchor(anchorId) {
        const target = document.getElementById(anchorId);
        if (!target) return;
        const top = target.getBoundingClientRect().top + window.scrollY - 96;
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
        const markedApi = window.marked?.parse ? window.marked : window.marked?.marked?.parse ? window.marked.marked : null;
        return role === 'model' && markedApi ? markedApi.parse(content) : escapeHtml(content).replace(/\n/g, '<br>');
    }

    function appendMessage(role, html, id = null) {
        const message = document.createElement('div');
        message.className = `chat-message ${role}`;
        if (id) message.id = id;
        message.innerHTML = renderChatContent(role, html);
        chatMessages.appendChild(message);
        if (window.ContentRenderer?.renderMathIn) window.ContentRenderer.renderMathIn(message);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function ensureChatGreeting() {
        if (chatHistory.length === 0 && !chatMessages.children.length) {
            appendMessage('model', 'Olá! Sou seu tutor de matemática. Posso explicar módulos, revisar teoria e resolver exercícios passo a passo.');
        }
    }

    function openChatWindow() {
        chatWindow.classList.remove('hidden');
        ensureChatGreeting();
    }

    function getChatFallbackMessage(error) {
        if (error?.diagnostics?.errorType === 'quota_exceeded') {
            return 'O chat nao respondeu porque a cota atual do provider foi excedida. Use os modulos, os quizzes locais e a revisao integrada enquanto isso.';
        }
        if (error?.diagnostics?.errorType === 'missing_key') {
            return 'O chat nao esta configurado porque falta a variavel GEMINI_API_KEY no backend.';
        }
        return 'Não consegui processar sua mensagem agora. O console mostra o diagnóstico técnico e o conteúdo local do app continua disponível.';
    }

    async function sendChatMessage() {
        const text = chatInput.value.trim();
        if (!text) return;
        appendMessage('user', text);
        chatInput.value = '';
        chatSend.disabled = true;

        const loadingId = `chat-loading-${Date.now()}`;
        appendMessage('model', '<div class="loader" style="border-top-color:var(--blue-ink);"></div>', loadingId);

        try {
            const data = await window.AppAPI.apiRequest('/api/chat', {
                method: 'POST',
                body: { history: chatHistory, message: text, model: chatModel.value },
                feature: 'chat',
            });
            document.getElementById(loadingId)?.remove();
            appendMessage('model', data.text);
            chatHistory.push({ role: 'user', parts: [{ text }] });
            chatHistory.push({ role: 'model', parts: [{ text: data.text }] });
        } catch (error) {
            document.getElementById(loadingId)?.remove();
            logApiDiagnostics('chat', error);
            appendMessage('model', getChatFallbackMessage(error));
        } finally {
            chatSend.disabled = false;
            chatInput.focus();
        }
    }

    async function openChatWithPrompt(prompt, { submit = true } = {}) {
        const normalizedPrompt = String(prompt || '').trim();
        if (!normalizedPrompt) return;
        openChatWindow();
        chatInput.value = normalizedPrompt;
        chatInput.focus();
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
            window.generateQuizForTopic(quizButton.dataset.quizTopic);
            return;
        }
        const aiButton = event.target.closest('[data-ai-action]');
        if (aiButton) {
            const action = aiButton.dataset.aiAction;
            const topic = aiButton.dataset.aiTopic;
            if (action === 'explain') window.explainTopic(topic, aiButton);
            if (action === 'exercises') window.generateExercises(topic, aiButton);
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
                chatWindow.classList.add('hidden');
            }
        });
    }
    if (chatClose && chatWindow) chatClose.addEventListener('click', () => chatWindow.classList.add('hidden'));
    if (chatSend) chatSend.addEventListener('click', sendChatMessage);
    if (chatInput) {
        chatInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') sendChatMessage();
        });
    }
    window.addEventListener('message', handleArtifactMessage);

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
