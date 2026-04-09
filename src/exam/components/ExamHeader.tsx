import React from 'react';
import { TimerDisplay } from './TimerDisplay';

interface ExamHeaderProps {
  title: string;
  totalMs: number;
  questionMs: number;
  onFinish: () => void;
}

export const ExamHeader: React.FC<ExamHeaderProps> = React.memo(({ title, totalMs, questionMs, onFinish }) => {
  return (
    <header className="exam-header">
      <div className="exam-header-title">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="32" height="32" rx="8" fill="#1e293b"/>
          <path d="M10 16L14 20L22 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>{title}</span>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        <TimerDisplay label="Questão" ms={questionMs} />
        <TimerDisplay label="Total" ms={totalMs} />
        
        <button 
          onClick={onFinish}
          className="btn btn-primary"
          style={{ 
            backgroundColor: 'var(--exam-error)', 
            borderColor: 'var(--exam-error)',
            padding: '0.5rem 1.25rem',
            fontWeight: 600
          }}
        >
          Finalizar Prova
        </button>
      </div>
    </header>
  );
});
