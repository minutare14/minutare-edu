window.currentQuizQuestions = [];
window.currentQ = 0;
window.score = 0;
window.currentTopic = '';
window.isSimulado = false;
window.simuladoResults = [];

document.addEventListener('DOMContentLoaded', () => {
    // Apenas inicializa eventos
});

window.generateQuizForTopic = async function(topic) {
    window.currentTopic = topic;
    window.isSimulado = false;
    window.navigateTo('page-quiz');
    
    const quizContainer = document.getElementById('quiz-container');
    const quizResult = document.getElementById('quiz-result');
    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const explanationBox = document.getElementById('explanation-box');
    const btnNextQuiz = document.getElementById('btn-next-quiz');
    const quizProgress = document.getElementById('quiz-progress');

    quizResult.style.display = 'none';
    quizContainer.style.display = 'block';
    
    questionText.innerHTML = '<div style="display:flex; align-items:center; gap:8px;"><div class="loader"></div> Gerando questões com Gemini...</div>';
    optionsContainer.innerHTML = '';
    explanationBox.style.display = 'none';
    btnNextQuiz.style.display = 'none';
    quizProgress.textContent = `Preparando quiz sobre ${topic}...`;

    try {
        const res = await fetch('/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, count: 3 })
        });
        const data = await res.json();
        
        if(data.error) throw new Error(data.error);

        window.currentQuizQuestions = data;
        window.currentQ = 0;
        window.score = 0;
        
        loadDynamicQuestion();
    } catch (e) {
        questionText.innerHTML = '<p style="color:var(--red-ink);">Erro ao gerar quiz. Tente novamente.</p>';
        quizProgress.textContent = 'Erro';
    }
};

function loadDynamicQuestion() {
    const q = window.currentQuizQuestions[window.currentQ];
    document.getElementById('quiz-progress').textContent = `Questão ${window.currentQ + 1} de ${window.currentQuizQuestions.length}`;
    document.getElementById('question-text').textContent = q.question;
    
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    document.getElementById('explanation-box').style.display = 'none';
    document.getElementById('btn-next-quiz').style.display = 'none';

    q.options.forEach((opt, index) => {
        const div = document.createElement('div');
        div.className = 'quiz-option';
        div.textContent = opt;
        div.onclick = () => selectDynamicOption(div, index, q.correctAnswer, q.explanation);
        optionsContainer.appendChild(div);
    });
}

function selectDynamicOption(selectedDiv, selectedIndex, correctIndex, explanation) {
    const options = document.getElementById('options-container').querySelectorAll('.quiz-option');
    options.forEach(opt => opt.classList.add('disabled'));

    if (selectedIndex === correctIndex) {
        selectedDiv.classList.add('correct');
        window.score++;
    } else {
        selectedDiv.classList.add('wrong');
        options[correctIndex].classList.add('correct');
    }

    document.getElementById('explanation-text').textContent = explanation;
    document.getElementById('explanation-box').style.display = 'block';
    
    const btnNext = document.getElementById('btn-next-quiz');
    btnNext.style.display = 'block';
    btnNext.onclick = () => {
        window.currentQ++;
        if (window.currentQ < window.currentQuizQuestions.length) {
            loadDynamicQuestion();
        } else {
            showDynamicResult();
        }
    };
}

function showDynamicResult() {
    document.getElementById('quiz-container').style.display = 'none';
    const result = document.getElementById('quiz-result');
    result.style.display = 'block';
    document.getElementById('score-number').textContent = `${window.score}/${window.currentQuizQuestions.length}`;
    
    // Save progress
    let completedQuizzes = Store.load('completedQuizzes') || [];
    if (!completedQuizzes.includes(window.currentTopic)) {
        completedQuizzes.push(window.currentTopic);
        Store.save('completedQuizzes', completedQuizzes);
        if (window.updateProgress) window.updateProgress();
    }
}

