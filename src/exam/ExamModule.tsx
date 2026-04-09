import React, { useState, useCallback, useMemo } from 'react';
import './ExamModule.css';
import { ExamHeader } from './components/ExamHeader';
import { ExamSidebar } from './components/ExamSidebar';
import { ExamQuestionArea } from './components/ExamQuestionArea';
import { useExamTiming, ExamTimingSnapshot } from './timing';
import { ExamQuestion } from './model';

interface ExamModuleProps {
  questions: ExamQuestion[];
  initialDrafts: Record<string, any>;
  initialTiming: Partial<ExamTimingSnapshot> | null;
  onUpdateDraft: (questionId: string, value: any) => void;
  onFinish: (timingSnapshot: ExamTimingSnapshot) => void;
}

export const ExamModule: React.FC<ExamModuleProps> = ({
  questions,
  initialDrafts,
  initialTiming,
  onUpdateDraft,
  onFinish
}) => {
  const [activeQuestionId, setActiveQuestionId] = useState(questions[0]?.id || '');

  // Timing Logic Isolated here
  const { totalElapsedMs, questionElapsedMs, snapshot, finish } = useExamTiming({
    questionIds: questions.map(q => q.id),
    initialSnapshot: initialTiming,
    activeQuestionId,
    running: true
  });

  const activeQuestion = useMemo(() => 
    questions.find(q => q.id === activeQuestionId), 
    [questions, activeQuestionId]
  );

  const sidebarQuestions = useMemo(() => 
    questions.map(q => ({
      id: q.id,
      number: q.number,
      completed: !!initialDrafts[q.id]?.selectedId || !!initialDrafts[q.id]?.text || false,
      flagged: initialDrafts[q.id]?.flagged
    })),
    [questions, initialDrafts]
  );

  const handleFinish = useCallback(() => {
    const finalTiming = finish();
    onFinish(finalTiming);
  }, [finish, onFinish]);

  const handleUpdateScratchpad = useCallback((qId: string, value: string) => {
    onUpdateDraft(qId, { ...initialDrafts[qId], scratchpad: value });
  }, [initialDrafts, onUpdateDraft]);

  const handleUpdateAnswer = useCallback((qId: string, value: any) => {
    onUpdateDraft(qId, value);
  }, [onUpdateDraft]);

  if (!activeQuestion) return <div>Iniciando prova...</div>;

  return (
    <div className="exam-viewport">
      <ExamHeader 
        title="Simulado Minutare" 
        totalMs={totalElapsedMs}
        questionMs={questionElapsedMs[activeQuestionId] || 0}
        onFinish={handleFinish}
      />
      
      <ExamSidebar 
        questions={sidebarQuestions}
        activeQuestionId={activeQuestionId}
        onSelectQuestion={setActiveQuestionId}
      />

      <main className="exam-main">
        <ExamQuestionArea 
          question={activeQuestion}
          draft={initialDrafts[activeQuestionId]}
          onUpdateDraft={handleUpdateAnswer}
          onUpdateScratchpad={handleUpdateScratchpad}
        />
      </main>
    </div>
  );
};
