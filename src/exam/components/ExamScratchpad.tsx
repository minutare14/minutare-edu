import React, { useState, useEffect, useCallback } from 'react';

interface ScratchpadProps {
  questionId: string;
  initialValue: string;
  onUpdate: (qId: string, value: string) => void;
}

export const ExamScratchpad: React.FC<ScratchpadProps> = React.memo(({ questionId, initialValue, onUpdate }) => {
  const [localValue, setLocalValue] = useState(initialValue);

  // Reset local value when question changes
  useEffect(() => {
    setLocalValue(initialValue);
  }, [questionId, initialValue]);

  const handleBlur = useCallback(() => {
    if (localValue !== initialValue) {
      onUpdate(questionId, localValue);
    }
  }, [localValue, initialValue, questionId, onUpdate]);

  return (
    <div className="scratchpad-area">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--exam-text-light)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Rascunho Editorial (Auto-salvamento)
        </span>
      </div>
      <textarea
        className="scratchpad-textarea"
        placeholder="Use este espaço para organizar seu raciocínio..."
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        rows={6}
      />
    </div>
  );
});