// Lógica do Simulado
window.startSimulado = async function() {
    window.isSimulado = true;
    
    const intro = document.getElementById('simulado-intro');
    const container = document.getElementById('simulado-container');
    const result = document.getElementById('simulado-result');
    const questionText = document.getElementById('simulado-question-text');
    const optionsContainer = document.getElementById('simulado-options-container');
    const explanationBox = document.getElementById('simulado-explanation-box');
    const btnNext = document.getElementById('btn-next-simulado');
    const progress = document.getElementById('simulado-progress');

    intro.style.display = 'none';
    result.style.display = 'none';
    container.style.display = 'block';
    
    questionText.innerHTML = '<div style="display:flex; align-items:center; gap:8px;"><div class="loader"></div> Gerando simulado completo com Gemini...</div>';
    optionsContainer.innerHTML = '';
    explanationBox.style.display = 'none';
    btnNext.style.display = 'none';
    progress.textContent = `Preparando simulado...`;

    try {
        const res = await fetch('/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: 'Matemática Básica: Conjuntos, Intervalos, Álgebra, Potenciação, Radiciação, Reta Real', count: 10, difficulty: 'variado' })
        });
        const data = await res.json();
        
        if(data.error) throw new Error(data.error);

        window.currentQuizQuestions = data;
        window.currentQ = 0;
        window.score = 0;
        window.simuladoResults = [];
        
        loadSimuladoQuestion();
    } catch (e) {
        questionText.innerHTML = '<p style="color:var(--red-ink);">Erro ao gerar simulado. Tente novamente.</p>';
        progress.textContent = 'Erro';
        intro.style.display = 'block';
        container.style.display = 'none';
    }
};

function loadSimuladoQuestion() {
    const q = window.currentQuizQuestions[window.currentQ];
    document.getElementById('simulado-progress').textContent = `Questão ${window.currentQ + 1} de ${window.currentQuizQuestions.length}`;
    document.getElementById('simulado-question-text').textContent = q.question;
    
    const optionsContainer = document.getElementById('simulado-options-container');
    optionsContainer.innerHTML = '';
    document.getElementById('simulado-explanation-box').style.display = 'none';
    document.getElementById('btn-next-simulado').style.display = 'none';

    q.options.forEach((opt, index) => {
        const div = document.createElement('div');
        div.className = 'quiz-option';
        div.textContent = opt;
        div.onclick = () => selectSimuladoOption(div, index, q.correctAnswer, q.explanation, q.difficulty);
        optionsContainer.appendChild(div);
    });
}

function selectSimuladoOption(selectedDiv, selectedIndex, correctIndex, explanation, difficulty) {
    const options = document.getElementById('simulado-options-container').querySelectorAll('.quiz-option');
    options.forEach(opt => opt.classList.add('disabled'));

    const isCorrect = selectedIndex === correctIndex;
    
    window.simuladoResults.push({
        question: window.currentQuizQuestions[window.currentQ].question,
        isCorrect: isCorrect,
        difficulty: difficulty,
        selectedOption: window.currentQuizQuestions[window.currentQ].options[selectedIndex],
        correctOption: window.currentQuizQuestions[window.currentQ].options[correctIndex],
        explanation: explanation
    });

    if (isCorrect) {
        selectedDiv.classList.add('correct');
        window.score++;
    } else {
        selectedDiv.classList.add('wrong');
        options[correctIndex].classList.add('correct');
    }

    document.getElementById('simulado-explanation-text').textContent = explanation;
    document.getElementById('simulado-explanation-box').style.display = 'block';
    
    const btnNext = document.getElementById('btn-next-simulado');
    btnNext.style.display = 'block';
    btnNext.onclick = () => {
        window.currentQ++;
        if (window.currentQ < window.currentQuizQuestions.length) {
            loadSimuladoQuestion();
        } else {
            showSimuladoResult();
        }
    };
}

