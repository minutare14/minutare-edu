import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ImportedExam } from '../../src/exam/imported/contracts';
import { extractExamGraphs } from './extractExamGraphs';
import { parseExamMarkdown } from './parseExamMarkdown';

async function validateFolderPair(folderPath: string, folderName: string) {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile());
    const markdownFile = files.find((entry) => entry.name.toLowerCase() === `${folderName.toLowerCase()}.md`);
    const imageFile = files.find((entry) => entry.name.toLowerCase() === `${folderName.toLowerCase()}.jpeg`);

    if (!markdownFile || !imageFile) {
        throw new Error(`A pasta ${folderName} precisa conter ${folderName}.MD e ${folderName}.jpeg.`);
    }

    return {
        markdownPath: path.join(folderPath, markdownFile.name),
        imagePath: path.join(folderPath, imageFile.name),
    };
}

export async function importLocalExam(folderPath: string): Promise<ImportedExam> {
    const folderName = path.basename(folderPath);
    const { markdownPath, imagePath } = await validateFolderPair(folderPath, folderName);
    const markdownRaw = await fs.readFile(markdownPath, 'utf8');
    const parsed = parseExamMarkdown(markdownRaw);
    const examId = parsed.metadata.id || folderName.toLowerCase();
    const graphAssets = extractExamGraphs({
        examId,
        imagePath,
        parsed,
    });

    return {
        id: examId,
        slug: parsed.metadata.slug || examId,
        title: parsed.metadata.title,
        sourceFolderName: folderName,
        markdownPath,
        imagePath,
        discipline: parsed.metadata.discipline,
        semester: parsed.metadata.semester,
        type: parsed.metadata.type,
        hasGraphs: parsed.metadata.hasGraphs || graphAssets.length > 0,
        graphAssets,
        questions: parsed.questions.map((question) => ({
            id: question.id,
            number: question.number,
            statement: question.statement,
            topics: question.topics,
            answerSchema: question.answerSchema,
            graphRef: graphAssets.find((asset) => asset.questionId === question.id)?.id || null,
        })),
    };
}
