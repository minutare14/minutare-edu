import { buildTimeHighlights, formatReportDateTime, type ExamReport } from './report';
import { formatDurationLong } from './timing';

function escapeHtml(value: string) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildList(items: string[]) {
    if (!items.length) return '<p>Nao ha itens registrados nesta secao.</p>';
    return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

export function buildExamReportPrintHtml(report: ExamReport) {
    const timeHighlights = buildTimeHighlights(report);

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(report.subtitle)} - ${escapeHtml(report.title)} - Relatorio</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: #1f2530; }
    main { display: grid; gap: 24px; }
    h1, h2, h3 { margin: 0 0 8px; }
    h1 { font-size: 24px; }
    h2 { font-size: 18px; margin-bottom: 12px; }
    h3 { font-size: 15px; }
    p, li { line-height: 1.55; }
    section { border: 1px solid #d8dde5; border-radius: 16px; padding: 18px; }
    .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #5f6975; }
    .grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .triple { display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .card { border: 1px solid #e4e7ec; border-radius: 14px; padding: 12px; background: #faf7f1; }
    .meta { color: #5f6975; font-size: 13px; }
    .question, .topic { border-top: 1px solid #e7e7e7; padding-top: 14px; margin-top: 14px; }
    .pill { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #edf2f7; font-size: 12px; font-weight: 700; margin-right: 6px; margin-top: 6px; }
    .status-correct { background: #dff5ef; color: #176557; }
    .status-partial { background: #fff1da; color: #8b5b17; }
    .status-incorrect { background: #fce4df; color: #8b2f23; }
    .status-blank { background: #edf2f7; color: #223a5a; }
    .muted { color: #5f6975; }
    .small { font-size: 12px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main>
    <section>
      <span class="eyebrow">Relatorio da prova</span>
      <h1>${escapeHtml(report.subtitle)} - ${escapeHtml(report.title)}</h1>
      <p class="meta">${escapeHtml(report.discipline)} · ${escapeHtml(report.moduleLabel)} · ${escapeHtml(report.semester)} · ${escapeHtml(report.typeLabel)}</p>
      <div class="grid">
        <div class="card"><strong>Data/hora</strong><p>${escapeHtml(formatReportDateTime(report.summary.completedAt || report.summary.generatedAt))}</p></div>
        <div class="card"><strong>Tempo total</strong><p>${escapeHtml(timeHighlights.totalTimeLabel)}</p></div>
      </div>
    </section>

    <section>
      <h2>Resumo geral</h2>
      <div class="triple">
        <div class="card"><strong>Total de questoes</strong><p>${report.summary.totalQuestions}</p></div>
        <div class="card"><strong>Respondidas</strong><p>${report.summary.answeredCount}</p></div>
        <div class="card"><strong>Corretas</strong><p>${report.summary.correctCount}</p></div>
        <div class="card"><strong>Parciais</strong><p>${report.summary.partialCount}</p></div>
        <div class="card"><strong>Incorretas</strong><p>${report.summary.incorrectCount}</p></div>
        <div class="card"><strong>Aproveitamento</strong><p>${(report.summary.performanceRatio * 100).toFixed(0)}%</p></div>
        <div class="card"><strong>Tempo medio por questao</strong><p>${escapeHtml(timeHighlights.averageTimeLabel)}</p></div>
        <div class="card"><strong>Questao mais demorada</strong><p>${escapeHtml(timeHighlights.slowestQuestionLabel)}</p></div>
        <div class="card"><strong>Assunto mais lento</strong><p>${escapeHtml(timeHighlights.slowestTopicLabel)}</p></div>
      </div>
    </section>

    <section>
      <h2>Analise por assunto</h2>
      ${report.topics
          .map(
              (topic) => `
        <div class="topic">
          <h3>${escapeHtml(topic.label)}</h3>
          <p class="meta">Aproveitamento ${(topic.performanceRatio * 100).toFixed(0)}% · Tempo total ${escapeHtml(formatDurationLong(topic.totalTimeMs))}</p>
          <p>Acertos: ${topic.correctCount} · Parciais: ${topic.partialCount} · Incorretas: ${topic.incorrectCount} · Em branco: ${topic.blankCount}</p>
        </div>`,
          )
          .join('')}
    </section>

    <section>
      <h2>Analise por questao</h2>
      ${report.questions
          .map(
              (question) => `
        <div class="question">
          <div>
            <span class="pill status-${question.status}">${escapeHtml(question.statusLabel)}</span>
            ${question.topics.map((topic) => `<span class="pill">${escapeHtml(topic)}</span>`).join('')}
          </div>
          <h3>Questao ${question.questionNumber} - ${escapeHtml(question.title)}</h3>
          <p class="small muted">${escapeHtml(question.shortPrompt)}</p>
          <p><strong>Tempo:</strong> ${escapeHtml(question.timeLabel)}</p>
          <p><strong>Resposta do aluno:</strong> ${escapeHtml(question.studentAnswer)}</p>
          <p><strong>Resposta correta:</strong> ${escapeHtml(question.correctAnswer)}</p>
          <p><strong>Resolucao:</strong></p>
          ${buildList(question.explanationSteps)}
          ${question.graphComment ? `<p><strong>Leitura do grafico:</strong> ${escapeHtml(question.graphComment)}</p>` : ''}
          <p><strong>O que revisar:</strong> ${escapeHtml(question.studyTip)}</p>
        </div>`,
          )
          .join('')}
    </section>

    <section>
      <h2>Analise da IA</h2>
      ${
          report.aiFeedback
              ? `
        <p>${escapeHtml(report.aiFeedback.overview)}</p>
        <h3>Pontos fortes</h3>
        ${buildList(report.aiFeedback.strengths)}
        <h3>Onde melhorar</h3>
        ${buildList(report.aiFeedback.focusAreas)}
        <h3>Padroes de erro</h3>
        ${buildList(report.aiFeedback.errorPatterns)}
        <h3>Gestao de tempo</h3>
        ${buildList(report.aiFeedback.timeInsights)}
        <h3>Plano de revisao</h3>
        ${buildList(report.aiFeedback.studyPlan)}
        <p><strong>Fechamento:</strong> ${escapeHtml(report.aiFeedback.encouragement)}</p>
      `
              : '<p>A analise da IA ainda nao foi carregada.</p>'
      }
    </section>
  </main>
</body>
</html>`;
}

export async function exportExamReportPdf(report: ExamReport) {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1080,height=900');
    if (!printWindow) {
        throw new Error('popup_blocked');
    }

    printWindow.document.open();
    printWindow.document.write(buildExamReportPrintHtml(report));
    printWindow.document.close();

    await new Promise((resolve) => window.setTimeout(resolve, 350));
    printWindow.focus();
    printWindow.print();
}
