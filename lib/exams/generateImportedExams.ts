import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ImportedExam } from '../../src/exam/imported/contracts';
import { importLocalExam } from './importLocalExam';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const sourceRoot = process.env.LOCAL_EXAMS_DIR || 'C:\\Users\\emano\\OneDrive\\Documentos\\Downloads\\PROVAS';
const publicRoot = path.join(projectRoot, 'public', 'exam-support');
const outputFile = path.join(projectRoot, 'src', 'exam', 'imported', 'generated.ts');

function toPosixPath(value: string) {
    return value.replace(/\\/g, '/');
}

async function ensureDirectory(dirPath: string) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function readExamFolders() {
    const entries = await fs.readdir(sourceRoot, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(sourceRoot, entry.name))
        .sort((left, right) => left.localeCompare(right));
}

async function copySupportImage(exam: ImportedExam) {
    const targetDir = path.join(publicRoot, exam.sourceFolderName);
    const targetPath = path.join(targetDir, path.basename(exam.imagePath));
    await ensureDirectory(targetDir);
    await fs.copyFile(exam.imagePath, targetPath);

    return `/exam-support/${exam.sourceFolderName}/${path.basename(exam.imagePath)}`;
}

function serializeGeneratedModule(exams: ImportedExam[]) {
    const graphAssets = exams.flatMap((exam) => exam.graphAssets || []);
    const serializedExams = JSON.stringify(exams, null, 4);
    const serializedGraphs = JSON.stringify(graphAssets, null, 4);

    return `import type { ExamGraphAsset, ImportedExam } from './contracts';

export const IMPORTED_EXAMS: ImportedExam[] = ${serializedExams} as ImportedExam[];

export const IMPORTED_GRAPH_ASSETS: ExamGraphAsset[] = ${serializedGraphs} as ExamGraphAsset[];
`;
}

async function main() {
    const folders = await readExamFolders();
    const importedExams: ImportedExam[] = [];

    for (const folderPath of folders) {
        const exam = await importLocalExam(folderPath);
        const publicImagePath = await copySupportImage(exam);
        importedExams.push({
            ...exam,
            publicImagePath,
        });
    }

    await ensureDirectory(path.dirname(outputFile));
    await fs.writeFile(outputFile, serializeGeneratedModule(importedExams), 'utf8');

    const relativeOutput = toPosixPath(path.relative(projectRoot, outputFile));
    console.log(`Imported ${importedExams.length} exams into ${relativeOutput}`);
}

void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
