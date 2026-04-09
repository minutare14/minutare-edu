import React from 'react';
import { ContentRenderer } from '../content';
import { ExamAnswerArea } from './ExamAnswerArea';
import { ExamScratchpad } from './ExamScratchpad';

interface QuestionAreaProps {
  question: any;
  draft: any;
  onUpdateDraft: (qId: string, value: any) => void;
  onUpdateScratchpad: (qId: string, value: string) => void;
}

export const ExamQuestionArea: React.FC<QuestionAreaProps> = React.memo(({ 
  question, 
  draft, 
  onUpdateDraft,
  onUpdateScratchpad
}) => {
  return (
    <div className="exam-question-container">
      <div className="exam-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <span style={{ 
            background: 'var(--exam-primary)', 
            color: 'white', 
            padding: '0.25rem 0.75rem', 
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 700
          }}>
            QUESTÃO {question.number}
          </span>
          <span style={{ color: 'var(--exam-text-light)', fontSize: '0.875rem', fontWeight: 500 }}>
            • {question.points} pontos
          </span>
        </div>
        
        <div className="question-text-area">
          <ContentRenderer blocks={question.content} />
        </div>
      </div>

      <ExamAnswerArea 
        question={question} 
        draft={draft} 
        onUpdateDraft={onUpdateDraft} 
      />

      <ExamScratchpad 
        questionId={question.id}
        initialValue={draft?.scratchpad || ''}
        onUpdate={onUpdateScratchpad}
      />
    </div>
  );
});
