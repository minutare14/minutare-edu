import type { DashboardAiErrorCode } from '@/types/dashboard-ai.ts';
import { DashboardAiRetryButton } from '@/components/dashboard-ai/DashboardAiRetryButton.tsx';

type DashboardAiStatusBannerProps = {
    tone: 'info' | 'error' | 'warning';
    title: string;
    message: string;
    code?: DashboardAiErrorCode | null;
    retryDisabled?: boolean;
    onRetry?: (() => void) | null;
};

export function DashboardAiStatusBanner({
    tone,
    title,
    message,
    code = null,
    retryDisabled = false,
    onRetry = null,
}: DashboardAiStatusBannerProps) {
    return (
        <div className={`dashboard-ai-status dashboard-ai-status--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
            <div className="dashboard-ai-status__copy">
                <strong>{title}</strong>
                <p>{message}</p>
                {code ? <span className="dashboard-ai-status__code">{code}</span> : null}
            </div>
            {onRetry ? <DashboardAiRetryButton disabled={retryDisabled} onClick={onRetry} /> : null}
        </div>
    );
}
