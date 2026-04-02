import dotenv from 'dotenv';
import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import {
    authenticateLogin,
    buildLoginPageHtml,
    clearSessionCookie,
    destroyExpiredSessions,
    destroySessionByToken,
    getExpiresInSeconds,
    getAuthConfigStatus,
    getSessionTtlSeconds,
    getSessionSecretStatus,
    getSessionWarningSeconds,
    getLearningState,
    refreshRequestSession,
    readSessionTokenFromRequest,
    requireAuth,
    requireRole,
    resolveRequestAuth,
    saveLearningState,
    setSessionCookie,
} from './server/auth.ts';
import { closeDatabasePool, ensureDatabaseReady, getDatabaseStatus } from './server/database.ts';

dotenv.config({ path: '.env.local', override: true, quiet: true });
dotenv.config({ path: '.env', override: false, quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);

const ENV_VAR_NAME = 'GEMINI_API_KEY';
const provider = 'gemini';
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const MODEL_CANDIDATES = {
    flash: ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'],
    pro: ['gemini-2.5-pro', 'gemini-pro-latest', 'gemini-2.5-flash'],
    lite: ['gemini-2.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-2.0-flash-lite'],
} as const;

const MODELS = {
    flash: MODEL_CANDIDATES.flash[0],
    pro: MODEL_CANDIDATES.pro[0],
    lite: MODEL_CANDIDATES.lite[0],
} as const;

type ModelKey = keyof typeof MODELS;

function isValidHttpUrl(value: string): boolean {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function getRuntimeEnvStatus() {
    const missing: string[] = [];
    const invalid: string[] = [];
    const warnings: string[] = [];

    const appUrl = process.env.APP_URL?.trim() || '';

    if (!appUrl) {
        missing.push('APP_URL');
    } else if (!isValidHttpUrl(appUrl)) {
        invalid.push('APP_URL');
    }

    if (!(process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim()) {
        warnings.push('GEMINI_API_KEY');
    }

    return {
        ready: missing.length === 0 && invalid.length === 0,
        missing,
        invalid,
        warnings,
    };
}

function getPrivateAppConfigStatus() {
    const authStatus = getAuthConfigStatus();
    const databaseStatus = getDatabaseStatus();
    const sessionStatus = getSessionSecretStatus();
    const runtimeStatus = getRuntimeEnvStatus();

    const missing = [...authStatus.missing];
    if (!databaseStatus.configured && !missing.includes(databaseStatus.envVar)) {
        missing.push(databaseStatus.envVar);
    }
    if (!sessionStatus.configured && !missing.includes(sessionStatus.envVar)) {
        missing.push(sessionStatus.envVar);
    }
    runtimeStatus.missing.forEach((item) => {
        if (!missing.includes(item)) {
            missing.push(item);
        }
    });

    return {
        ready: authStatus.ready && databaseStatus.configured && sessionStatus.configured && runtimeStatus.ready,
        missing,
        invalid: [...authStatus.invalid, ...runtimeStatus.invalid],
        warnings: runtimeStatus.warnings,
    };
}

function getConfigIssueMessage() {
    const status = getPrivateAppConfigStatus();
    const issues = [...status.missing, ...status.invalid];

    if (!issues.length) {
        return '';
    }

    return `Variáveis pendentes ou inválidas: ${issues.join(', ')}.`;
}

function buildSessionPayload(req: express.Request, overrides: { sessionExpiresAt?: string | null } = {}) {
    const sessionExpiresAt = overrides.sessionExpiresAt ?? req.authSessionExpiresAt ?? null;

    return {
        authenticated: Boolean(req.authUser),
        sessionExpiresAt,
        expiresIn: getExpiresInSeconds(sessionExpiresAt),
        sessionTtlSeconds: getSessionTtlSeconds(),
        warningThresholdSeconds: getSessionWarningSeconds(),
    };
}

async function requirePageAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    try {
        const user = await resolveRequestAuth(req);
        if (!user) {
            res.redirect('/login');
            return;
        }

        next();
    } catch (error) {
        next(error);
    }
}

async function requireAssetAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    try {
        const user = await resolveRequestAuth(req);
        if (!user) {
            res.status(401).type('text/plain; charset=utf-8').send('Authentication required.');
            return;
        }

        next();
    } catch (error) {
        next(error);
    }
}

type ExplainPayload = {
    title: string;
    summary: string;
    keyPoints: string[];
    example: {
        prompt: string;
        steps: string[];
        answer: string;
    };
    memoryTips: string[];
};

type ReviewPayload = {
    overview: string;
    essentials: string[];
    mistakes: string[];
    tips: string[];
};

type ExercisePayload = {
    intro: string;
    exercises: Array<{
        title: string;
        statement: string;
        hint: string;
        steps: string[];
        answer: string;
    }>;
};

type QuizQuestion = {
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
    difficulty: string;
};

type AiErrorKind =
    | 'missing_key'
    | 'quota_exceeded'
    | 'auth'
    | 'validation'
    | 'parse_error'
    | 'network'
    | 'provider'
    | 'unexpected';

type AiDiagnostics = {
    requestId: string;
    route: string;
    provider: string;
    envVar: string;
    envPresent: boolean;
    model: string;
    requestedModel?: string;
    attemptedModels?: string[];
    statusCode?: number;
    providerStatus?: string;
    errorType: AiErrorKind;
    detail: string;
    retryAfterSeconds?: number;
};

type ProviderEnvelope = {
    error?: {
        code?: number;
        message?: string;
        status?: string;
        details?: Array<Record<string, unknown>>;
    };
};

app.use((req, res, next) => {
    const origin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    if (origin) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
    }

    next();
});

