import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import '@/src/dashboard-ai.css';
import { DashboardAiShell } from '@/components/dashboard-ai/DashboardAiShell.tsx';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <DashboardAiShell />
    </StrictMode>,
);
