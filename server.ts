import 'dotenv/config';
import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
if (!apiKey) {
    console.error('❌ GEMINI_API_KEY não encontrada. Crie um arquivo .env com GEMINI_API_KEY=sua_chave');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

// Modelos disponíveis (nomes corretos da API Gemini)
const MODELS = {
    flash:   'gemini-2.0-flash',
    pro:     'gemini-1.5-pro',
    lite:    'gemini-2.0-flash-lite',
};

app.post('/api/generate-quiz', async (req, res) => {
    try {
        const { topic, count = 5, difficulty = 'médio' } = req.body;

        if (!topic || typeof topic !== 'string') {
            return res.status(400).json({ error: 'Tópico inválido ou não fornecido.' });
        }

        const response = await ai.models.generateContent({
            model: MODELS.flash,
            contents: `Você é um professor de matemática básica. Gere um quiz de múltipla escolha sobre o tópico: "${topic}". Nível de dificuldade: ${difficulty}. Gere exatamente ${count} questões. Cada questão deve ter 4 opções de resposta (A, B, C, D). O índice da resposta correta é baseado em 0 (0=A, 1=B, 2=C, 3=D). Retorne apenas JSON válido no formato especificado.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question:      { type: Type.STRING },
                            options:       { type: Type.ARRAY, items: { type: Type.STRING } },
                            correctAnswer: { type: Type.INTEGER },
                            explanation:   { type: Type.STRING },
                            difficulty:    { type: Type.STRING }
                        },
                        required: ["question", "options", "correctAnswer", "explanation", "difficulty"]
                    }
                }
            }
        });

        const data = JSON.parse(response.text);

        if (!Array.isArray(data) || data.length === 0) {
            throw new Error("Formato de resposta inválido da IA.");
        }

        res.json(data);
    } catch (error) {
        console.error("Erro ao gerar quiz:", error);
        res.status(500).json({ error: 'Falha ao gerar o quiz. Por favor, tente novamente.' });
    }
});

app.post('/api/explain-topic', async (req, res) => {
    try {
        const { topic } = req.body;

        if (!topic || typeof topic !== 'string') {
            return res.status(400).json({ error: 'Tópico inválido ou não fornecido.' });
        }

        const response = await ai.models.generateContent({
            model: MODELS.flash,
            contents: `Você é um professor de matemática simpático. Explique de forma simples e direta o tópico: "${topic}". Use linguagem clara, como se estivesse explicando para um aluno que está revisando para uma prova. Inclua pelo menos um exemplo prático. Use HTML simples (<b>, <i>, <br>, <ul>, <li>, <p>) para formatar. Não use markdown. Seja conciso mas completo.`,
        });
        res.json({ explanation: response.text });
    } catch (error) {
        console.error("Erro ao gerar explicação:", error);
        res.status(500).json({ error: 'Falha ao gerar explicação. Por favor, tente novamente.' });
    }
});

app.post('/api/generate-review', async (req, res) => {
    try {
        const { topic } = req.body;

        if (!topic || typeof topic !== 'string') {
            return res.status(400).json({ error: 'Tópico inválido ou não fornecido.' });
        }

        const response = await ai.models.generateContent({
            model: MODELS.flash,
            contents: `Você é um professor de matemática. Gere uma revisão rápida de véspera de prova sobre: "${topic}". Inclua: 1) Resumo dos pontos mais importantes, 2) Fórmulas e definições essenciais, 3) Erros mais comuns que os alunos cometem, 4) Dicas práticas para a prova. Use HTML simples (<b>, <i>, <br>, <ul>, <li>, <h3>, <h4>) para formatar. Não use markdown. Seja objetivo e estratégico.`,
        });
        res.json({ review: response.text });
    } catch (error) {
        console.error("Erro ao gerar revisão:", error);
        res.status(500).json({ error: 'Falha ao gerar revisão. Por favor, tente novamente.' });
    }
});

app.post('/api/generate-exercises', async (req, res) => {
    try {
        const { topic } = req.body;

        if (!topic || typeof topic !== 'string') {
            return res.status(400).json({ error: 'Tópico inválido ou não fornecido.' });
        }

        const response = await ai.models.generateContent({
            model: MODELS.flash,
            contents: `Você é um professor de matemática. Gere 3 exercícios práticos (dissertativos, não múltipla escolha) sobre o tópico: "${topic}". Para cada exercício: forneça o enunciado claro e a resolução passo a passo dentro de <details><summary>Ver Resolução</summary>...</details>. Use HTML simples (<b>, <i>, <br>, <ul>, <li>, <details>, <summary>, <p>) para formatar. Numere os exercícios. Não use markdown.`,
        });
        res.json({ exercises: response.text });
    } catch (error) {
        console.error("Erro ao gerar exercícios:", error);
        res.status(500).json({ error: 'Falha ao gerar exercícios. Por favor, tente novamente.' });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { history, message, model = 'flash' } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Mensagem inválida.' });
        }

        // Aceita tanto o nome curto ('flash', 'pro', 'lite') quanto o nome completo
        const selectedModel = MODELS[model as keyof typeof MODELS] || MODELS.flash;

        const chat = ai.chats.create({
            model: selectedModel,
            config: {
                systemInstruction: `Você é um tutor de matemática básica, paciente, amigável e encorajador.
Seu objetivo é ajudar o aluno a entender conceitos matemáticos de forma clara e simples.
Quando resolver exercícios, mostre o passo a passo.
Quando o aluno errar, corrija de forma gentil e explique onde errou.
Use linguagem acessível, evite termos muito técnicos sem explicação.
Tópicos que você domina: conjuntos numéricos, intervalos, álgebra, produtos notáveis, fatoração, potenciação, radiciação, reta real.`,
            },
            history: history || []
        });

        const response = await chat.sendMessage({ message });
        res.json({ text: response.text });
    } catch (error) {
        console.error("Erro no chat:", error);
        res.status(500).json({ error: 'Falha ao processar mensagem.' });
    }
});

app.use(express.static(__dirname));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
    console.log(`🤖 Gemini AI conectado (modelo padrão: ${MODELS.flash})`);
});
