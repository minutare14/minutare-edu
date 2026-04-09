window.currentQuizQuestions = [];
window.currentQ = 0;
window.score = 0;
window.currentTopic = '';
window.simuladoResults = [];
window.currentFlowSourceLabel = '';

function renderMathIfPossible(target) {
    if (target && window.ContentRenderer?.renderMathIn) {
        window.ContentRenderer.renderMathIn(target);
    }
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showInlineError(containerId, message, retryFn) {
    const element = document.getElementById(containerId);
    if (!element) return;

    element.innerHTML = `
        <div class="quiz-error-box">
            <span>${message}</span>
            ${retryFn ? '<button class="btn-retry" type="button">Tentar novamente</button>' : ''}
        </div>
    `;

    if (retryFn) {
        element.querySelector('.btn-retry')?.addEventListener('click', retryFn);
    }
}

function showQuizLoading(questionTextId, progressId, message) {
    const question = document.getElementById(questionTextId);
    const progress = document.getElementById(progressId);

    if (question) {
        question.innerHTML = `
            <div class="inline-loading">
                <div class="loader"></div>
                <span>${message}</span>
            </div>
        `;
    }

    if (progress) {
        progress.textContent = 'Aguarde…';
    }
}

function getModuleCollection() {
    if (typeof window.MODULES_DATA === 'undefined') {
        return [];
    }

    return Array.isArray(window.MODULES_DATA)
        ? window.MODULES_DATA
        : Object.values(window.MODULES_DATA);
}

function normalizeLookup(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function shuffleList(items) {
    return [...items].sort(() => Math.random() - 0.5);
}

function getQuizLibrary() {
    return window.QUIZ_LIBRARY || {
        moduleBanks: {},
        topicMap: {},
        collections: {},
        relatedModules: {},
        examBlueprints: {},
    };
}

function getModuleBySlug(slug) {
    const lookup = normalizeLookup(slug);

    return getModuleCollection().find(
        (module) =>
            normalizeLookup(module.slug) === lookup ||
            normalizeLookup(module.quizTopic) === lookup ||
            normalizeLookup(module.title) === lookup,
    );
}

function resolveTopicSlug(topic) {
    const library = getQuizLibrary();
    const lookup = normalizeLookup(topic);

    return library.topicMap?.[lookup] || getModuleBySlug(topic)?.slug || null;
}

function getModuleBank(slug) {
    const library = getQuizLibrary();
    const bank = library.moduleBanks?.[slug];

    if (Array.isArray(bank) && bank.length) {
        return bank;
    }

    const module = getModuleBySlug(slug);
    return Array.isArray(module?.fallbackQuiz) ? module.fallbackQuiz : [];
}

function getRelatedSlugs(slug) {
    const library = getQuizLibrary();
    return Array.isArray(library.relatedModules?.[slug]) ? library.relatedModules[slug] : [];
}

function getAllLocalQuestions() {
    return getModuleCollection().flatMap((module) => getModuleBank(module.slug));
}

function normalizeQuestion(question, { moduleSlug = '', moduleTitle = '', bankSource = 'local' } = {}) {
    if (!question || typeof question !== 'object') {
        return null;
    }

    const questionText = String(question.question || '').trim();
    const options = Array.isArray(question.options) ? question.options.map((option) => String(option)) : [];
    const correctAnswer = Number(question.correctAnswer);
    const explanation = String(question.explanation || '').trim();

    if (!questionText || options.length < 2 || !Number.isInteger(correctAnswer)) {
        return null;
    }

    const boundedAnswer = Math.min(Math.max(correctAnswer, 0), options.length - 1);

    return {
        ...question,
        question: questionText,
        options,
        correctAnswer: boundedAnswer,
        explanation,
        difficulty: String(question.difficulty || 'medio').trim(),
        moduleSlug: String(question.moduleSlug || moduleSlug || '').trim(),
        moduleTitle: String(question.moduleTitle || moduleTitle || '').trim(),
        topic: String(question.topic || moduleTitle || moduleSlug || '').trim(),
        bankSource: String(question.bankSource || bankSource || 'local').trim(),
    };
}

function normalizeQuestionList(source, meta = {}) {
    const list = Array.isArray(source)
        ? source
        : Array.isArray(source?.questions)
            ? source.questions
            : Array.isArray(source?.items)
                ? source.items
                : [];

    return list.map((question) => normalizeQuestion(question, meta)).filter(Boolean);
}

function getQuestionKey(question) {
    return [
        normalizeLookup(question.question),
        normalizeLookup(question.options?.join('|')),
        normalizeLookup(question.moduleSlug),
        normalizeLookup(question.correctAnswer),
    ].join('::');
}

function dedupeQuestions(questions, usedKeys = new Set()) {
    const seen = new Set(usedKeys);
    const result = [];

    questions.forEach((question) => {
        const key = getQuestionKey(question);
        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        result.push(question);
    });

    return result;
}

function pickQuestionsFromPool(pool, count, usedKeys = new Set()) {
    if (!Array.isArray(pool) || !count) {
        return [];
    }

    const shuffled = shuffleList(normalizeQuestionList(pool));
    const selected = [];
    const seen = new Set(usedKeys);

    shuffled.forEach((question) => {
        if (selected.length >= count) {
            return;
        }

        const key = getQuestionKey(question);
        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        selected.push(question);
    });

    return selected;
}

function mergeQuestionPools(slugs) {
    const library = getQuizLibrary();
    const pool = [];

    slugs.forEach((slug) => {
        pool.push(...getModuleBank(slug));
    });

    if (!pool.length && Array.isArray(library.collections?.full)) {
        library.collections.full.forEach((slug) => pool.push(...getModuleBank(slug)));
    }

    return dedupeQuestions(normalizeQuestionList(pool));
}

function buildTopicQuestionPool(topic, { includeRelated = true } = {}) {
    const slug = resolveTopicSlug(topic);
    const baseSlugs = slug ? [slug] : [];

    if (includeRelated && slug) {
        baseSlugs.push(...getRelatedSlugs(slug));
    }

    const pool = baseSlugs.length ? mergeQuestionPools(baseSlugs) : getAllLocalQuestions();
    return { slug, pool };
}

function buildLocalQuizSet(topic, count, usedQuestions = []) {
    const slug = resolveTopicSlug(topic);
    const primaryPool = slug ? mergeQuestionPools([slug]) : getAllLocalQuestions();
    const usedKeys = new Set(usedQuestions.map((question) => getQuestionKey(normalizeQuestion(question) || question)));
    const selected = pickQuestionsFromPool(primaryPool, count, usedKeys);

    if (selected.length >= count) {
        return { slug, questions: selected.slice(0, count), source: 'local', bankMode: 'topic' };
    }

    const relatedPool = slug ? mergeQuestionPools(getRelatedSlugs(slug)) : [];
    const relatedSelected = pickQuestionsFromPool(
        relatedPool.filter((question) => !usedKeys.has(getQuestionKey(question)) && !selected.some((item) => getQuestionKey(item) === getQuestionKey(question))),
        count - selected.length,
        new Set([...usedKeys, ...selected.map((question) => getQuestionKey(question))]),
    );

    const combinedAfterRelated = dedupeQuestions([...selected, ...relatedSelected], usedKeys);

    if (combinedAfterRelated.length >= count) {
        return { slug, questions: combinedAfterRelated.slice(0, count), source: 'local', bankMode: 'topic+related' };
    }

    const fallbackPool = mergeQuestionPools(getQuizLibrary().collections?.full || []);
    const fallbackSelected = pickQuestionsFromPool(
        fallbackPool.filter(
            (question) =>
                !usedKeys.has(getQuestionKey(question)) &&
                !combinedAfterRelated.some((item) => getQuestionKey(item) === getQuestionKey(question)),
        ),
        count - combinedAfterRelated.length,
        new Set(combinedAfterRelated.map((question) => getQuestionKey(question))),
    );

    const questions = dedupeQuestions([...combinedAfterRelated, ...fallbackSelected], usedKeys).slice(0, count);
    return { slug, questions, source: 'local', bankMode: 'full' };
}

function buildLocalSimuladoSet(total, usedQuestions = []) {
    const library = getQuizLibrary();
    const blueprint = Array.isArray(library.examBlueprints?.default) && library.examBlueprints.default.length
        ? library.examBlueprints.default
        : getModuleCollection().map((module) => ({ slug: module.slug, count: 1 }));
    const usedKeys = new Set(usedQuestions.map((question) => getQuestionKey(normalizeQuestion(question) || question)));
    const selected = [];

    blueprint.forEach((entry) => {
        const pool = mergeQuestionPools([entry.slug, ...(getRelatedSlugs(entry.slug) || [])]);
        const picked = pickQuestionsFromPool(
            pool.filter((question) => !usedKeys.has(getQuestionKey(question)) && !selected.some((item) => getQuestionKey(item) === getQuestionKey(question))),
            entry.count,
            new Set([...usedKeys, ...selected.map((question) => getQuestionKey(question))]),
        );

        selected.push(...picked);
    });

    if (selected.length < total) {
        const fullPool = mergeQuestionPools(library.collections?.full || []);
        const picked = pickQuestionsFromPool(
            fullPool.filter((question) => !usedKeys.has(getQuestionKey(question)) && !selected.some((item) => getQuestionKey(item) === getQuestionKey(question))),
            total - selected.length,
            new Set([...usedKeys, ...selected.map((question) => getQuestionKey(question))]),
        );

        selected.push(...picked);
    }

    return dedupeQuestions(selected, usedKeys).slice(0, total);
}

function getStaticQuestions(topic, count) {
    const requested = Math.max(1, Number(count) || 3);
    const { questions } = buildLocalQuizSet(topic, requested);
    return questions.length ? questions : null;
}

function getScoreText(score, total) {
    const percentage = (score / total) * 100;

    if (percentage === 100) return 'Perfeito. Você acertou tudo.';
    if (percentage >= 80) return 'Excelente desempenho. Você está muito bem preparado.';
    if (percentage >= 60) return 'Bom trabalho. Vale revisar os pontos em que houve dúvida.';
    if (percentage >= 40) return 'Revise os módulos e tente novamente.';
    return 'Recomendamos voltar ao conteúdo antes de continuar.';
}

async function requestQuizGeneration(payload, feature) {
    if (window.AppAPI?.apiRequest) {
        return window.AppAPI.apiRequest('/api/generate-quiz', {
            method: 'POST',
            body: payload,
            feature,
        });
    }

    const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (data.error) {
        throw new Error(data.error);
    }

    return data;
}

window.generateQuizForTopic = async function (topic, count) {
    window.currentTopic = topic;
    const numQuestions = count || 3;
    const localSet = buildLocalQuizSet(topic, numQuestions);

    window.navigateTo('page-quiz');

    const quizContainer = document.getElementById('quiz-container');
    const quizResult = document.getElementById('quiz-result');

    quizResult.style.display = 'none';
    quizContainer.style.display = 'block';

    document.getElementById('options-container').innerHTML = '';
    document.getElementById('explanation-box').style.display = 'none';
    document.getElementById('btn-next-quiz').style.display = 'none';

    showQuizLoading('question-text', 'quiz-progress', `Preparando questões sobre "${topic}"…`);

    if (localSet.questions.length >= numQuestions) {
        window.currentQuizQuestions = localSet.questions.slice(0, numQuestions);
        window.currentQ = 0;
        window.score = 0;
        window.currentFlowSourceLabel = 'Banco local';
        loadDynamicQuestion();
        return;
    }

    try {
        const data = await requestQuizGeneration({ topic, count: numQuestions }, 'generate-quiz');
        const remoteQuestions = normalizeQuestionList(data, {
            moduleSlug: localSet.slug || resolveTopicSlug(topic) || '',
            moduleTitle: topic,
            bankSource: 'ai',
        });
        const mergedQuestions = dedupeQuestions([...localSet.questions, ...remoteQuestions]);
        const paddedQuestions = buildLocalQuizSet(topic, numQuestions, mergedQuestions).questions;

        window.currentQuizQuestions = dedupeQuestions([...mergedQuestions, ...paddedQuestions])
            .slice(0, numQuestions);
        window.currentQ = 0;
        window.score = 0;
        window.currentFlowSourceLabel =
            remoteQuestions.length && localSet.questions.length
                ? 'Banco local + IA'
                : remoteQuestions.length
                    ? 'Banco da IA'
                    : 'Banco local';
        loadDynamicQuestion();
    } catch (error) {
        console.error('[AI] quiz generation failed', error);
        const fallback = localSet.questions.length
            ? localSet.questions
            : getStaticQuestions(topic, numQuestions);

        if (fallback) {
            window.currentQuizQuestions = fallback;
            window.currentQ = 0;
            window.score = 0;
            window.currentFlowSourceLabel = 'Banco local';
            loadDynamicQuestion();
            return;
        }

        showInlineError('question-text', 'Não foi possível gerar o quiz agora.', () =>
            window.generateQuizForTopic(topic, numQuestions),
        );
        document.getElementById('quiz-progress').textContent = 'Erro';
    }
};

function loadDynamicQuestion() {
    const question = window.currentQuizQuestions[window.currentQ];
    if (!question) return;

    const progressPrefix = window.currentFlowSourceLabel ? `${window.currentFlowSourceLabel} • ` : '';
    document.getElementById('quiz-progress').textContent =
        `${progressPrefix}Questão ${window.currentQ + 1} de ${window.currentQuizQuestions.length}`;
    document.getElementById('question-text').textContent = question.question;

    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    document.getElementById('explanation-box').style.display = 'none';
    document.getElementById('btn-next-quiz').style.display = 'none';

    question.options.forEach((option, index) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'quiz-option';
        optionElement.textContent = option;
        optionElement.onclick = () =>
            selectDynamicOption(optionElement, index, question.correctAnswer, question.explanation);
        optionsContainer.appendChild(optionElement);
    });

    renderMathIfPossible(document.getElementById('quiz-container'));
}

function selectDynamicOption(selectedElement, selectedIndex, correctIndex, explanation) {
    document
        .getElementById('options-container')
        .querySelectorAll('.quiz-option')
        .forEach((option) => option.classList.add('disabled'));

    if (selectedIndex === correctIndex) {
        selectedElement.classList.add('correct');
        window.score += 1;
    } else {
        selectedElement.classList.add('wrong');
        document
            .getElementById('options-container')
            .querySelectorAll('.quiz-option')
            [correctIndex]?.classList.add('correct');
    }

    document.getElementById('explanation-text').textContent = explanation;
    document.getElementById('explanation-box').style.display = 'block';
    renderMathIfPossible(document.getElementById('quiz-container'));

    const nextButton = document.getElementById('btn-next-quiz');
    nextButton.style.display = 'block';
    nextButton.onclick = () => {
        window.currentQ += 1;

        if (window.currentQ < window.currentQuizQuestions.length) {
            loadDynamicQuestion();
            return;
        }

        showDynamicResult();
    };
}

function showDynamicResult() {
    document.getElementById('quiz-container').style.display = 'none';

    const result = document.getElementById('quiz-result');
    result.style.display = 'block';

    const total = window.currentQuizQuestions.length;
    document.getElementById('score-number').textContent = `${window.score}/${total}`;
    document.getElementById('score-text').textContent = getScoreText(window.score, total);

    const completed = Store.load('completedQuizzes') || [];
    if (!completed.includes(window.currentTopic)) {
        completed.push(window.currentTopic);
        Store.save('completedQuizzes', completed);

        if (window.updateProgress) {
            window.updateProgress();
        }
    }
}

window.generateMoreQuestions = async function (count) {
    const buttons = document.querySelectorAll('.btn-more-questions');
    const originals = [];
    const requested = Math.max(1, Number(count) || 5);
    const resultScreen = document.getElementById('quiz-result');
    const quizScreen = document.getElementById('quiz-container');

    buttons.forEach((button, index) => {
        originals[index] = button.innerHTML;
        button.innerHTML = '<div class="loader" style="margin:0 auto;"></div>';
        button.disabled = true;
    });

    const localSet = buildLocalQuizSet(window.currentTopic, requested, window.currentQuizQuestions);
    const localQuestions = localSet.questions.length
        ? dedupeQuestions([...window.currentQuizQuestions, ...localSet.questions])
        : window.currentQuizQuestions;

    if (localSet.questions.length) {
        window.currentQuizQuestions = localQuestions;

        if (resultScreen && resultScreen.style.display === 'block') {
            resultScreen.style.display = 'none';
            quizScreen.style.display = 'block';
            window.currentFlowSourceLabel = 'Banco local expandido';
            loadDynamicQuestion();
        } else {
            const progress = document.getElementById('quiz-progress');
            if (progress) {
                progress.textContent = `${window.currentFlowSourceLabel ? `${window.currentFlowSourceLabel} • ` : ''}Questão ${window.currentQ + 1} de ${window.currentQuizQuestions.length}`;
            }
        }
    }

    const remaining = Math.max(0, requested - localSet.questions.length);
    if (!remaining) {
        buttons.forEach((button, index) => {
            button.innerHTML = originals[index];
            button.disabled = false;
        });
        return;
    }

    try {
        const data = await requestQuizGeneration(
            { topic: window.currentTopic, count: remaining, difficulty: 'variado' },
            'generate-more-questions',
        );
        const remoteQuestions = normalizeQuestionList(data, {
            moduleSlug: resolveTopicSlug(window.currentTopic) || '',
            moduleTitle: window.currentTopic,
            bankSource: 'ai',
        });
        const mergedQuestions = dedupeQuestions([...window.currentQuizQuestions, ...remoteQuestions]);
        const padding = buildLocalQuizSet(window.currentTopic, remaining, mergedQuestions).questions;
        window.currentQuizQuestions = dedupeQuestions([...mergedQuestions, ...padding]);

        window.currentFlowSourceLabel =
            localSet.questions.length || remoteQuestions.length
                ? 'Banco local + IA'
                : window.currentFlowSourceLabel;

        if (resultScreen && resultScreen.style.display === 'block') {
            resultScreen.style.display = 'none';
            quizScreen.style.display = 'block';
            loadDynamicQuestion();
        } else {
            const progress = document.getElementById('quiz-progress');
            if (progress) {
                progress.textContent = `${window.currentFlowSourceLabel ? `${window.currentFlowSourceLabel} • ` : ''}Questão ${window.currentQ + 1} de ${window.currentQuizQuestions.length}`;
            }
        }
    } catch (error) {
        console.error('[AI] more quiz questions failed', error);
        if (!localSet.questions.length) {
            const firstButton = buttons[0];
            if (firstButton) {
                firstButton.innerHTML = 'Erro ao gerar novas questões';
                firstButton.style.color = 'var(--red-ink)';
                setTimeout(() => {
                    firstButton.innerHTML = originals[0];
                    firstButton.style.color = '';
                }, 3000);
            }
        }
    } finally {
        buttons.forEach((button, index) => {
            button.innerHTML = originals[index];
            button.disabled = false;
        });
    }
};

window.startSimulado = async function () {
    window.location.assign('/app/provas?examId=ufba-ctia03-lista-1&screen=exam');
    return;

    document.getElementById('simulado-options-container').innerHTML = '';
    document.getElementById('simulado-explanation-box').style.display = 'none';
    document.getElementById('btn-next-simulado').style.display = 'none';

    showQuizLoading('simulado-question-text', 'simulado-progress', 'Montando simulado local…');

    const topic =
        'Conjuntos, Conjuntos Numéricos, Relação de Ordem, Intervalos Numéricos, Propriedades da Álgebra, Produtos Notáveis e Fatoração';

    const localQuestions = buildLocalSimuladoSet(10);

    if (localQuestions.length >= 10) {
        window.currentQuizQuestions = localQuestions.slice(0, 10);
        window.currentQ = 0;
        window.score = 0;
        window.simuladoResults = [];
        window.currentFlowSourceLabel = 'Simulado local';
        loadSimuladoQuestion();
        return;
    }

    try {
        const data = await requestQuizGeneration(
            { topic, count: 10, difficulty: 'variado' },
            'generate-simulado',
        );
        const remoteQuestions = normalizeQuestionList(data, {
            moduleSlug: '',
            moduleTitle: 'Simulado',
            bankSource: 'ai',
        });
        const mergedQuestions = dedupeQuestions([...localQuestions, ...remoteQuestions]);
        const paddedQuestions = buildLocalSimuladoSet(10, mergedQuestions);

        window.currentQuizQuestions = dedupeQuestions([...mergedQuestions, ...paddedQuestions]).slice(0, 10);
        window.currentQ = 0;
        window.score = 0;
        window.simuladoResults = [];
        window.currentFlowSourceLabel =
            remoteQuestions.length && localQuestions.length
                ? 'Simulado local + IA'
                : remoteQuestions.length
                    ? 'Simulado da IA'
                    : 'Simulado local';
        loadSimuladoQuestion();
    } catch (error) {
        console.error('[AI] simulado generation failed', error);
        const fallback = localQuestions.length ? localQuestions : buildSimuladoFallback(10);

        if (fallback.length) {
            window.currentQuizQuestions = fallback;
            window.currentQ = 0;
            window.score = 0;
            window.simuladoResults = [];
            window.currentFlowSourceLabel = 'Simulado local';
            progress.textContent = 'Usando banco local de questões';
            loadSimuladoQuestion();
            return;
        }

        showInlineError('simulado-question-text', 'Não foi possível gerar o simulado.', () => window.startSimulado());
        progress.textContent = 'Erro';
        intro.style.display = 'block';
        container.style.display = 'none';
    }
};

function buildSimuladoFallback(total) {
    return buildLocalSimuladoSet(total);
}

function loadSimuladoQuestion() {
    const question = window.currentQuizQuestions[window.currentQ];
    if (!question) return;

    const progressPrefix = window.currentFlowSourceLabel ? `${window.currentFlowSourceLabel} • ` : '';
    document.getElementById('simulado-progress').textContent =
        `${progressPrefix}Questão ${window.currentQ + 1} de ${window.currentQuizQuestions.length}`;
    document.getElementById('simulado-question-text').textContent = question.question;

    const optionsContainer = document.getElementById('simulado-options-container');
    optionsContainer.innerHTML = '';
    document.getElementById('simulado-explanation-box').style.display = 'none';
    document.getElementById('btn-next-simulado').style.display = 'none';

    question.options.forEach((option, index) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'quiz-option';
        optionElement.textContent = option;
        optionElement.onclick = () =>
            selectSimuladoOption(optionElement, index, question.correctAnswer, question.explanation, question.difficulty);
        optionsContainer.appendChild(optionElement);
    });

    renderMathIfPossible(document.getElementById('simulado-container'));
}

