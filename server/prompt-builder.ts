/**
 * Prompt builder for contextual AI.
 * Assembles the final system instruction + context based on module or general mode.
 */

import { type ModuleConfig, GENERAL_SYSTEM_PROMPT } from './modules-registry.ts';
import {
    type RagChunk,
    type RetrievalResult,
    retrieveModuleContext,
    retrieveGeneralContext,
    formatChunksAsContext,
    MIN_MODULE_RELEVANCE,
} from './rag.ts';

export type ChatMode = 'module_context' | 'general_fallback';

export interface BuiltPrompt {
    systemInstruction: string;
    mode: ChatMode;
    sources: Array<{ file: string; section: string }>;
    moduleSlug: string | null;
    moduleTitle: string | null;
    relevanceScore: number;
}

/**
 * Build the final prompt for a contextual chat request.
 *
 * Decision flow:
 * 1. If a module is provided, retrieve module-specific chunks
 * 2. If relevance score >= MIN_MODULE_RELEVANCE, use module context
 * 3. Otherwise, fall back to general AI with cross-module retrieval
 */
export function buildContextualPrompt(
    question: string,
    module: ModuleConfig | null,
    allModules: ModuleConfig[],
    sectionId?: string,
): BuiltPrompt {
    // Try module-specific context first
    if (module) {
        const retrieval = retrieveModuleContext(module, question);

        if (retrieval.relevanceScore >= MIN_MODULE_RELEVANCE && retrieval.chunks.length > 0) {
            return buildModulePrompt(module, retrieval, question, sectionId);
        }

        // Low relevance within module — try general with module hint
        const generalRetrieval = retrieveGeneralContext(allModules, question);

        if (generalRetrieval.relevanceScore >= MIN_MODULE_RELEVANCE && generalRetrieval.chunks.length > 0) {
            return buildGeneralPromptWithContext(generalRetrieval, module);
        }

        // No good context anywhere — pure general fallback
        return buildPureGeneralPrompt(module);
    }

    // No module specified — general mode
    const generalRetrieval = retrieveGeneralContext(allModules, question);

    if (generalRetrieval.relevanceScore >= MIN_MODULE_RELEVANCE && generalRetrieval.chunks.length > 0) {
        return buildGeneralPromptWithContext(generalRetrieval, null);
    }

    return buildPureGeneralPrompt(null);
}

function buildModulePrompt(
    module: ModuleConfig,
    retrieval: RetrievalResult,
    question: string,
    sectionId?: string,
): BuiltPrompt {
    const context = formatChunksAsContext(retrieval.chunks);

    const sectionHint = sectionId
        ? `\nO aluno está na seção "${sectionId}" do módulo.`
        : '';

    const systemInstruction = [
        module.systemPrompt,
        '',
        `=== CONTEXTO DO MATERIAL DE ESTUDO ===`,
        context,
        `=== FIM DO CONTEXTO ===`,
        sectionHint,
        '',
        `Use o contexto acima para fundamentar sua resposta. Não copie o material literalmente — explique com suas palavras de forma didática.`,
    ].join('\n');

    return {
        systemInstruction,
        mode: 'module_context',
        sources: retrieval.chunks.map((c) => ({ file: c.file, section: c.section })),
        moduleSlug: module.slug,
        moduleTitle: module.title,
        relevanceScore: retrieval.relevanceScore,
    };
}

function buildGeneralPromptWithContext(
    retrieval: RetrievalResult,
    hintModule: ModuleConfig | null,
): BuiltPrompt {
    const context = formatChunksAsContext(retrieval.chunks);

    const moduleHint = hintModule
        ? `\nO aluno estava estudando o módulo "${hintModule.title}", mas a pergunta parece ir além desse módulo.`
        : '';

    const systemInstruction = [
        GENERAL_SYSTEM_PROMPT,
        moduleHint,
        '',
        `=== CONTEXTO RELEVANTE DO MATERIAL ===`,
        context,
        `=== FIM DO CONTEXTO ===`,
        '',
        `Use o contexto acima quando pertinente. Se a pergunta não for coberta pelo material, responda com seu conhecimento geral de matemática.`,
    ].join('\n');

    return {
        systemInstruction,
        mode: 'general_fallback',
        sources: retrieval.chunks.map((c) => ({ file: c.file, section: c.section })),
        moduleSlug: hintModule?.slug ?? null,
        moduleTitle: hintModule?.title ?? null,
        relevanceScore: retrieval.relevanceScore,
    };
}

function buildPureGeneralPrompt(hintModule: ModuleConfig | null): BuiltPrompt {
    const moduleHint = hintModule
        ? `\nO aluno estava estudando o módulo "${hintModule.title}".`
        : '';

    return {
        systemInstruction: GENERAL_SYSTEM_PROMPT + moduleHint,
        mode: 'general_fallback',
        sources: [],
        moduleSlug: hintModule?.slug ?? null,
        moduleTitle: hintModule?.title ?? null,
        relevanceScore: 0,
    };
}
