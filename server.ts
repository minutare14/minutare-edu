import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });

app.post('/api/generate-quiz', async (req, res) => {
    try {
        const { topic, count = 5, difficulty = 'médio' } = req.body;
        
        if (!topic || typeof topic !== 'string') {
            return res.status(400).json({ error: 'Tópico inválido ou não fornecido.' });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Gere um quiz de múltipla escolha sobre o tópico de matemática: ${topic}. Nível de dificuldade: ${difficulty} (ajuste a complexidade das questões e opções de acordo). Gere ${count} questões.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question: { type: Type.STRING },
                            options: { type: Type.ARRAY, items: { type: Type.STRING } },
                            correctAnswer: { type: Type.INTEGER },
                            explanation: { type: Type.STRING },
                            difficulty: { type: Type.STRING }
                        },
                        required: ["question", "options", "correctAnswer", "explanation", "difficulty"]
                    }
                }
            }
        });

        const data = JSON.parse(response.text);
        
        // Validation
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error("Formato de resposta inválido da IA.");
        }

        res.json(data);
    } catch (error) {
        console.error("Erro ao gerar quiz:", error);
        res.status(500).json({ error: 'Falha ao gerar o quiz. Por favor, tente novamente mais tarde.' });
    }
});

app.post('/api/explain-topic', async (req, res) => {
    try {
        const { topic } = req.body;
        
        if (!topic || typeof topic !== 'string') {
            return res.status(400).json({ error: 'Tópico inválido ou não fornecido.' });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Explique de forma simples e direta, como se eu estivesse revisando para uma prova de matemática básica, o seguinte tópico: ${topic}. Use formatação em HTML simples (<b>, <i>, <br>, <ul>, <li>) para facilitar a leitura. Não use markdown.`,
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
            model: 'gemini-3-flash-preview',
            contents: `Gere uma revisão rápida para prova sobre o tópico: ${topic}. Inclua: resumo curto, fórmulas-chave, pegadinhas comuns e o que mais cai. Use formatação em HTML simples (<b>, <i>, <br>, <ul>, <li>, <h3>, <h4>) para facilitar a leitura. Não use markdown.`,
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
            model: 'gemini-3-flash-preview',
            contents: `Gere uma lista de 3 exercícios práticos (não múltipla escolha) sobre o tópico de matemática: ${topic}. Para cada exercício, forneça o enunciado e, logo abaixo, a resolução passo a passo oculta dentro de uma tag <details> do HTML (use <summary>Ver Resolução</summary>). Use formatação em HTML simples (<b>, <i>, <br>, <ul>, <li>, <details>, <summary>) para facilitar a leitura. Não use markdown.`,
        });
        res.json({ exercises: response.text });
    } catch (error) {
        console.error("Erro ao gerar exercícios:", error);
        res.status(500).json({ error: 'Falha ao gerar exercícios. Por favor, tente novamente.' });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { history, message, model = 'gemini-3-flash-preview' } = req.body;
        
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Mensagem inválida.' });
        }

        let selectedModel = model;
        if (!['gemini-3.1-pro-preview', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview'].includes(model)) {
            selectedModel = 'gemini-3-flash-preview';
        }

        const chat = ai.chats.create({
            model: selectedModel,
            config: {
                systemInstruction: "Você é um tutor de matemática básica, amigável e encorajador. Ajude o aluno a entender os conceitos passo a passo. Responda de forma clara e concisa.",
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

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
