import katex from 'katex';
import { buildTimeHighlights, formatReportDateTime, type ExamReport } from './report';
import { formatDurationLong } from './timing';

function renderReportContent(value: string) {
    if (!value) return '';
    
    // First, escape regular HTML characters to prevent XSS/broken tags
    const escaped = String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    // Then, find LaTeX blocks ($...$) and render them
    return escaped.replace(/\$([^\$]+)\$/g, (_, tex) => {
        try {
            return katex.renderToString(tex, {
                throwOnError: false,
                output: 'html',
                displayMode: false
            });
        } catch (e) {
            return `$${tex}$`;
        }
    });
}

function buildList(items: string[]) {
    if (!items.length) return '<p class="muted">Nao ha itens registrados nesta secao.</p>';
    return `<ul>${items.map((item) => `<li>${renderReportContent(item)}</li>`).join('')}</ul>`;
}

export function buildExamReportPrintHtml(report: ExamReport) {
    const timeHighlights = buildTimeHighlights(report);

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${renderReportContent(report.subtitle)} - ${renderReportContent(report.title)} - Relatorio</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.44/dist/katex.min.css" integrity="sha384-V84MAkVfk9ZfAdy9wZas94f83KAbu4K42K/672R8VL7F4WRE/57r8918u0V0B+zT" crossorigin="anonymous">
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { 
        margin: 0; 
        font-family: "Segoe UI", system-ui, -apple-system, sans-serif; 
        color: #1a1f26; 
        background: #fff;
        font-size: 14px;
        line-height: 1.5;
    }
    main { display: flex; flex-direction: column; gap: 24px; }
    h1, h2, h3 { margin: 0; font-weight: 700; color: #0f172a; }
    h1 { font-size: 26px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 12px; }
    h2 { font-size: 18px; margin-top: 12px; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; }
    h3 { font-size: 15px; margin-bottom: 4px; }
    p, li { margin: 0 0 8px; }
    
    section { 
        display: block;
        page-break-inside: avoid;
        border: 1px solid #e2e8f0; 
        border-radius: 12px; 
        padding: 20px;
        background: #fff;
    }
    
    .header-section { border: none; padding: 0; border-radius: 0; }
    .eyebrow { font-size: 11px; text-transform: uppercase; font-weight: 600; color: #64748b; margin-bottom: 4px; display: block; }
    
    .grid { display: grid; gap: 12px; grid-template-columns: repeat(2, 1fr); margin-top: 12px; }
    .triple { display: grid; gap: 12px; grid-template-columns: repeat(3, 1fr); margin-top: 12px; }
    .card { 
        border: 1px solid #f1f5f9; 
        border-radius: 8px; 
        padding: 10px 14px; 
        background: #f8fafc; 
    }
    .card strong { display: block; font-size: 11px; color: #64748b; text-transform: uppercase; margin-bottom: 2px; }
    .card p { margin: 0; font-weight: 600; font-size: 14px; }
    
    .meta { color: #64748b; font-size: 13px; margin-bottom: 4px; }
    .question, .topic { 
        border-top: 1px solid #f1f5f9; 
        padding-top: 16px; 
        margin-top: 16px; 
        page-break-inside: avoid;
    }
    .question:first-of-type, .topic:first-of-type { border-top: none; padding-top: 0; margin-top: 0; }
    
    .pill { 
        display: inline-block; 
        padding: 4px 10px; 
        border-radius: 6px; 
        background: #f1f5f9; 
        font-size: 11px; 
        font-weight: 600; 
        margin-right: 6px; 
        margin-bottom: 8px;
        color: #475569;
    }
    .status-correct { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .status-partial { background: #fef9c3; color: #854d0e; border: 1px solid #fef08a; }
    .status-incorrect { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .status-blank { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
    
    .muted { color: #64748b; }
    .small { font-size: 12px; }
    ul { padding-left: 20px; list-style-type: square; }
    li { margin-bottom: 4px; }
    
    .explanation-box { background: #fdfcf8; border: 1px solid #f2e9d5; padding: 12px; border-radius: 8px; margin-top: 10px; }
    
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <main>
    <section class="header-section">
      <span class="eyebrow">Relatorio de Desempenho Academico</span>
      <h1>${renderReportContent(report.subtitle)} - ${renderReportContent(report.title)}</h1>
      <p class="meta">${renderReportContent(report.discipline)} · ${renderReportContent(report.moduleLabel)} · ${renderReportContent(report.semester)} · ${renderReportContent(report.typeLabel)}</p>
      <div class="grid">
        <div class="card"><strong>Data de realizacao</strong><p>${renderReportContent(formatReportDateTime(report.summary.completedAt || report.summary.generatedAt))}</p></div>
        <div class="card"><strong>Tempo total de prova</strong><p>${renderReportContent(timeHighlights.totalTimeLabel)}</p></div>
      </div>
    </section>

    <section>
      <h2>Resumo de Performance</h2>
      <div class="triple">
        <div class="card"><strong>Questoes</strong><p>${report.summary.totalQuestions}</p></div>
        <div class="card"><strong>Respondidas</strong><p>${report.summary.answeredCount}</p></div>
        <div class="card"><strong>Acertos</strong><p>${report.summary.correctCount}</p></div>
        <div class="card"><strong>Parciais</strong><p>${report.summary.partialCount}</p></div>
        <div class="card"><strong>Erros</strong><p>${report.summary.incorrectCount}</p></div>
        <div class="card"><strong>Aproveitamento</strong><p>${(report.summary.performanceRatio * 100).toFixed(1)}%</p></div>
        <div class="card"><strong>Media/Questao</strong><p>${renderReportContent(timeHighlights.averageTimeLabel)}</p></div>
        <div class="card"><strong>Maior Gargalo</strong><p>${renderReportContent(timeHighlights.slowestQuestionLabel)}</p></div>
        <div class="card"><strong>Assunto mais Lento</strong><p>${renderReportContent(timeHighlights.slowestTopicLabel)}</p></div>
      </div>
    </section>

    <section>
      <h2>Analise por Assuntos</h2>
      ${report.topics
          .map(
              (topic) => `
        <div class="topic">
          <h3>${renderReportContent(topic.label)}</h3>
          <p class="meta">Desempenho: ${(topic.performanceRatio * 100).toFixed(1)}% · Tempo total: ${renderReportContent(formatDurationLong(topic.totalTimeMs))}</p>
          <p class="small">Acertos: ${topic.correctCount} | Parciais: ${topic.partialCount} | Erros: ${topic.incorrectCount} | Em branco: ${topic.blankCount}</p>
        </div>`,
          )
          .join('')}
    </section>

    <section>
      <h2>Detalhamento por Questao</h2>
      ${report.questions
          .map(
              (question) => `
        <div class="question">
          <div>
            <span class="pill status-${question.status}">${renderReportContent(question.statusLabel)}</span>
            ${question.topics.map((topic) => `<span class="pill">${renderReportContent(topic)}</span>`).join('')}
          </div>
          <h3>Questao ${question.questionNumber}: ${renderReportContent(question.title)}</h3>
          <p class="small muted">${renderReportContent(question.shortPrompt)}</p>
          <p><strong>Tempo gasto:</strong> ${renderReportContent(question.timeLabel)}</p>
          <p><strong>Sua resposta:</strong> ${renderReportContent(question.studentAnswer)}</p>
          <p><strong>Gabarito oficial:</strong> ${renderReportContent(question.correctAnswer)}</p>
          
          <div class="explanation-box">
            <p><strong>Resolucao comentada:</strong></p>
            ${buildList(question.explanationSteps)}
            ${question.graphComment ? `<p style="margin-top:10px"><strong>Analise visual:</strong> ${renderReportContent(question.graphComment)}</p>` : ''}
          </div>
          <p style="margin-top:8px"><strong>Dica de estudo:</strong> ${renderReportContent(question.studyTip)}</p>
          ${question.scratchpad ? `<p class="small muted" style="margin-top:8px; font-style: italic"><strong>Rascunho utilizado:</strong> ${renderReportContent(question.scratchpad)}</p>` : ''}
        </div>`,
          )
          .join('')}
    </section>

    <section>
      <h2>Diagnostico Pedagogico (IA)</h2>
      ${
          report.aiFeedback
              ? `
        <div style="margin-bottom: 20px">
          <p>${renderReportContent(report.aiFeedback.overview)}</p>
        </div>
        
        <div class="grid">
          <div>
            <h3>Pontos Fortes</h3>
            ${buildList(report.aiFeedback.strengths)}
          </div>
          <div>
            <h3>Onde Melhorar</h3>
            ${buildList(report.aiFeedback.focusAreas)}
          </div>
        </div>
        
        <div style="margin-top: 20px">
            <h3>Padroes de Erro Identificados</h3>
            ${buildList(report.aiFeedback.errorPatterns)}
            
            <h3>Plano de Revisao Sugerido</h3>
            ${buildList(report.aiFeedback.studyPlan)}
        </div>
        
        <p style="margin-top: 20px; font-style: italic; color: #0f172a; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 12px;">
            ${renderReportContent(report.aiFeedback.encouragement)}
        </p>
      `
              : '<p class="muted">A analise detalhada da IA ainda nao está disponível para este relatório.</p>'
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

    // Wait for the window to finish loading and for fonts/scripts to be ready
    await new Promise((resolve) => {
        printWindow.onload = () => {
            // Check for fonts as well, as they are crucial for KaTeX symbols
            if ('fonts' in document) {
                (document as any).fonts.ready.then(resolve);
            } else {
                window.setTimeout(resolve, 800);
            }
        };
        // Fallback if onload doesn't fire (sometimes happens with document.write in some browsers)
        window.setTimeout(resolve, 2000);
    });

    printWindow.focus();
    printWindow.print();
}
