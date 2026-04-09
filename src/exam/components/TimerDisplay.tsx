import React from 'react';
import { formatDuration } from '../timing';

interface TimerDisplayProps {
  label: string;
  ms: number;
  criticalThreshold?: number;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = React.memo(({ label, ms, criticalThreshold = 60000 }) => {
  const isCritical = ms < criticalThreshold && ms > 0;
  
  return (
    <div className={`timer-container ${isCritical ? 'timer-critical' : ''}`}>
      <span className="exam-text-light" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ fontSize: '1rem' }}>{formatDuration(ms)}</span>
    </div>
  );
});
