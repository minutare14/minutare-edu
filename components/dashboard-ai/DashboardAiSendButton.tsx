type DashboardAiSendButtonProps = {
    disabled?: boolean;
    loading?: boolean;
    onClick?: () => void;
};

export function DashboardAiSendButton({
    disabled = false,
    loading = false,
    onClick,
}: DashboardAiSendButtonProps) {
    return (
        <button
            className="dashboard-ai-send-button"
            type="submit"
            disabled={disabled}
            onClick={onClick}
        >
            {loading ? 'Enviando...' : 'Enviar'}
        </button>
    );
}
