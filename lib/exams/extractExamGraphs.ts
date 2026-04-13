import type { ExamGraphAsset } from '../../src/exam/imported/contracts';
import type { ParsedExamMarkdown } from './parseExamMarkdown';

export function extractExamGraphs({
    examId,
    imagePath,
    parsed,
}: {
    examId: string;
    imagePath: string;
    parsed: ParsedExamMarkdown;
}) {
    const graphAssets: ExamGraphAsset[] = [];

    for (const question of parsed.questions) {
        if (!question.graphData) continue;

        const type = String(question.graphData.type || '').toLowerCase();
        const graphType =
            type === 'line' || type === 'parabola' || type === 'axes'
                ? (type as ExamGraphAsset['graphType'])
                : 'custom';

        graphAssets.push({
            id: `${examId}-${question.id}-graph`,
            examId,
            questionId: question.id,
            sourceImagePath: imagePath,
            graphType,
            renderMode: 'svg',
            reconstructed: true,
            payload: question.graphData,
        });
    }

    return graphAssets;
}
