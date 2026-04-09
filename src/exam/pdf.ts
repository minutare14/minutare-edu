import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getGraphExportMarkup } from './graphs';
import { buildTimeHighlights, formatReportDateTime, type ExamReport } from './report';
import { formatDurationLong } from './timing';

function sanitizeText(value: string) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/[^\S\r\n]+/g, ' ')
        .trim();
}

function writeWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 16) {
    const lines = doc.splitTextToSize(sanitizeText(text) || '-', maxWidth);
    doc.text(lines, x, y);
    return y + lines.length * lineHeight;
}

function ensureSpace(doc: jsPDF, y: number, requiredHeight: number, margin: number) {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + requiredHeight <= pageHeight - margin) return y;
    doc.addPage();
    return margin;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number, margin: number) {
    const nextY = ensureSpace(doc, y, 42, margin);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title, margin, nextY);
    doc.setDrawColor(223, 230, 237);
    doc.line(margin, nextY + 8, doc.internal.pageSize.getWidth() - margin, nextY + 8);
    return nextY + 26;
}

function buildFileName(report: ExamReport) {
    const slug = `${report.examId}-tentativa-${report.attemptNumber}`.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
    return `${slug}.pdf`;
}

async function svgMarkupToPngDataUrl(svgMarkup: string, width: number, height: number) {
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    try {
        const image = new Image();
        image.decoding = 'async';

        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error('graph render failed'));
            image.src = url;
        });

        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('canvas unavailable');
        }

        context.fillStyle = '#fffdf8';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        return canvas.toDataURL('image/png');
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function exportExamReportPdf(report: ExamReport) {
    const doc = new jsPDF({
        unit: 'pt',
        format: 'a4',
        compress: true,
    });

    const margin = 44;
    const contentWidth = doc.internal.pageSize.getWidth() - margin * 2;
    let cursorY = margin;
    const timeHighlights = buildTimeHighlights(report);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(95, 105, 117);
    doc.text('RELATORIO DE PROVA', margin, cursorY);

    cursorY += 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(31, 37, 48);
    cursorY = writeWrappedText(doc, `${report.subtitle} - ${report.title}`, margin, cursorY, contentWidth, 26);

    cursorY += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(95, 105, 117);
    cursorY = writeWrappedText(
        doc,
        `${report.discipline} | ${report.moduleLabel} | ${report.semester} | ${report.typeLabel} | Tentativa ${report.attemptNumber}`,
        margin,
        cursorY,
        contentWidth,
        15,
    );

    cursorY += 14;
    autoTable(doc, {
        startY: cursorY,
        theme: 'grid',
        margin: { left: margin, right: margin },
        styles: {
            font: 'helvetica',
            fontSize: 10,
            cellPadding: 8,
            textColor: [31, 37, 48],
            lineColor: [223, 230, 237],
        },
        headStyles: {
            fillColor: [34, 58, 90],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
        },
        body: [
            ['Tentativa', String(report.attemptNumber), 'Data/hora', formatReportDateTime(report.summary.completedAt || report.summary.generatedAt)],
            ['Tempo total', timeHighlights.totalTimeLabel, 'Tempo medio', timeHighlights.averageTimeLabel],
            ['Aproveitamento', `${(report.summary.performanceRatio * 100).toFixed(1)}%`, 'Questao mais lenta', timeHighlights.slowestQuestionLabel],
            ['Assunto mais lento', timeHighlights.slowestTopicLabel, 'Respondidas', String(report.summary.answeredCount)],
        ],
    });
    cursorY = (doc as any).lastAutoTable.finalY + 22;

    cursorY = drawSectionTitle(doc, 'Resumo Geral', cursorY, margin);
    autoTable(doc, {
        startY: cursorY,
        theme: 'grid',
        margin: { left: margin, right: margin },
        styles: {
            font: 'helvetica',
            fontSize: 10,
            cellPadding: 8,
            textColor: [31, 37, 48],
            lineColor: [223, 230, 237],
        },
        body: [
            ['Questoes totais', String(report.summary.totalQuestions)],
            ['Respondidas', String(report.summary.answeredCount)],
            ['Acertos', String(report.summary.correctCount)],
            ['Parciais', String(report.summary.partialCount)],
            ['Erros', String(report.summary.incorrectCount)],
            ['Em branco', String(report.summary.blankCount)],
        ],
    });
    cursorY = (doc as any).lastAutoTable.finalY + 20;

    cursorY = drawSectionTitle(doc, 'Analise por Assunto', cursorY, margin);
    autoTable(doc, {
        startY: cursorY,
        theme: 'grid',
        margin: { left: margin, right: margin },
        styles: {
            font: 'helvetica',
            fontSize: 9,
            cellPadding: 7,
            textColor: [31, 37, 48],
            lineColor: [223, 230, 237],
            overflow: 'linebreak',
        },
        headStyles: {
            fillColor: [63, 139, 127],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
        },
        head: [['Assunto', 'Aproveitamento', 'Tempo total', 'Acertos', 'Parciais', 'Erros', 'Em branco']],
        body: report.topics.map((topic) => [
            sanitizeText(topic.label),
            `${(topic.performanceRatio * 100).toFixed(1)}%`,
            formatDurationLong(topic.totalTimeMs),
            String(topic.correctCount),
            String(topic.partialCount),
            String(topic.incorrectCount),
            String(topic.blankCount),
        ]),
    });
    cursorY = (doc as any).lastAutoTable.finalY + 20;

    cursorY = drawSectionTitle(doc, 'Analise da IA', cursorY, margin);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(31, 37, 48);

    if (report.aiFeedback) {
        cursorY = writeWrappedText(doc, report.aiFeedback.overview, margin, cursorY, contentWidth, 16) + 12;

        const sections: Array<[string, string[]]> = [
            ['Pontos fortes', report.aiFeedback.strengths],
            ['Onde melhorar', report.aiFeedback.focusAreas],
            ['Padroes de erro', report.aiFeedback.errorPatterns],
            ['Gestao de tempo', report.aiFeedback.timeInsights],
            ['Plano de revisao', report.aiFeedback.studyPlan],
        ];

        for (const [title, items] of sections) {
            cursorY = ensureSpace(doc, cursorY, 48, margin);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text(title, margin, cursorY);
            cursorY += 16;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            for (const item of items) {
                cursorY = ensureSpace(doc, cursorY, 32, margin);
                doc.text('\u2022', margin, cursorY);
                cursorY = writeWrappedText(doc, item, margin + 14, cursorY, contentWidth - 14, 14) + 4;
            }
            cursorY += 6;
        }

        cursorY = ensureSpace(doc, cursorY, 42, margin);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(11);
        cursorY = writeWrappedText(doc, report.aiFeedback.encouragement, margin, cursorY, contentWidth, 16) + 6;
    } else {
        cursorY = writeWrappedText(doc, 'A analise da IA ainda nao estava disponivel para esta tentativa.', margin, cursorY, contentWidth, 16) + 8;
    }

    cursorY = drawSectionTitle(doc, 'Analise por Questao', cursorY + 10, margin);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    for (const question of report.questions) {
        cursorY = ensureSpace(doc, cursorY, 120, margin);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, cursorY - 12, contentWidth, 24, 10, 10, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(31, 37, 48);
        doc.text(`Questao ${question.questionNumber} - ${sanitizeText(question.title)}`, margin + 10, cursorY + 4);
        cursorY += 24;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(95, 105, 117);
        cursorY = writeWrappedText(doc, sanitizeText(question.shortPrompt), margin, cursorY, contentWidth, 14) + 6;

        const metaRows = [
            `Status: ${question.statusLabel}`,
            `Pontuacao: ${question.score}/${question.maxScore}`,
            `Dificuldade: ${question.difficultyLabel}`,
            `Tempo: ${question.timeLabel}`,
            `Assuntos: ${question.topics.join(', ') || 'Nao informado'}`,
            `Sua resposta: ${question.studentAnswer}`,
            `Resposta correta: ${question.correctAnswer}`,
        ];

        doc.setTextColor(31, 37, 48);
        for (const row of metaRows) {
            cursorY = ensureSpace(doc, cursorY, 22, margin);
            cursorY = writeWrappedText(doc, row, margin, cursorY, contentWidth, 14) + 2;
        }

        cursorY = ensureSpace(doc, cursorY, 40, margin);
        doc.setFont('helvetica', 'bold');
        doc.text('Resolucao comentada', margin, cursorY);
        cursorY += 16;
        doc.setFont('helvetica', 'normal');
        if (question.graphKey) {
            const graphAsset = getGraphExportMarkup(question.graphKey);
            if (graphAsset) {
                try {
                    const graphDataUrl = await svgMarkupToPngDataUrl(graphAsset.svgMarkup, graphAsset.width, graphAsset.height);
                    const targetWidth = Math.min(contentWidth, graphAsset.width * 0.72);
                    const targetHeight = (graphAsset.height / graphAsset.width) * targetWidth;
                    cursorY = ensureSpace(doc, cursorY, targetHeight + 26, margin);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Grafico da questao', margin, cursorY);
                    cursorY += 10;
                    doc.addImage(graphDataUrl, 'PNG', margin, cursorY, targetWidth, targetHeight, undefined, 'FAST');
                    cursorY += targetHeight + 12;
                    doc.setFont('helvetica', 'normal');
                } catch {
                    cursorY = ensureSpace(doc, cursorY, 24, margin);
                    cursorY = writeWrappedText(doc, 'Grafico nao foi incorporado ao PDF por falha de renderizacao do asset visual.', margin, cursorY, contentWidth, 14) + 4;
                }
            }
        }

        if (question.fields.length) {
            cursorY = ensureSpace(doc, cursorY, 40, margin);
            doc.setFont('helvetica', 'bold');
            doc.text('Campos avaliados', margin, cursorY);
            cursorY += 14;
            doc.setFont('helvetica', 'normal');
            question.fields.forEach((field) => {
                const fieldRow = `${field.label}: aluno ${field.studentAnswer} | esperado ${field.expectedAnswer} | nota ${field.score}/${field.maxScore}`;
                cursorY = ensureSpace(doc, cursorY, 24, margin);
                cursorY = writeWrappedText(doc, fieldRow, margin, cursorY, contentWidth, 14) + 2;
            });
        }

        question.explanationSteps.forEach((step) => {
            cursorY = ensureSpace(doc, cursorY, 24, margin);
            doc.text('\u2022', margin, cursorY);
            cursorY = writeWrappedText(doc, step, margin + 14, cursorY, contentWidth - 14, 14) + 2;
        });

        if (question.graphComment) {
            cursorY = ensureSpace(doc, cursorY, 24, margin);
            cursorY = writeWrappedText(doc, `Analise visual: ${question.graphComment}`, margin, cursorY, contentWidth, 14) + 4;
        }

        cursorY = ensureSpace(doc, cursorY, 24, margin);
        cursorY = writeWrappedText(doc, `O que revisar: ${question.studyTip}`, margin, cursorY, contentWidth, 14) + 4;

        if (question.scratchpad) {
            cursorY = ensureSpace(doc, cursorY, 24, margin);
            cursorY = writeWrappedText(doc, `Rascunho salvo: ${question.scratchpad}`, margin, cursorY, contentWidth, 14) + 4;
        }

        cursorY += 8;
    }

    doc.save(buildFileName(report));
}