app.get('/healthz', (_req, res) => {
    res.status(200).json({
        ok: true,
        service: 'ctia03',
        provider,
    });
});

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');

    const noStore =
        req.path === '/' ||
        req.path === '/login' ||
        req.path === '/app' ||
        req.path === '/me' ||
        req.path === '/logout' ||
        req.path.startsWith('/api') ||
        req.path.startsWith('/content') ||
        req.path.startsWith('/ferramentas');

    if (noStore) {
        res.setHeader('Cache-Control', 'no-store');
    }

    next();
});

app.use((req, res, next) => {
    const requestId = randomUUID().slice(0, 8);
    const startedAt = Date.now();

    res.locals.requestId = requestId;
    console.info(`[${requestId}] ${req.method} ${req.path}`);

    res.on('finish', () => {
        const elapsed = Date.now() - startedAt;
        console.info(`[${requestId}] ${req.method} ${req.path} -> ${res.statusCode} (${elapsed}ms)`);
    });

    next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

function safeParseJSON(raw: string | null | undefined): unknown {
    if (!raw) {
        throw new Error('Empty Gemini response.');
    }

    const cleaned = raw
        .replace(/^```json\s*/im, '')
        .replace(/^```\s*/im, '')
        .replace(/\s*```$/im, '')
        .trim();

    return JSON.parse(cleaned);
}

function ensureText(raw: string | null | undefined): string {
    if (!raw) {
        throw new Error('Empty Gemini response.');
    }

    return raw;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`Invalid field "${field}".`);
    }

    return value.trim();
}

function requireStringArray(value: unknown, field: string, minLength = 1): string[] {
    if (!Array.isArray(value)) {
        throw new Error(`Invalid field "${field}".`);
    }

    const items = value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);

    if (items.length < minLength) {
        throw new Error(`Field "${field}" is too short.`);
    }

    return items;
}

function validateExplainPayload(value: unknown): ExplainPayload {
    if (!isRecord(value)) {
        throw new Error('Invalid explain payload.');
    }

    if (!isRecord(value.example)) {
        throw new Error('Invalid explain example payload.');
    }

    return {
        title: requireNonEmptyString(value.title, 'title'),
        summary: requireNonEmptyString(value.summary, 'summary'),
        keyPoints: requireStringArray(value.keyPoints, 'keyPoints', 2),
        example: {
            prompt: requireNonEmptyString(value.example.prompt, 'example.prompt'),
            steps: requireStringArray(value.example.steps, 'example.steps', 2),
            answer: requireNonEmptyString(value.example.answer, 'example.answer'),
        },
        memoryTips: requireStringArray(value.memoryTips, 'memoryTips', 1),
    };
}

function validateReviewPayload(value: unknown): ReviewPayload {
    if (!isRecord(value)) {
        throw new Error('Invalid review payload.');
    }

    return {
        overview: requireNonEmptyString(value.overview, 'overview'),
        essentials: requireStringArray(value.essentials, 'essentials', 2),
        mistakes: requireStringArray(value.mistakes, 'mistakes', 1),
        tips: requireStringArray(value.tips, 'tips', 1),
    };
}

function validateExercisesPayload(value: unknown): ExercisePayload {
    if (!isRecord(value) || !Array.isArray(value.exercises)) {
        throw new Error('Invalid exercises payload.');
    }

    const exercises = value.exercises.map((item, index) => {
        if (!isRecord(item)) {
            throw new Error(`Invalid exercise payload at index ${index}.`);
        }

        return {
            title: requireNonEmptyString(item.title, `exercises.${index}.title`),
            statement: requireNonEmptyString(item.statement, `exercises.${index}.statement`),
            hint: requireNonEmptyString(item.hint, `exercises.${index}.hint`),
            steps: requireStringArray(item.steps, `exercises.${index}.steps`, 2),
            answer: requireNonEmptyString(item.answer, `exercises.${index}.answer`),
        };
    });

    if (!exercises.length) {
        throw new Error('Exercises payload is empty.');
    }

    return {
        intro: requireNonEmptyString(value.intro, 'intro'),
        exercises,
    };
}

function validateQuizPayload(value: unknown): QuizQuestion[] {
    if (!Array.isArray(value) || !value.length) {
        throw new Error('Quiz payload is empty.');
    }

    return value.map((item, index) => {
        if (!isRecord(item)) {
            throw new Error(`Invalid quiz item at index ${index}.`);
        }

        const options = requireStringArray(item.options, `options.${index}`, 4);
        const correctAnswer = Number(item.correctAnswer);

        if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
            throw new Error(`Invalid correctAnswer at index ${index}.`);
        }

        return {
            question: requireNonEmptyString(item.question, `question.${index}`),
            options,
            correctAnswer,
            explanation: requireNonEmptyString(item.explanation, `explanation.${index}`),
            difficulty: requireNonEmptyString(item.difficulty, `difficulty.${index}`),
        };
    });
}

function getProviderEnvelope(error: unknown): ProviderEnvelope | null {
    const rawMessage = error instanceof Error ? error.message : String(error ?? '');

    try {
        const parsed = JSON.parse(rawMessage);
        return isRecord(parsed) ? (parsed as ProviderEnvelope) : null;
    } catch (_error) {
        return null;
    }
}

function getProviderErrorMeta(error: unknown): {
    envelope: ProviderEnvelope | null;
    errorMessage: string;
    statusCode?: number;
    providerStatus?: string;
    detail: string;
} {
    const envelope = getProviderEnvelope(error);
    const errorMessage = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    const statusCode =
        typeof (error as { status?: unknown })?.status === 'number'
            ? Number((error as { status?: unknown }).status)
            : envelope?.error?.code;
    const providerStatus = envelope?.error?.status;
    const detail = envelope?.error?.message || errorMessage;

    return {
        envelope,
        errorMessage,
        statusCode,
        providerStatus,
        detail,
    };
}

function getAttachedModelAttempts(error: unknown): string[] | undefined {
    if (!error || typeof error !== 'object') {
        return undefined;
    }

    const attempts = (error as { attemptedModels?: unknown }).attemptedModels;
    return Array.isArray(attempts) ? attempts.map((item) => String(item)) : undefined;
}

function getAttachedRequestedModel(error: unknown): string | undefined {
    if (!error || typeof error !== 'object') {
        return undefined;
    }

    const requestedModel = (error as { requestedModel?: unknown }).requestedModel;
    return typeof requestedModel === 'string' ? requestedModel : undefined;
}

function attachModelMetadata(error: unknown, requestedModel: string, attemptedModels: string[]): unknown {
    if (error && typeof error === 'object') {
        (error as { requestedModel?: string }).requestedModel = requestedModel;
        (error as { attemptedModels?: string[] }).attemptedModels = attemptedModels.slice();
    }

    return error;
}

function getRetryAfterSeconds(details: Array<Record<string, unknown>> | undefined): number | undefined {
    if (!Array.isArray(details)) {
        return undefined;
    }

    const retryInfo = details.find((item) => item['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
    const retryDelay = typeof retryInfo?.retryDelay === 'string' ? retryInfo.retryDelay : '';
    const seconds = Number.parseInt(retryDelay.replace(/[^0-9]/g, ''), 10);

    return Number.isFinite(seconds) ? seconds : undefined;
}

function classifyAiError(error: unknown, route: string, requestId: string, model: string): AiDiagnostics {
    const { envelope, errorMessage, statusCode, providerStatus, detail } = getProviderErrorMeta(error);
    const retryAfterSeconds = getRetryAfterSeconds(envelope?.error?.details);

    let errorType: AiErrorKind = 'unexpected';

    if (!apiKey) {
        errorType = 'missing_key';
    } else if (statusCode === 429 || providerStatus === 'RESOURCE_EXHAUSTED' || /quota/i.test(detail)) {
        errorType = 'quota_exceeded';
    } else if (statusCode === 401 || statusCode === 403 || /api key|auth|permission|forbidden|unauthorized/i.test(detail)) {
        errorType = 'auth';
    } else if (
        statusCode === 400 ||
        /Invalid field|too short|Invalid .*payload|payload is empty|Empty Gemini response/i.test(errorMessage)
    ) {
        errorType = 'validation';
    } else if (error instanceof SyntaxError || /json/i.test(errorMessage)) {
        errorType = 'parse_error';
    } else if (/fetch failed|network|socket|timed out|econnrefused/i.test(detail)) {
        errorType = 'network';
    } else if (statusCode && statusCode >= 500) {
        errorType = 'provider';
    }

    return {
        requestId,
        route,
        provider,
        envVar: ENV_VAR_NAME,
        envPresent: Boolean(apiKey),
        model,
        requestedModel: getAttachedRequestedModel(error),
        attemptedModels: getAttachedModelAttempts(error),
        statusCode,
        providerStatus,
        errorType,
        detail,
        retryAfterSeconds,
    };
}

function getFriendlyMessage(diagnostics: AiDiagnostics, actionLabel: string): string {
    switch (diagnostics.errorType) {
        case 'missing_key':
            return `Integracao da IA nao configurada. Defina ${ENV_VAR_NAME}.`;
        case 'quota_exceeded':
            return 'A IA respondeu, mas a cota atual do provider foi excedida.';
        case 'auth':
            return 'A chave da IA foi rejeitada pelo provider.';
        case 'parse_error':
            return `A IA respondeu em formato invalido durante ${actionLabel}.`;
        case 'validation':
            return `O provider recusou a requisicao durante ${actionLabel}.`;
        case 'network':
            return 'Nao foi possivel conectar ao provider da IA.';
        default:
            return `Falha ao ${actionLabel}.`;
    }
}

function logAiFailure(diagnostics: AiDiagnostics, error: unknown): void {
    console.error(`[${diagnostics.requestId}] [${diagnostics.route}] AI request failed`);
    console.error(`[${diagnostics.requestId}] diagnostics`, diagnostics);

    if (error instanceof Error && error.stack) {
        console.error(error.stack);
        return;
    }

    console.error(error);
}

function sendAiError(
    res: express.Response,
    route: string,
    model: string,
    actionLabel: string,
    error: unknown,
): void {
    const requestId = String(res.locals.requestId || 'unknown');
    const diagnostics = classifyAiError(error, route, requestId, model);
    const statusCode =
        diagnostics.statusCode ||
        (diagnostics.errorType === 'missing_key'
            ? 503
            : diagnostics.errorType === 'quota_exceeded'
                ? 429
                : diagnostics.errorType === 'validation' || diagnostics.errorType === 'parse_error'
                    ? 400
                    : 500);

    logAiFailure(diagnostics, error);

    res.status(statusCode).json({
        ok: false,
        error: getFriendlyMessage(diagnostics, actionLabel),
        diagnostics,
    });
}

function getAiClientOrThrow(): GoogleGenAI {
    if (!ai) {
        throw new Error(`Missing ${ENV_VAR_NAME}.`);
    }

    return ai;
}

function parseModelKey(value: unknown): ModelKey {
    return typeof value === 'string' && value in MODEL_CANDIDATES ? (value as ModelKey) : 'flash';
}

function shouldTryNextModel(error: unknown): boolean {
    const { statusCode, providerStatus, detail } = getProviderErrorMeta(error);
    return (
        statusCode === 404 ||
        statusCode === 429 ||
        providerStatus === 'NOT_FOUND' ||
        providerStatus === 'RESOURCE_EXHAUSTED' ||
        /not found|not supported|quota/i.test(detail)
    );
}

async function runWithModelFallback<T>({
    modelKey,
    route,
    requestId,
    runner,
}: {
    modelKey: ModelKey;
    route: string;
    requestId: string;
    runner: (model: string) => Promise<T>;
}): Promise<{ data: T; model: string; attemptedModels: string[] }> {
    const candidates = MODEL_CANDIDATES[modelKey];
    const attemptedModels: string[] = [];
    let lastError: unknown = null;

    for (const [index, model] of candidates.entries()) {
        attemptedModels.push(model);
        console.info(`[${requestId}] [${route}] trying model`, {
            requestedModel: modelKey,
            model,
            attempt: index + 1,
            total: candidates.length,
        });

        try {
            const data = await runner(model);

            if (index > 0) {
                console.info(`[${requestId}] [${route}] fallback model selected`, {
                    requestedModel: modelKey,
                    resolvedModel: model,
                    attemptedModels,
                });
            }

            return { data, model, attemptedModels };
        } catch (error) {
            lastError = error;
            const { statusCode, providerStatus, detail } = getProviderErrorMeta(error);

            console.error(`[${requestId}] [${route}] model candidate failed`, {
                requestedModel: modelKey,
                model,
                statusCode,
                providerStatus,
                detail,
            });

            if (!shouldTryNextModel(error) || index === candidates.length - 1) {
                throw attachModelMetadata(error, modelKey, attemptedModels);
            }
        }
    }

    throw attachModelMetadata(lastError || new Error('No available Gemini model candidates.'), modelKey, attemptedModels);
}

async function generateJson<T>({
    modelKey,
    route,
    requestId,
    contents,
    responseSchema,
    validator,
}: {
    modelKey: ModelKey;
    route: string;
    requestId: string;
    contents: string;
    responseSchema: Record<string, unknown>;
    validator: (value: unknown) => T;
}): Promise<{ data: T; model: string; attemptedModels: string[] }> {
    const client = getAiClientOrThrow();

    return runWithModelFallback({
        modelKey,
        route,
        requestId,
        runner: async (model) => {
            const response = await client.models.generateContent({
                model,
                contents,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema,
                },
            });

            return validator(safeParseJSON(response.text));
        },
    });
}

async function generateText({
    modelKey,
    route,
    requestId,
    contents,
    systemInstruction,
}: {
    modelKey: ModelKey;
    route: string;
    requestId: string;
    contents: Array<{ role: string; parts: Array<{ text: string }> }> | string;
    systemInstruction?: string;
}): Promise<{ text: string; model: string; attemptedModels: string[] }> {
    const client = getAiClientOrThrow();

    return runWithModelFallback({
        modelKey,
        route,
        requestId,
        runner: async (model) => {
            const response = await client.models.generateContent({
                model,
                contents,
                config: systemInstruction ? { systemInstruction } : undefined,
            });

            return ensureText(response.text);
        },
    }).then(({ data, model, attemptedModels }) => ({
        text: data,
        model,
        attemptedModels,
    }));
}

function parseBodyTopic(value: unknown): string {
    return requireNonEmptyString(value, 'topic');
}

function parseCount(value: unknown, fallback: number): number {
    const count = Number(value);
    if (!Number.isFinite(count) || count <= 0) {
        return fallback;
    }
    return Math.min(Math.floor(count), 10);
}

app.get('/', async (req, res, next) => {
    try {
        const config = getPrivateAppConfigStatus();
        if (config.ready) {
            const user = await resolveRequestAuth(req);
            if (user) {
                res.redirect('/app');
                return;
            }
        }

        res.redirect('/login');
    } catch (error) {
        next(error);
    }
});

app.get('/login', async (req, res, next) => {
    try {
        const config = getPrivateAppConfigStatus();
        if (config.ready) {
            const user = await resolveRequestAuth(req);
            if (user) {
                res.redirect('/app');
                return;
            }
        }

        res.status(200).set('Content-Type', 'text/html; charset=utf-8').send(
            buildLoginPageHtml({
                configReady: config.ready,
                configMessage: getConfigIssueMessage(),
                appName: 'CTIA03',
            }),
        );
    } catch (error) {
        next(error);
    }
});

app.post('/login', async (req, res) => {
    const requestId = String(res.locals.requestId || 'unknown');
    const config = getPrivateAppConfigStatus();
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!config.ready) {
        console.error(`[${requestId}] [auth] login blocked: missing auth configuration`, config);
        res.status(503).json({
            ok: false,
            error: 'Autenticação privada ainda não foi configurada no ambiente.',
            diagnostics: config,
        });
        return;
    }

    try {
        const login = await authenticateLogin(email, password, req);

        if (!login) {
            console.warn(`[${requestId}] [auth] invalid login`, {
                email,
                ip: req.ip,
            });
            res.status(401).json({
                ok: false,
                error: 'Credenciais inválidas',
            });
            return;
        }

        setSessionCookie(res, req, login.sessionToken, login.expiresAt);
        console.info(`[${requestId}] [auth] login success`, {
            userId: login.user.id,
            email: login.user.email,
            role: login.user.role,
        });

        res.json({
            ok: true,
            user: login.user,
            sessionExpiresAt: login.expiresAt.toISOString(),
            expiresIn: getExpiresInSeconds(login.expiresAt),
            sessionTtlSeconds: getSessionTtlSeconds(),
            warningThresholdSeconds: getSessionWarningSeconds(),
        });
    } catch (error) {
        const statusCode =
            typeof (error as { statusCode?: unknown })?.statusCode === 'number'
                ? Number((error as { statusCode?: number }).statusCode)
                : 500;

        console.error(`[${requestId}] [auth] login failure`, error);

        res.status(statusCode).json({
            ok: false,
            error: statusCode === 429 ? 'Muitas tentativas. Tente novamente em instantes.' : 'Credenciais inválidas',
            diagnostics:
                statusCode === 429
                    ? { retryAfterSeconds: (error as { retryAfterSeconds?: number }).retryAfterSeconds || 60 }
                    : undefined,
        });
    }
});

app.post('/logout', async (req, res) => {
    const requestId = String(res.locals.requestId || 'unknown');
    try {
        const token = readSessionTokenFromRequest(req);
        await destroySessionByToken(token);
        clearSessionCookie(res, req);
        console.info(`[${requestId}] [auth] logout success`);
        res.json({ ok: true });
    } catch (error) {
        console.error(`[${requestId}] [auth] logout failure`, error);
        clearSessionCookie(res, req);
        res.status(500).json({
            ok: false,
            error: 'Falha ao encerrar sessão.',
        });
    }
});

app.get('/me', async (req, res, next) => {
    try {
        const user = await resolveRequestAuth(req);
        if (!user) {
            res.status(401).json({
                ok: false,
                error: 'Authentication required.',
            });
            return;
        }

        res.json({
            ok: true,
            user,
            ...buildSessionPayload(req),
        });
    } catch (error) {
        next(error);
    }
});

app.get('/auth/session-status', requireAuth, async (req, res, next) => {
    try {
        res.json({
            ok: true,
            ...buildSessionPayload(req),
        });
    } catch (error) {
        next(error);
    }
});

app.post('/auth/refresh-session', requireAuth, async (req, res) => {
    const requestId = String(res.locals.requestId || 'unknown');
    const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() ? req.body.reason.trim() : 'activity';

    try {
        const token = readSessionTokenFromRequest(req);
        const refreshedExpiresAt = await refreshRequestSession(req);

        if (!token || !refreshedExpiresAt) {
            console.warn(`[${requestId}] [auth] session refresh rejected`, {
                reason,
                userId: req.authUser?.id || null,
            });
            clearSessionCookie(res, req);
            res.status(401).json({
                ok: false,
                error: 'Authentication required.',
            });
            return;
        }

        setSessionCookie(res, req, token, refreshedExpiresAt);
        console.info(`[${requestId}] [auth] session refreshed`, {
            reason,
            userId: req.authUser?.id,
            expiresAt: refreshedExpiresAt.toISOString(),
        });

        res.json({
            ok: true,
            ...buildSessionPayload(req, { sessionExpiresAt: refreshedExpiresAt.toISOString() }),
        });
    } catch (error) {
        console.error(`[${requestId}] [auth] session refresh failure`, error);
        res.status(500).json({
            ok: false,
            error: 'Falha ao renovar sessão.',
        });
    }
});

app.get('/app', requirePageAuth, (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.use('/api', requireAuth);

app.get('/api/state', async (req, res) => {
    const user = req.authUser;
    if (!user) {
        res.status(401).json({ ok: false, error: 'Authentication required.' });
        return;
    }

    try {
        const state = await getLearningState(user);
        res.json({ ok: true, state });
    } catch (error) {
        console.error(`[${String(res.locals.requestId || 'unknown')}] [state] read failure`, error);
        res.status(500).json({ ok: false, error: 'Falha ao carregar estado do usuário.' });
    }
});

app.put('/api/state', async (req, res) => {
    const user = req.authUser;
    if (!user) {
        res.status(401).json({ ok: false, error: 'Authentication required.' });
        return;
    }

    try {
        const nextState = await saveLearningState(user, req.body?.state ?? req.body);
        res.json({ ok: true, state: nextState });
    } catch (error) {
        console.error(`[${String(res.locals.requestId || 'unknown')}] [state] write failure`, error);
        res.status(400).json({ ok: false, error: 'Falha ao salvar estado do usuário.' });
    }
});

app.get('/api/admin/auth-status', requireRole('owner'), (_req, res) => {
    res.json({
        ok: true,
        auth: getPrivateAppConfigStatus(),
        provider,
        aiConfigured: Boolean(apiKey),
    });
});

async function handleTestAiRequest(req: express.Request, res: express.Response) {
    const requestId = String(res.locals.requestId || 'unknown');
    const requestedModel = parseModelKey(req.method === 'GET' ? req.query?.model : req.body?.model);
    const primaryModel = MODEL_CANDIDATES[requestedModel][0];

    if (!apiKey) {
        res.status(503).json({
            ok: false,
            provider,
            model: primaryModel,
            requestedModel,
            envVar: ENV_VAR_NAME,
            envPresent: false,
            errorType: 'missing_key',
            error: `Missing ${ENV_VAR_NAME}.`,
        });
        return;
    }

    try {
        const { text, model, attemptedModels } = await generateText({
            modelKey: requestedModel,
            route: '/api/test-ai',
            requestId,
            contents: 'Reply with exactly: ok',
        });

        res.json({
            ok: true,
            provider,
            model,
            requestedModel,
            attemptedModels,
            envVar: ENV_VAR_NAME,
            envPresent: true,
            message: 'AI connection successful',
            reply: text.trim(),
            requestId,
        });
    } catch (error) {
        const diagnostics = classifyAiError(error, '/api/test-ai', requestId, primaryModel);

        logAiFailure(diagnostics, error);

        res.status(diagnostics.statusCode || 500).json({
            ok: false,
            provider,
            model: diagnostics.model,
            requestedModel,
            envVar: ENV_VAR_NAME,
            envPresent: true,
            errorType: diagnostics.errorType,
            error: diagnostics.detail,
            diagnostics,
        });
    }
}

app.get('/api/test-ai', async (req, res) => {
    await handleTestAiRequest(req, res);
});

app.post('/api/test-ai', async (req, res) => {
    await handleTestAiRequest(req, res);
});

app.post('/api/generate-quiz', async (req, res) => {
    const route = '/api/generate-quiz';
    const modelKey: ModelKey = 'flash';
    const requestId = String(res.locals.requestId || 'unknown');
    const primaryModel = MODEL_CANDIDATES[modelKey][0];

    try {
        const topic = parseBodyTopic(req.body?.topic);
        const count = parseCount(req.body?.count, 5);
        const difficulty = typeof req.body?.difficulty === 'string' && req.body.difficulty.trim()
            ? req.body.difficulty.trim()
            : 'medio';

        const { data } = await generateJson<QuizQuestion[]>({
            modelKey,
            route,
            requestId,
            contents:
                `Voce e um professor de matematica. Gere um quiz de multipla escolha sobre "${topic}". ` +
                `Dificuldade: ${difficulty}. Gere exatamente ${count} questoes com 4 opcoes cada. ` +
                'Retorne JSON valido, sem markdown. Cada item deve conter question, options, correctAnswer, explanation e difficulty. ' +
                'correctAnswer deve ser um indice inteiro baseado em zero.',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        question: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctAnswer: { type: Type.INTEGER },
                        explanation: { type: Type.STRING },
                        difficulty: { type: Type.STRING },
                    },
                    required: ['question', 'options', 'correctAnswer', 'explanation', 'difficulty'],
                },
            },
            validator: validateQuizPayload,
        });

        res.json(data);
    } catch (error) {
        sendAiError(res, route, primaryModel, 'gerar quiz', error);
    }
});

app.post('/api/explain-topic', async (req, res) => {
    const route = '/api/explain-topic';
    const modelKey: ModelKey = 'flash';
    const requestId = String(res.locals.requestId || 'unknown');
    const primaryModel = MODEL_CANDIDATES[modelKey][0];

    try {
        const topic = parseBodyTopic(req.body?.topic);

        const { data: explanation, model, attemptedModels } = await generateJson<ExplainPayload>({
            modelKey,
            route,
            requestId,
            contents:
                `Explique "${topic}" para um estudante que precisa de uma versao mais simples. ` +
                'Retorne JSON valido, sem markdown. Seja didatico, direto e concreto. ' +
                'O campo summary deve ter 2 ou 3 frases. keyPoints deve ter de 3 a 5 itens. ' +
                'example deve trazer um exemplo resolvido simples com prompt, steps e answer. ' +
                'memoryTips deve ter de 2 a 4 dicas curtas.',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                    example: {
                        type: Type.OBJECT,
                        properties: {
                            prompt: { type: Type.STRING },
                            steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                            answer: { type: Type.STRING },
                        },
                        required: ['prompt', 'steps', 'answer'],
                    },
                    memoryTips: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['title', 'summary', 'keyPoints', 'example', 'memoryTips'],
            },
            validator: validateExplainPayload,
        });

        res.json({ ok: true, explanation, model, requestedModel: modelKey, attemptedModels });
    } catch (error) {
        sendAiError(res, route, primaryModel, 'gerar explicacao', error);
    }
});

app.post('/api/generate-review', async (req, res) => {
    const route = '/api/generate-review';
    const modelKey: ModelKey = 'flash';
    const requestId = String(res.locals.requestId || 'unknown');
    const primaryModel = MODEL_CANDIDATES[modelKey][0];

    try {
        const topic = parseBodyTopic(req.body?.topic);

        const { data: review, model, attemptedModels } = await generateJson<ReviewPayload>({
            modelKey,
            route,
            requestId,
            contents:
                `Monte uma revisao rapida sobre "${topic}". Retorne JSON valido, sem markdown. ` +
                'overview deve ter 2 ou 3 frases. essentials deve ter de 4 a 6 pontos. ' +
                'mistakes deve listar erros comuns e tips deve listar dicas praticas.',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    overview: { type: Type.STRING },
                    essentials: { type: Type.ARRAY, items: { type: Type.STRING } },
                    mistakes: { type: Type.ARRAY, items: { type: Type.STRING } },
                    tips: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['overview', 'essentials', 'mistakes', 'tips'],
            },
            validator: validateReviewPayload,
        });

        res.json({ ok: true, review, model, requestedModel: modelKey, attemptedModels });
    } catch (error) {
        sendAiError(res, route, primaryModel, 'gerar revisao', error);
    }
});

app.post('/api/generate-exercises', async (req, res) => {
    const route = '/api/generate-exercises';
    const modelKey: ModelKey = 'flash';
    const requestId = String(res.locals.requestId || 'unknown');
    const primaryModel = MODEL_CANDIDATES[modelKey][0];

    try {
        const topic = parseBodyTopic(req.body?.topic);

        const { data: exercises, model, attemptedModels } = await generateJson<ExercisePayload>({
            modelKey,
            route,
            requestId,
            contents:
                `Gere 3 exercicios dissertativos sobre "${topic}". Retorne JSON valido, sem markdown. ` +
                'Cada exercicio deve ter title, statement, hint, steps e answer. ' +
                'Os exercicios devem ter nivel progressivo e steps claros para resolucao.',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    intro: { type: Type.STRING },
                    exercises: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                statement: { type: Type.STRING },
                                hint: { type: Type.STRING },
                                steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                                answer: { type: Type.STRING },
                            },
                            required: ['title', 'statement', 'hint', 'steps', 'answer'],
                        },
                    },
                },
                required: ['intro', 'exercises'],
            },
            validator: validateExercisesPayload,
        });

        res.json({ ok: true, exercises, model, requestedModel: modelKey, attemptedModels });
    } catch (error) {
        sendAiError(res, route, primaryModel, 'gerar exercicios', error);
    }
});

app.post('/api/chat', async (req, res) => {
    const route = '/api/chat';
    const requestId = String(res.locals.requestId || 'unknown');
    const requestedModel = parseModelKey(req.body?.model);
    const primaryModel = MODEL_CANDIDATES[requestedModel][0];

    try {
        const message = requireNonEmptyString(req.body?.message, 'message');
        const history = Array.isArray(req.body?.history) ? req.body.history : [];

        const systemInstruction =
            'You are a patient math tutor for Brazilian students. ' +
            'Keep the explanation simple, structured and encouraging. ' +
            'Show numbered steps when solving exercises. ' +
            'Use plain text or short markdown lists only. ' +
            'Avoid raw LaTeX unless the student explicitly asks for it.';

        const contents = [
            ...history,
            { role: 'user', parts: [{ text: message }] },
        ];

        const { text, model, attemptedModels } = await generateText({
            modelKey: requestedModel,
            route,
            requestId,
            contents,
            systemInstruction,
        });

        res.json({ ok: true, text, model, requestedModel, attemptedModels });
    } catch (error) {
        sendAiError(res, route, primaryModel, 'processar mensagem', error);
    }
});

app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!error) {
        next();
        return;
    }

    const requestId = String(res.locals.requestId || 'unknown');
    const detail = error instanceof Error ? error.message : String(error);
    const isJsonBodyError =
        detail.includes('JSON') ||
        (isRecord(error) && error.type === 'entity.parse.failed');

    if ((req.path.startsWith('/api') || req.path === '/login') && isJsonBodyError) {
        const diagnostics: AiDiagnostics = {
            requestId,
            route: req.path,
            provider,
            envVar: ENV_VAR_NAME,
            envPresent: Boolean(apiKey),
            model: MODELS.flash,
            errorType: 'validation',
            detail,
        };

        console.error(`[${requestId}] invalid JSON request body`);
        console.error(error);

        res.status(400).json({
            ok: false,
            error: 'Invalid JSON request body.',
            diagnostics,
        });
        return;
    }

    next(error);
});

app.use('/api', (_req, res) => {
    res.status(404).json({
        ok: false,
        error: 'API route not found.',
    });
});

[
    { route: '/css', dir: path.join(__dirname, 'css') },
    { route: '/js', dir: path.join(__dirname, 'js') },
    { route: '/vendor', dir: path.join(__dirname, 'vendor') },
    { route: '/content', dir: path.join(__dirname, 'content') },
    { route: '/ferramentas', dir: path.join(__dirname, 'ferramentas') },
].forEach(({ route, dir }) => {
    app.use(route, requireAssetAuth, express.static(dir));
});

app.get('/metadata.json', requireAssetAuth, (_req, res) => {
    res.sendFile(path.join(__dirname, 'metadata.json'));
});

app.get('*', async (req, res, next) => {
    if (path.extname(req.path)) {
        res.status(404).type('text/plain; charset=utf-8').send(`Asset not found: ${req.path}`);
        return;
    }

    try {
        const user = await resolveRequestAuth(req);
        res.redirect(user ? '/app' : '/login');
    } catch (error) {
        next(error);
    }
});

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;

let httpServer: ReturnType<typeof app.listen> | null = null;

async function shutdown(signal: string) {
    console.info(`[shutdown] received ${signal}`);

    if (httpServer) {
        await new Promise<void>((resolve, reject) => {
            httpServer?.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        }).catch((error) => {
            console.error('[shutdown] failed to close HTTP server', error);
        });
    }

    await closeDatabasePool().catch((error) => {
        console.error('[shutdown] failed to close database pool', error);
    });

    process.exit(0);
}

async function bootstrap() {
    const privateConfig = getPrivateAppConfigStatus();
    const databaseStatus = getDatabaseStatus();

    if (!privateConfig.ready) {
        console.error('[config] missing or invalid critical environment variables', privateConfig);
        throw new Error(
            `Missing or invalid critical environment variables: ${[...privateConfig.missing, ...privateConfig.invalid].join(', ')}`,
        );
    }

    if (privateConfig.warnings.length) {
        console.warn(`[config] optional environment variables missing: ${privateConfig.warnings.join(', ')}`);
        console.warn('[config] AI features will stay in fallback mode until the provider key is configured.');
    }

    if (databaseStatus.configured) {
        await ensureDatabaseReady();
        await destroyExpiredSessions();
        setInterval(() => {
            void destroyExpiredSessions().catch((error) => {
                console.error('[auth] failed to clean expired sessions', error);
            });
        }, 1000 * 60 * 30).unref();
    }

    httpServer = app.listen(port, '0.0.0.0', () => {
        console.log(`Server running at http://localhost:${port}`);
        console.log(`AI provider: ${provider}`);
        console.log(`Default model: ${MODELS.flash}`);
        console.log(`Env ${ENV_VAR_NAME}: ${apiKey ? 'present' : 'missing'}`);
        console.log(`Private auth ready: ${privateConfig.ready ? 'yes' : 'no'}`);
        if (!privateConfig.ready) {
            console.log(`Missing auth env: ${privateConfig.missing.join(', ') || 'none'}`);
            console.log(`Invalid auth env: ${privateConfig.invalid.join(', ') || 'none'}`);
        }
    });
}

bootstrap().catch((error) => {
    console.error('Failed to bootstrap server.', error);
    process.exit(1);
});

['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, () => {
        void shutdown(signal);
    });
});
