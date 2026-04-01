import 'dotenv/config';
import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
app.use(express.json());

// ── Validação da chave ──────────────────────────────────────
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
if (!apiKey) {
    console.error('\n❌  GEMINI_API_KEY não encontrada.');
    console.error('    Crie um arquivo .env na raiz do projeto com:\n');
    console.error('    GEMINI_API_KEY=sua_chave_aqui\n');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const MODELS = {
    flash: 'gemini-2.0-flash',
    pro:   'gemini-1.5-pro',
    lite:  'gemini-2.0-flash-lite',
};

// ── Utilitários ─────────────────────────────────────────────

/**
 * Remove blocos de código markdown do texto antes de parsear JSON.
 * Gemini às vezes envolve a resposta em ```json ... ``` mesmo com
 * responseMimeType: 'application/json'.
 */
function safeParseJSON(raw: string | null | undefined): unknown {
    if (!raw) throw new Error('Resposta vazia do modelo Gemini.');
    const cleaned = raw
        .replace(/^```json\s*/im, '')
        .replace(/^```\s*/im, '')
        .replace(/\s*```$/im, '')
        .trim();
    return JSON.parse(cleaned);
}

function getText(raw: string | null | undefined): string {
    if (!raw) throw new Error('Resposta vazia do modelo Gemini.');
    return raw;
}

// ── Endpoints ────────────────────────────────────────────────

app.post('/api/generate-quiz', async (req, res) => {
    try {
        const { topic, count = 5, difficulty = 'médio' } = req.body;

        if (!topic || typeof topic !== 'string') {
            return res.status(400).json({ error: 'Tópico inválido.' });
        }

        const response = await ai.models.generateContent({
            model: MODELS.flash,
            contents: `Você é um professor de matemática. Gere um quiz de múltipla escolha sobre: "${topic}". Dificuldade: ${difficulty}. Gere exatamente ${count} questões com 4 opções cada. O campo correctAnswer é o índice 0-based da resposta correta. Retorne APENAS JSON válido, sem texto extra, sem markdown.`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question:      { type: Type.STRING },
                            options:       { type: Type.ARRAY, items: { type: Type.STRING } },
                            correctAnswer: { type: Type.INTEGER },
                            explanation:   { type: Type.STRING },
                            difficulty:    { type: Type.STRING },
                        },
                        required: ['question', 'options', 'correctAnswer', 'explanation', 'difficulty'],
                    }
                }
            }
        });

        const data = safeParseJSON(response.text) as unknown[];
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('Array de questões vazio ou formato inválido.');
        }

        res.json(data);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[generate-quiz]', msg);
        res.status(500).json({ error: 'Falha ao gerar quiz. Tente novamente.' });
    }
});

app.post('/api/explain-topic', async (req, res) => {
    try {
        const { topic } = req.body;
        if (!topic || typeof topic !== 'string') {
            return res.status(400).json({ error: 'Tópico inválido.' });
        }

        const response = await ai.models.generateContent({
            model: MODELS.flash,
            contents: `Você é um professor de matemática simpático. Explique de forma simples e direta: "${topic}". Linguagem clara para revisão de prova. Inclua pelo menos um exemplo prático. Use HTML simples (<b>, <i>, <br>, <ul>, <li>, <p>). Não use markdown nem blocos de código.`,
        });

        res.json({ explanation: getText(response.text) });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[explain-topic]', msg);
        res.status(500).json({ error: 'Falha ao gerar explicação. Tente novamente.' });
    }
});

app.post('/api/generate-review', async (req, res) => {
    try {
        const { topic } = req.body;
        if (!topic || typeof topic !== 'string') {
            return res.status(400).json({ error: 'Tópico inválido.' });
        }

        const response = await ai.models.generateContent({
            model: MODELS.flash,
            contents: `Você é um professor de matemática. Gere uma revisão rápida de véspera de prova sobre: "${topic}". Inclua: 1) Pontos principais, 2) Fórmulas e definições essenciais, 3) Erros mais comuns, 4) Dicas práticas. Use HTML simples (<b>, <i>, <br>, <ul>, <li>, <h3>, <h4>). Não use markdown.`,
        });

        res.json({ review: getText(response.text) });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[generate-review]', msg);
        res.status(500).json({ error: 'Falha ao gerar revisão. Tente novamente.' });
    }
});

app.post('/api/generate-exercises', async (req, res) => {
    try {
        const { topic } = req.body;
        if (!topic || typeof topic !== 'string') {
            return res.status(400).json({ error: 'Tópico inválido.' });
        }

        const response = await ai.models.generateContent({
            model: MODELS.flash,
            contents: `Você é um professor de matemática. Gere 3 exercícios dissertativos (não múltipla escolha) sobre: "${topic}". Para cada um: enunciado claro + resolução passo a passo dentro de <details><summary>Ver Resolução</summary>...</details>. Use HTML simples. Numere os exercícios. Não use markdown.`,
        });

        res.json({ exercises: getText(response.text) });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[generate-exercises]', msg);
        res.status(500).json({ error: 'Falha ao gerar exercícios. Tente novamente.' });
    }
});

/**
 * Chat — implementado com generateContent + histórico completo.
 * Mais confiável que ai.chats.create() em versões recentes do SDK.
 */
app.post('/api/chat', async (req, res) => {
    try {
        const { history, message, model = 'flash' } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Mensagem inválida.' });
        }

        const selectedModel = MODELS[model as keyof typeof MODELS] || MODELS.flash;

        const systemInstruction =
            'Você é um tutor de matemática básica, paciente, amigável e encorajador. ' +
            'Ajude o aluno a entender conceitos de forma clara e simples. ' +
            'Ao resolver exercícios, mostre o passo a passo numerado. ' +
            'Corrija erros gentilmente, explicando o raciocínio correto. ' +
            'Não use LaTeX — escreva fórmulas em texto simples (ex: a^2 + b^2). ' +
            'Tópicos que você cobre: conjuntos numéricos, intervalos, álgebra, ' +
            'produtos notáveis, fatoração, potenciação, radiciação, reta real.';

        // Monta o histórico completo incluindo a nova mensagem do usuário
        const safeHistory = Array.isArray(history) ? history : [];
        const contents = [
            ...safeHistory,
            { role: 'user', parts: [{ text: message }] },
        ];

        const response = await ai.models.generateContent({
            model: selectedModel,
            contents,
            config: { systemInstruction },
        });

        res.json({ text: getText(response.text) });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[chat]', msg);
        res.status(500).json({ error: 'Falha ao processar mensagem. Tente novamente.' });
    }
});

// ── Servir frontend ──────────────────────────────────────────
app.use(express.static(__dirname));
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅  Servidor rodando em http://localhost:${PORT}`);
    console.log(`🤖  Gemini conectado — modelo padrão: ${MODELS.flash}\n`);
});
