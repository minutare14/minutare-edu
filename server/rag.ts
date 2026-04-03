/**
 * Simple RAG engine based on markdown files.
 * Reads, parses, chunks, and retrieves content by module.
 */

import fs from 'fs';
import path from 'path';
import { type ModuleConfig } from './modules-registry.ts';

export interface RagChunk {
    moduleSlug: string;
    file: string;
    section: string;
    content: string;
    index: number;
}

const chunkCache = new Map<string, RagChunk[]>();
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Parse a markdown file into section-based chunks.
 * Splits on H3/H4 headers to keep semantic coherence.
 */
function parseMarkdownIntoChunks(filePath: string, moduleSlug: string): RagChunk[] {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
        console.warn(`[rag] file not found: ${absolutePath}`);
        return [];
    }

    const raw = fs.readFileSync(absolutePath, 'utf-8');
    const filename = path.basename(filePath);
    const chunks: RagChunk[] = [];

    // Split on markdown headers (##, ###, ####)
    const sections = raw.split(/(?=^#{2,4}\s)/m).filter((s) => s.trim());

    for (const [index, section] of sections.entries()) {
        const content = section.trim();
        if (!content || content.length < 20) continue;

        // Extract section title from first line
        const titleMatch = content.match(/^#{2,4}\s+\**(.+?)\**\s*$/m);
        const sectionTitle = titleMatch
            ? titleMatch[1].replace(/[📘🧠📖📌🔍⚠️💡🧪🚀]/g, '').trim()
            : `Seção ${index + 1}`;

        // If a section is too long (>1500 chars), split into sub-chunks
        if (content.length > 1500) {
            const paragraphs = content.split(/\n{2,}/);
            let buffer = '';
            let subIndex = 0;

            for (const para of paragraphs) {
                if (buffer.length + para.length > 1200 && buffer.length > 100) {
                    chunks.push({
                        moduleSlug,
                        file: filename,
                        section: `${sectionTitle} (parte ${subIndex + 1})`,
                        content: buffer.trim(),
                        index: chunks.length,
                    });
                    buffer = '';
                    subIndex++;
                }
                buffer += (buffer ? '\n\n' : '') + para;
            }

            if (buffer.trim().length > 20) {
                chunks.push({
                    moduleSlug,
                    file: filename,
                    section: subIndex > 0 ? `${sectionTitle} (parte ${subIndex + 1})` : sectionTitle,
                    content: buffer.trim(),
                    index: chunks.length,
                });
            }
        } else {
            chunks.push({
                moduleSlug,
                file: filename,
                section: sectionTitle,
                content,
                index: chunks.length,
            });
        }
    }

    return chunks;
}

/**
 * Load and cache all chunks for a module.
 */
function loadModuleChunks(mod: ModuleConfig): RagChunk[] {
    const now = Date.now();
    const cacheKey = mod.slug;

    if (chunkCache.has(cacheKey) && now - cacheTimestamp < CACHE_TTL_MS) {
        return chunkCache.get(cacheKey)!;
    }

    const chunks: RagChunk[] = [];
    for (const filePath of mod.ragFiles) {
        chunks.push(...parseMarkdownIntoChunks(filePath, mod.slug));
    }

    chunkCache.set(cacheKey, chunks);
    cacheTimestamp = now;

    console.info(`[rag] loaded ${chunks.length} chunks for module "${mod.slug}" from ${mod.ragFiles.length} files`);
    return chunks;
}

/**
 * Normalize text for keyword matching: lowercase, remove accents, remove special chars.
 */
function normalizeForSearch(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Score a chunk against a query using keyword matching.
 * Returns a relevance score (higher = more relevant).
 */
function scoreChunk(chunk: RagChunk, queryTokens: string[]): number {
    const normalizedContent = normalizeForSearch(chunk.content);
    const normalizedSection = normalizeForSearch(chunk.section);
    let score = 0;

    for (const token of queryTokens) {
        if (token.length < 2) continue;

        // Exact word match in content
        const contentMatches = normalizedContent.split(token).length - 1;
        score += contentMatches * 2;

        // Match in section title (higher weight)
        if (normalizedSection.includes(token)) {
            score += 5;
        }
    }

    // Bonus for sections with definitions, examples, explanations
    const contentLower = normalizedContent;
    if (contentLower.includes('definic') || contentLower.includes('conceito')) score += 1;
    if (contentLower.includes('exemplo') || contentLower.includes('passo')) score += 1;
    if (contentLower.includes('erro') || contentLower.includes('cuidado')) score += 1;

    return score;
}

export interface RetrievalResult {
    chunks: RagChunk[];
    totalChunks: number;
    relevanceScore: number;
}

/**
 * Retrieve the most relevant chunks for a question within a specific module.
 */
export function retrieveModuleContext(
    mod: ModuleConfig,
    question: string,
    maxChunks = 5,
): RetrievalResult {
    const allChunks = loadModuleChunks(mod);
    if (allChunks.length === 0) {
        return { chunks: [], totalChunks: 0, relevanceScore: 0 };
    }

    const queryTokens = normalizeForSearch(question).split(' ').filter((t) => t.length >= 2);

    if (queryTokens.length === 0) {
        // No meaningful tokens — return first chunks as general context
        return {
            chunks: allChunks.slice(0, maxChunks),
            totalChunks: allChunks.length,
            relevanceScore: 0,
        };
    }

    const scored = allChunks
        .map((chunk) => ({ chunk, score: scoreChunk(chunk, queryTokens) }))
        .sort((a, b) => b.score - a.score);

    const topChunks = scored.slice(0, maxChunks).map((s) => s.chunk);
    const maxScore = scored[0]?.score ?? 0;

    return {
        chunks: topChunks,
        totalChunks: allChunks.length,
        relevanceScore: maxScore,
    };
}

/**
 * Retrieve context across ALL modules (for general fallback).
 * Used when the question doesn't match a specific module.
 */
export function retrieveGeneralContext(
    modules: ModuleConfig[],
    question: string,
    maxChunks = 4,
): RetrievalResult {
    const queryTokens = normalizeForSearch(question).split(' ').filter((t) => t.length >= 2);
    if (queryTokens.length === 0) {
        return { chunks: [], totalChunks: 0, relevanceScore: 0 };
    }

    const allScored: Array<{ chunk: RagChunk; score: number }> = [];

    for (const mod of modules) {
        const chunks = loadModuleChunks(mod);
        for (const chunk of chunks) {
            allScored.push({ chunk, score: scoreChunk(chunk, queryTokens) });
        }
    }

    allScored.sort((a, b) => b.score - a.score);

    const topChunks = allScored.slice(0, maxChunks).map((s) => s.chunk);
    const maxScore = allScored[0]?.score ?? 0;

    return {
        chunks: topChunks,
        totalChunks: allScored.length,
        relevanceScore: maxScore,
    };
}

/**
 * Format retrieved chunks into a context string for the AI prompt.
 */
export function formatChunksAsContext(chunks: RagChunk[]): string {
    if (chunks.length === 0) return '';

    return chunks
        .map((chunk, i) => [
            `--- Trecho ${i + 1} (${chunk.file} > ${chunk.section}) ---`,
            chunk.content,
        ].join('\n'))
        .join('\n\n');
}

/**
 * Minimum relevance score to consider module context useful.
 * Below this, the system falls back to general AI.
 */
export const MIN_MODULE_RELEVANCE = 3;
