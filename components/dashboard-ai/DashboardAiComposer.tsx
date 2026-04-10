import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { DashboardAiInput } from '@/components/dashboard-ai/DashboardAiInput.tsx';
import { DashboardAiSendButton } from '@/components/dashboard-ai/DashboardAiSendButton.tsx';

type DashboardAiComposerProps = {
    draftSeed?: string;
    inlineError?: string | null;
    loading?: boolean;
    onDismissError?: (() => void) | null;
    onSubmit: (content: string) => Promise<boolean>;
};

export function DashboardAiComposer({
    draftSeed = '',
    inlineError = null,
    loading = false,
    onDismissError = null,
    onSubmit,
}: DashboardAiComposerProps) {
    const [value, setValue] = useState(draftSeed);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        if (!draftSeed) {
            return;
        }

        setValue(draftSeed);
        inputRef.current?.focus({ preventScroll: true });
    }, [draftSeed]);

    useEffect(() => {
        const element = inputRef.current;
        if (!element) {
            return;
        }

        element.style.height = 'auto';
        element.style.height = `${Math.min(element.scrollHeight, 200)}px`;
    }, [value]);

    async function handleSubmit(event?: FormEvent) {
        event?.preventDefault();
        const accepted = await onSubmit(value);
        if (accepted) {
            setValue('');
        }
    }

    function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void handleSubmit();
        }
    }

    return (
        <form className="dashboard-ai-composer" onSubmit={handleSubmit}>
            <DashboardAiInput
                ref={inputRef}
                value={value}
                disabled={false}
                onChange={(nextValue) => {
                    if (inlineError && onDismissError) {
                        onDismissError();
                    }
                    setValue(nextValue);
                }}
                onKeyDown={handleKeyDown}
            />
            <div className="dashboard-ai-composer__actions">
                <div className="dashboard-ai-composer__hint">
                    <span>Enter envia</span>
                    <span>Shift + Enter quebra linha</span>
                </div>
                <DashboardAiSendButton disabled={loading} loading={loading} />
            </div>
            {inlineError ? <p className="dashboard-ai-composer__error">{inlineError}</p> : null}
        </form>
    );
}