function showSimuladoResult() {
    document.getElementById('simulado-container').style.display = 'none';
    const result = document.getElementById('simulado-result');
    result.style.display = 'block';
    
    const total = window.currentQuizQuestions.length;
    document.getElementById('simulado-score-number').textContent = `${window.score}/${total}`;
    
    const percentage = (window.score / total) * 100;
    let scoreText = '';
    if (percentage >= 80) scoreText = 'Excelente! Você está muito bem preparado.';
    else if (percentage >= 50) scoreText = 'Bom trabalho, mas ainda há espaço para melhorar.';
    else scoreText = 'Recomendamos revisar os módulos principais antes da prova.';
    
    document.getElementById('simulado-score-text').textContent = scoreText;

    const feedbackContainer = document.getElementById('simulado-feedback');
    feedbackContainer.innerHTML = '<h4 style="margin-bottom: 16px;">Análise de Desempenho:</h4>';
    
    const ul = document.createElement('ul');
    ul.style.paddingLeft = '20px';
    
    const errors = window.simuladoResults.filter(r => !r.isCorrect);
    if (errors.length === 0) {
        ul.innerHTML = '<li>Perfeito! Nenhum erro detectado.</li>';
    } else {
        ul.innerHTML = `<li>Você errou ${errors.length} questões. Foque em revisar os tópicos dessas questões.</li>`;
        // Poderíamos agrupar por dificuldade ou extrair o tópico da questão, mas como o Gemini não retorna o tópico exato por questão no schema atual, damos um feedback geral.
    }
    
    feedbackContainer.appendChild(ul);
    
    const breakdownContainer = document.createElement('div');
    breakdownContainer.style.marginTop = '32px';
    breakdownContainer.innerHTML = '<h4 style="margin-bottom: 16px;">Revisão das Questões:</h4>';
    
    window.simuladoResults.forEach((res, index) => {
        const qDiv = document.createElement('div');
        qDiv.className = 'box ' + (res.isCorrect ? 'box--tip' : 'box--mistake');
        qDiv.style.marginBottom = '16px';
        qDiv.style.textAlign = 'left';
        
        qDiv.innerHTML = `
            <h5 style="margin-top: 0; margin-bottom: 8px;">Questão ${index + 1} ${res.isCorrect ? '✅' : '❌'}</h5>
            <p style="margin-bottom: 8px; font-weight: 600;">${res.question}</p>
            <p style="margin-bottom: 4px; font-size: 14px;"><strong>Sua resposta:</strong> ${res.selectedOption}</p>
            ${!res.isCorrect ? `<p style="margin-bottom: 8px; font-size: 14px; color: var(--green-ink);"><strong>Resposta correta:</strong> ${res.correctOption}</p>` : ''}
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.1);">
                <p style="margin: 0; font-size: 14px;"><strong>Explicação:</strong> ${res.explanation}</p>
            </div>
        `;
        breakdownContainer.appendChild(qDiv);
    });
    
    feedbackContainer.appendChild(breakdownContainer);
    
    // Save progress
    Store.save('lastSimuladoScore', { score: window.score, total: total, date: new Date().toISOString() });
}

window.generateMoreQuestions = async function(count) {
    const btns = document.querySelectorAll('.btn-more-questions');
    btns.forEach(btn => {
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; gap:8px;"><div class="loader"></div> Gerando...</div>';
        btn.disabled = true;
    });

    try {
        const res = await fetch('/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: window.currentTopic, count: count, difficulty: 'médio' })
        });
        const data = await res.json();
        
        if(data.error) throw new Error(data.error);

        window.currentQuizQuestions = window.currentQuizQuestions.concat(data);
        
        const resultScreen = document.getElementById('quiz-result');
        if (resultScreen.style.display === 'block') {
            resultScreen.style.display = 'none';
            document.getElementById('quiz-container').style.display = 'block';
            loadDynamicQuestion();
        } else {
            document.getElementById('quiz-progress').textContent = `Questão ${window.currentQ + 1} de ${window.currentQuizQuestions.length}`;
        }
    } catch (e) {
        alert('Erro ao gerar mais questões.');
    } finally {
        btns.forEach(btn => {
            btn.innerHTML = btn.dataset.originalText;
            btn.disabled = false;
        });
    }
};
