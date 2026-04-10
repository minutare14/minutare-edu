import { forwardRef, type KeyboardEventHandler } from 'react';

type DashboardAiInputProps = {
    disabled?: boolean;
    onChange: (value: string) => void;
    onKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
    placeholder?: string;
    value: string;
};

export const DashboardAiInput = forwardRef<HTMLTextAreaElement, DashboardAiInputProps>(function DashboardAiInput(
    {
        disabled = false,
        onChange,
        onKeyDown,
        placeholder = 'Pergunte algo sobre o que voce esta estudando...',
        value,
    },
    ref,
) {
    return (
        <textarea
            ref={ref}
            className="dashboard-ai-input"
            rows={1}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
        />
    );
});
