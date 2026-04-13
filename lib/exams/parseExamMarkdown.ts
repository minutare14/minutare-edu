interface ParsedQuestionSection {
    id: string;
    number: string;
    topics: string[];
    statement: string;
    answerSchema: {
        hasScratchpad: boolean;
        hasOfficialAnswerField: boolean;
    };
    graphData?: Record<string, unknown> | null;
}

export interface ParsedExamMarkdown {
    metadata: {
        id: string;
        slug: string;
        title: string;
        discipline: string | null;
        semester: string | null;
        type: 'avaliacao' | 'lista' | 'simulado';
        hasGraphs: boolean;
    };
    questions: ParsedQuestionSection[];
}

function unwrapMarkdownWrapper(raw: string) {
    const normalized = raw.replace(/\r\n/g, '\n').trim();
    const wrappedMatch = normalized.match(/^:?\s*```md\s*([\s\S]*?)\s*```\s*(?:```)?\s*$/);
    return wrappedMatch ? wrappedMatch[1].trim() : normalized;
}

function extractFrontmatter(source: string) {
    const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!match) {
        throw new Error('Frontmatter ausente no markdown da prova.');
    }

    return {
        frontmatter: match[1],
        body: source.slice(match[0].length),
    };
}

function readScalar(frontmatter: string, key: string) {
    const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    if (!match) return null;

    return match[1].trim().replace(/^"(.*)"$/, '$1');
}

function readBoolean(frontmatter: string, key: string) {
    const value = readScalar(frontmatter, key);
    if (!value) return false;
    return value.toLowerCase() === 'true';
}

function splitQuestionSections(body: string) {
    const questionsMatch = body.match(/##\s+questions\s*([\s\S]*)$/i);
    if (!questionsMatch) {
        throw new Error('Secao ## questions ausente no markdown da prova.');
    }

    return questionsMatch[1]
        .split(/\n(?=###\s+)/)
        .map((section) => section.trim())
        .filter(Boolean);
}

function parseListMetadata(block: string) {
    const result: Record<string, string | string[]> = {};
    let activeListKey: string | null = null;

    for (const rawLine of block.split('\n')) {
        const line = rawLine.trim();
        if (!line) continue;

        const keyValueMatch = line.match(/^[-*]\s+([^:]+):\s*(.*)$/);
        if (keyValueMatch) {
            const [, rawKey, rawValue] = keyValueMatch;
            const key = rawKey.trim();
            const value = rawValue.trim();
            if (!value) {
                result[key] = [];
                activeListKey = key;
            } else {
                result[key] = value;
                activeListKey = null;
            }
            continue;
        }

        const listItemMatch = activeListKey ? line.match(/^[-*]\s+(.+)$/) : null;
        if (listItemMatch) {
            (result[activeListKey!] as string[]).push(listItemMatch[1].trim());
        }
    }

    return result;
}

function readSection(questionBlock: string, heading: string) {
    const marker = `#### ${heading}`;
    const startIndex = questionBlock.indexOf(marker);
    if (startIndex === -1) return null;

    const afterStart = questionBlock.slice(startIndex + marker.length).replace(/^\s*/, '');
    const endMatch = afterStart.match(/\n(?=####\s+|---\s*$)/);
    return (endMatch ? afterStart.slice(0, endMatch.index) : afterStart).trim();
}

function parseGraphJson(block: string | null) {
    if (!block) return null;

    const fencedJsonMatch = block.match(/```json\s*([\s\S]*?)\s*```/);
    const rawJson = fencedJsonMatch ? fencedJsonMatch[1] : block;

    try {
        return JSON.parse(rawJson);
    } catch {
        return null;
    }
}

function parseQuestionSection(section: string): ParsedQuestionSection {
    const metaEnd = section.search(/\n####\s+/);
    const metaBlock = metaEnd >= 0 ? section.slice(0, metaEnd).trim() : section;
    const metadata = parseListMetadata(metaBlock);

    const statement = readSection(section, 'enunciado');
    if (!statement) {
        throw new Error(`Enunciado ausente em ${String(metadata.id || 'questao sem id')}.`);
    }

    const answerSchemaBlock = readSection(section, 'answer_schema') || '';
    const answerSchemaMetadata = parseListMetadata(answerSchemaBlock);
    const graphJson = parseGraphJson(readSection(section, 'graph_json'));

    return {
        id: String(metadata.id || '').trim(),
        number: String(metadata.numero || '').trim(),
        topics: Array.isArray(metadata.assuntos) ? metadata.assuntos : [],
        statement,
        answerSchema: {
            hasScratchpad: String(answerSchemaMetadata.rascunho || '').toLowerCase() === 'true',
            hasOfficialAnswerField: String(answerSchemaMetadata.resposta_discursiva || '').toLowerCase() === 'true',
        },
        graphData: graphJson,
    };
}

export function parseExamMarkdown(rawMarkdown: string): ParsedExamMarkdown {
    const cleaned = unwrapMarkdownWrapper(rawMarkdown);
    const { frontmatter, body } = extractFrontmatter(cleaned);

    const questions = splitQuestionSections(body).map((section) => parseQuestionSection(section));
    const typeValue = (readScalar(frontmatter, 'tipo') || 'avaliacao').toLowerCase();
    const type =
        typeValue === 'lista' || typeValue === 'simulado'
            ? typeValue
            : 'avaliacao';

    return {
        metadata: {
            id: readScalar(frontmatter, 'id') || '',
            slug: readScalar(frontmatter, 'slug') || '',
            title: readScalar(frontmatter, 'titulo') || readScalar(frontmatter, 'title') || 'Prova importada',
            discipline: readScalar(frontmatter, 'disciplina'),
            semester: readScalar(frontmatter, 'semestre'),
            type,
            hasGraphs: readBoolean(frontmatter, 'possui_graficos'),
        },
        questions,
    };
}