function selectSimuladoOption(selectedElement, selectedIndex, correctIndex, explanation, difficulty) {
    document
        .getElementById('simulado-options-container')
        .querySelectorAll('.quiz-option')
        .forEach((option) => option.classList.add('disabled'));

    const isCorrect = selectedIndex === correctIndex;

    window.simuladoResults.push({
        question: window.currentQuizQuestions[window.currentQ].question,
        isCorrect,
        difficulty,
        selectedOption: window.currentQuizQuestions[window.currentQ].options[selectedIndex],
        correctOption: window.currentQuizQuestions[window.currentQ].options[correctIndex],
        explanation,
        moduleTitle: window.currentQuizQuestions[window.currentQ].moduleTitle || '',
    });

    if (isCorrect) {
        selectedElement.classList.add('correct');
        window.score += 1;
    } else {
        selectedElement.classList.add('wrong');
        document
            .getElementById('simulado-options-container')
            .querySelectorAll('.quiz-option')
            [correctIndex]?.classList.add('correct');
    }

    document.getElementById('simulado-explanation-text').textContent = explanation;
    document.getElementById('simulado-explanation-box').style.display = 'block';
    renderMathIfPossible(document.getElementById('simulado-container'));

    const nextButton = document.getElementById('btn-next-simulado');
    nextButton.style.display = 'block';
    nextButton.onclick = () => {
        window.currentQ += 1;

        if (window.currentQ < window.currentQuizQuestions.length) {
            loadSimuladoQuestion();
            return;
        }

        showSimuladoResult();
    };
}

