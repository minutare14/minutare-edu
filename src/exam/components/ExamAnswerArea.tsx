import React, { useState, useEffect, useCallback } from 'react';
import { MathText } from '../content';

interface AnswerAreaProps {
  question: any;
  draft: any;
  onUpdateDraft: (qId: string, value: any) => void;
}

export const ExamAnswerArea: React.FC<AnswerAreaProps> = React.memo(({ question, draft, onUpdateDraft }) => {
  // Local state for text/numeric inputs to ensure zero lag
  const [localText, setLocalText] = useState(draft?.text || '');

  useEffect(() => {
    setLocalText(draft?.text || '');
  }, [question.id, draft?.text]);

  const handleBlur = useCallback(() => {
    if (localText !== draft?.text) {
      onUpdateDraft(question.id, { ...draft, text: localText });
    }
  }, [localText, draft, question.id, onUpdateDraft]);

  // Multiple Choice
  if (question.type === 'multiple-choice') {
    return (
      <div className="answer-area">
        {question.options.map((option: any) => (
          <div 
            key={option.id}
            className={`answer-option ${draft?.selectedId === option.id ? 'selected' : ''}`}
            onClick={() => onUpdateDraft(question.id, { selectedId: option.id })}
          >
            <div className="option-letter">{option.label}</div>
            <div className="option-text">
              <MathText text={option.text} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Matching
  if (question.type === 'matching') {
    const pairs = draft?.pairs || {};
    return (
      <div className="answer-area">
        {question.leftItems.map((left: any) => (
          <div key={left.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <div style={{ flex: 1, padding: '1rem', border: '1px solid var(--exam-border)', borderRadius: '8px', background: 'white' }}>
              <MathText text={left.text} />
            </div>
            <div style={{ fontSize: '1.5rem', color: 'var(--exam-text-light)' }}>→</div>
            <select 
              value={pairs[left.id] || ''}
              onChange={(e) => {
                const newPairs = { ...pairs, [left.id]: e.target.value };
                onUpdateDraft(question.id, { pairs: newPairs });
              }}
              style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: '1px solid var(--exam-border)', background: 'white' }}
            >
              <option value="">Selecione...</option>
              {question.rightItems.map((right: any) => (
                <option key={right.id} value={right.id}>{right.text}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  }

  // Numeric or Text
  return (
    <div className="answer-area">
      <div className="exam-card">
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--exam-text-light)', marginBottom: '0.5rem' }}>
          Sua Resposta
        </label>
        <input 
          type="text"
          className="form-control"
          style={{ padding: '1rem', fontSize: '1.25rem', fontWeight: 600 }}
          placeholder="Digite sua resposta aqui..."
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={handleBlur}
        />
      </div>
    </div>
  );
});
