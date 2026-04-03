/**
 * Decoupled AI provider abstraction.
 * Currently wraps Google Gemini but designed to swap providers easily.
 *
 * To switch provider later:
 * 1. Implement a new class that satisfies AiProvider interface
 * 2. Change createProvider() to return the new implementation
 * 3. No changes needed in routes or prompt-builder
 */

export interface AiMessage {
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
}

export interface AiGenerateOptions {
    systemInstruction: string;
    contents: AiMessage[] | string;
    modelKey?: string;
}

export interface AiGenerateResult {
    text: string;
    model: string;
    provider: string;
}

export interface AiProvider {
    name: string;
    generate(options: AiGenerateOptions): Promise<AiGenerateResult>;
}

/**
 * Provider configuration type.
 * Ready for future providers like Groq, OpenAI, Anthropic, local models, etc.
 */
export interface ProviderConfig {
    provider: 'gemini' | 'groq' | 'openai' | 'custom';
    apiKey: string;
    defaultModel?: string;
    baseUrl?: string;
}

/**
 * Create a provider config from environment.
 * Currently defaults to Gemini, but ready for extension.
 */
export function getProviderConfigFromEnv(): ProviderConfig {
    return {
        provider: 'gemini',
        apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || '',
        defaultModel: 'gemini-2.5-flash',
    };
}