function showSimuladoResult() {
    document.getElementById('simulado-container').style.display = 'none';

    const result = document.getElementById('simulado-result');
    result.style.display = 'block';

    const total = window.currentQuizQuestions.length;
    document.getElementById('simulado-score-number').textContent = `${window.score}/${total}`;
    document.getElementById('simulado-score-text').textContent = getScoreText(window.score, total);

    const feedbackContainer = document.getElementById('simulado-feedback');
    feedbackContainer.innerHTML = '<h4 class="section-subtitle">Revisão das questões</h4>';

    window.simuladoResults.forEach((item, index) => {
        const block = document.createElement('div');
        block.className = `box ${item.isCorrect ? 'box--tip' : 'box--mistake'} simulado-review-box`;
        block.innerHTML = `
            <h5>Questão ${index + 1} ${item.isCorrect ? '• Acertou' : '• Errou'}</h5>
            ${item.moduleTitle ? `<p><strong>Módulo:</strong> ${escapeHtml(item.moduleTitle)}</p>` : ''}
            <p><strong>Enunciado:</strong> ${escapeHtml(item.question)}</p>
            <p><strong>Sua resposta:</strong> ${escapeHtml(item.selectedOption)}</p>
            ${!item.isCorrect ? `<p><strong>Correta:</strong> ${escapeHtml(item.correctOption)}</p>` : ''}
            <p><strong>Explicação:</strong> ${escapeHtml(item.explanation)}</p>
        `;
        feedbackContainer.appendChild(block);
    });

    renderMathIfPossible(result);
    Store.save('lastSimuladoScore', { score: window.score, total, date: new Date().toISOString() });
}
