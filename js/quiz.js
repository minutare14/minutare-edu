window.currentQuizQuestions = [];
window.currentQ = 0;
window.score = 0;
window.currentTopic = '';
window.simuladoResults = [];

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

function getStaticQuestions(topic, count) {
    const module = getModuleCollection().find((item) => item.quizTopic === topic || item.title === topic);
    if (!module || !module.fallbackQuiz?.length) {
        return null;
    }

    const shuffled = [...module.fallbackQuiz].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count || 3, shuffled.length));
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

    window.navigateTo('page-quiz');

    const quizContainer = document.getElementById('quiz-container');
    const quizResult = document.getElementById('quiz-result');

    quizResult.style.display = 'none';
    quizContainer.style.display = 'block';

    document.getElementById('options-container').innerHTML = '';
    document.getElementById('explanation-box').style.display = 'none';
    document.getElementById('btn-next-quiz').style.display = 'none';

    showQuizLoading('question-text', 'quiz-progress', `Gerando questões sobre "${topic}"…`);

    try {
        const data = await requestQuizGeneration({ topic, count: numQuestions }, 'generate-quiz');
        window.currentQuizQuestions = data;
        window.currentQ = 0;
        window.score = 0;
        loadDynamicQuestion();
    } catch (error) {
        console.error('[AI] quiz generation failed', error);
        const fallback = getStaticQuestions(topic, numQuestions);

        if (fallback) {
            window.currentQuizQuestions = fallback;
            window.currentQ = 0;
            window.score = 0;
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

    document.getElementById('quiz-progress').textContent =
        `Questão ${window.currentQ + 1} de ${window.currentQuizQuestions.length}`;
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

    buttons.forEach((button, index) => {
        originals[index] = button.innerHTML;
        button.innerHTML = '<div class="loader" style="margin:0 auto;"></div>';
        button.disabled = true;
    });

    try {
        const data = await requestQuizGeneration(
            { topic: window.currentTopic, count, difficulty: 'variado' },
            'generate-more-questions',
        );
        window.currentQuizQuestions = window.currentQuizQuestions.concat(data);

        const resultScreen = document.getElementById('quiz-result');
        if (resultScreen && resultScreen.style.display === 'block') {
            resultScreen.style.display = 'none';
            document.getElementById('quiz-container').style.display = 'block';
            loadDynamicQuestion();
        } else {
            const progress = document.getElementById('quiz-progress');
            if (progress) {
                progress.textContent = `Questão ${window.currentQ + 1} de ${window.currentQuizQuestions.length}`;
            }
        }
    } catch (error) {
        console.error('[AI] more quiz questions failed', error);
        const firstButton = buttons[0];
        if (firstButton) {
            firstButton.innerHTML = 'Erro ao gerar novas questões';
            firstButton.style.color = 'var(--red-ink)';
            setTimeout(() => {
                firstButton.innerHTML = originals[0];
                firstButton.style.color = '';
            }, 3000);
        }
    } finally {
        buttons.forEach((button, index) => {
            button.innerHTML = originals[index];
            button.disabled = false;
        });
    }
};

window.startSimulado = async function () {
    const intro = document.getElementById('simulado-intro');
    const container = document.getElementById('simulado-container');
    const result = document.getElementById('simulado-result');
    const progress = document.getElementById('simulado-progress');

    intro.style.display = 'none';
    result.style.display = 'none';
    container.style.display = 'block';

    document.getElementById('simulado-options-container').innerHTML = '';
    document.getElementById('simulado-explanation-box').style.display = 'none';
    document.getElementById('btn-next-simulado').style.display = 'none';

    showQuizLoading('simulado-question-text', 'simulado-progress', 'Gerando simulado completo…');

    const topic =
        'Conjuntos, Conjuntos Numéricos, Relação de Ordem, Intervalos Numéricos, Propriedades da Álgebra, Produtos Notáveis e Fatoração';

    try {
        const data = await requestQuizGeneration(
            { topic, count: 10, difficulty: 'variado' },
            'generate-simulado',
        );
        window.currentQuizQuestions = data;
        window.currentQ = 0;
        window.score = 0;
        window.simuladoResults = [];
        loadSimuladoQuestion();
    } catch (error) {
        console.error('[AI] simulado generation failed', error);
        const fallback = buildSimuladoFallback(10);

        if (fallback.length) {
            window.currentQuizQuestions = fallback;
            window.currentQ = 0;
            window.score = 0;
            window.simuladoResults = [];
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
    const allQuestions = [];

    getModuleCollection().forEach((module) => {
        if (module.fallbackQuiz) {
            allQuestions.push(...module.fallbackQuiz);
        }
    });

    return allQuestions.sort(() => Math.random() - 0.5).slice(0, total);
}

function loadSimuladoQuestion() {
    const question = window.currentQuizQuestions[window.currentQ];
    if (!question) return;

    document.getElementById('simulado-progress').textContent =
        `Questão ${window.currentQ + 1} de ${window.currentQuizQuestions.length}`;
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
