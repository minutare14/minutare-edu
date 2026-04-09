import React from 'react';

interface SidebarProps {
  questions: Array<{ id: string; number: number; completed: boolean; flagged?: boolean }>;
  activeQuestionId: string;
  onSelectQuestion: (id: string) => void;
}

export const ExamSidebar: React.FC<SidebarProps> = React.memo(({ questions, activeQuestionId, onSelectQuestion }) => {
  return (
    <aside className="exam-sidebar">
      <div>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--exam-text-light)', marginBottom: '1rem', textTransform: 'uppercase' }}>
          Mapa da Prova
        </h3>
        <div className="exam-nav-grid">
          {questions.map((q) => (
            <button
              key={q.id}
              onClick={() => onSelectQuestion(q.id)}
              className={`exam-nav-btn ${activeQuestionId === q.id ? 'active' : ''} ${q.completed ? 'completed' : ''} ${q.flagged ? 'flagged' : ''}`}
            >
              {q.number}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--exam-border)', paddingTop: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <div className="exam-nav-btn completed" style={{ width: 12, height: 12, pointerEvents: 'none' }}></div>
            <span>Respondida</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <div className="exam-nav-btn" style={{ width: 12, height: 12, pointerEvents: 'none' }}></div>
            <span>Pendente</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <div className="exam-nav-btn active" style={{ width: 12, height: 12, pointerEvents: 'none' }}></div>
            <span>Atual</span>
          </div>
        </div>
      </div>
    </aside>
  );
});
