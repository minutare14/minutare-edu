type DashboardAiRetryButtonProps = {
    disabled?: boolean;
    onClick: () => void;
};

export function DashboardAiRetryButton({ disabled = false, onClick }: DashboardAiRetryButtonProps) {
    return (
        <button
            className="dashboard-ai-retry-button"
            type="button"
            onClick={onClick}
            disabled={disabled}
        >
            Tentar novamente
        </button>
    );
}
