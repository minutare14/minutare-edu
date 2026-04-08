import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Bot, CircleDashed, MessageCircleMore, SendHorizontal, Sparkles, X } from 'lucide-react';
import { MathText } from './exam/content';

export interface TutorQuickAction {
    id: string;
    label: string;
    description: string;
    prompt: string;
    tone?: 'primary' | 'secondary' | 'ghost';
}

interface TutorMessage {
    id: string;
    role: 'assistant' | 'user';
    text: string;
    status: 'ready' | 'loading' | 'error';
    mode?: string;
    model?: string;
}

interface TutorPanelProps {
    contextLabel: string;
    contextSummary: string;
    contextPrompt: string;
    quickActions: TutorQuickAction[];
    moduleSlug?: string;
    openRequestToken?: number;
}

const INITIAL_GREETING = [
    '### Resumo rapido',
    'Sou seu tutor de matematica. Posso explicar a questao atual, revisar um conceito e sugerir o proximo passo sem travar a resolucao.',
    '',
    '### Explicacao',
    '- Use as acoes rapidas para pedir leitura do grafico, passo a passo ou uma revisao curta.',
    '- Se quiser, escreva sua propria duvida no campo abaixo e eu respondo em blocos curtos.',
    '',
    '### O que observar',
    '- Quanto mais clara a pergunta, melhor o tutor consegue apontar o raciocinio certo.',
    '- Quando houver grafico, vale pedir explicitamente a interpretacao visual antes da conta.',
    '',
    '### Exemplo',
    '"Explique a ideia central desta questao sem entregar a resposta inteira de imediato."',
].join('\n');

function createMessageId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildChatFallbackMessage(error: unknown) {
    const payload = error as {
        error?: string;
        errorType?: string;
        diagnostics?: {
            errorType?: string;
        };
    };
    const errorType = payload?.diagnostics?.errorType || payload?.errorType;

    if (errorType === 'quota_exceeded') {
        return [
            '### Resumo rapido',
            'O tutor nao conseguiu responder agora porque a cota do provedor foi excedida.',
            '',
            '### Explicacao',
            'Voce ainda pode continuar resolvendo a prova, salvando respostas e usando o rascunho normalmente.',
            '',
            '### O que observar',
            'Tente novamente em instantes ou siga para a proxima questao enquanto isso.',
        ].join('\n');
    }

    if (errorType === 'missing_key') {
        return [
            '### Resumo rapido',
            'O tutor esta indisponivel porque a configuracao de IA do backend nao foi encontrada.',
            '',
            '### Explicacao',
            'A prova continua funcionando e a correcao local permanece disponivel.',
            '',
            '### Exemplo',
            'Voce pode seguir respondendo e, depois, revisar a explicacao final por questao.',
        ].join('\n');
    }

    return [
        '### Resumo rapido',
        'Nao consegui processar sua mensagem agora.',
        '',
        '### Explicacao',
        'A interface do tutor continua ativa, entao vale tentar de novo com uma pergunta mais curta ou mais especifica.',
        '',
        '### O que observar',
        '- Cite a questao ou o assunto que voce quer revisar.',
        '- Se quiser ajuda sem gabarito direto, diga isso explicitamente.',
    ].join('\n');
}

function buildContextualMessage(contextPrompt: string, prompt: string) {
    return `${contextPrompt}\n\nPedido do aluno: ${prompt.trim()}`;
}

function buildHistoryPayload(messages: TutorMessage[]) {
    return messages
        .filter((message) => message.status !== 'loading' && message.text.trim())
        .map((message) => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: message.text }],
        }));
}

interface ParsedSection {
    title: string;
    paragraphs: string[];
    bullets: string[];
}

function parseTutorSections(text: string): ParsedSection[] {
    const normalized = text.replace(/\r/g, '').trim();
    if (!normalized) return [];

    const blocks = /^(?:##|###)\s/m.test(normalized)
        ? normalized.split(/\n(?=##?#\s)/)
        : [`### Resposta\n${normalized}`];

    return blocks
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => {
            const lines = block.split('\n');
            const title = lines[0].replace(/^##?#\s+/, '').trim() || 'Resposta';
            const bodyLines = lines.slice(1).map((line) => line.trim()).filter(Boolean);
            const paragraphs: string[] = [];
            const bullets: string[] = [];

            for (const line of bodyLines) {
                if (/^[-*]\s+/.test(line)) {
                    bullets.push(line.replace(/^[-*]\s+/, '').trim());
                } else {
                    paragraphs.push(line);
                }
            }

            return { title, paragraphs, bullets };
        });
}

function TutorAssistantBubble({ message }: { message: TutorMessage }) {
    if (message.status === 'loading') {
        return (
            <div className="tutor-bubble tutor-bubble--assistant tutor-bubble--loading">
                <CircleDashed className="spin" size={16} />
                <span>Consultando o tutor...</span>
            </div>
        );
    }

    const sections = parseTutorSections(message.text);

    const modeLabel =
        message.mode === 'general_fallback'
            ? 'IA geral'
            : message.mode === 'local_fallback'
                ? 'Tutor local'
                : message.mode;

    return (
        <article className={`tutor-bubble tutor-bubble--assistant ${message.status === 'error' ? 'tutor-bubble--error' : ''}`}>
            <div className="tutor-bubble__icon" aria-hidden="true">
                {message.status === 'error' ? <Sparkles size={15} /> : <Bot size={15} />}
            </div>
            <div className="tutor-bubble__content">
                {sections.map((section) => (
                    <section key={`${message.id}-${section.title}`} className="tutor-section">
                        <h4>{section.title}</h4>
                        {section.paragraphs.map((paragraph) => (
                            <p key={`${message.id}-${section.title}-${paragraph}`}>
                                <MathText text={paragraph} />
                            </p>
                        ))}
                        {section.bullets.length ? (
                            <ul>
                                {section.bullets.map((bullet) => (
                                    <li key={`${message.id}-${section.title}-${bullet}`}>
                                        <MathText text={bullet} />
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </section>
                ))}
                {message.model || message.mode ? (
                    <div className="tutor-bubble__meta">
                        {modeLabel ? <span>{modeLabel}</span> : null}
                        {message.model ? <span>{message.model}</span> : null}
                    </div>
                ) : null}
            </div>
        </article>
    );
}

function TutorUserBubble({ message }: { message: TutorMessage }) {
    return (
        <article className="tutor-bubble tutor-bubble--user">
            <div className="tutor-bubble__content">
                {message.text.split('\n').map((line) => (
                    <p key={`${message.id}-${line}`}>
                        <MathText text={line} />
                    </p>
                ))}
            </div>
        </article>
    );
}

export function TutorPanel({
    contextLabel,
    contextSummary,
    contextPrompt,
    quickActions,
    moduleSlug,
    openRequestToken = 0,
}: TutorPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [model, setModel] = useState<'flash' | 'pro' | 'lite'>('flash');
    const [input, setInput] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [messages, setMessages] = useState<TutorMessage[]>([
        {
            id: 'tutor-greeting',
            role: 'assistant',
            text: INITIAL_GREETING,
            status: 'ready',
        },
    ]);

    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const messagesRef = useRef<HTMLDivElement | null>(null);
    const toggleRef = useRef<HTMLButtonElement | null>(null);
    const lastFocusedRef = useRef<HTMLElement | null>(null);
    const openedOnceRef = useRef(false);
    const messagesStateRef = useRef<TutorMessage[]>(messages);

    useEffect(() => {
        messagesStateRef.current = messages;
    }, [messages]);

    useEffect(() => {
        if (!openRequestToken) return;
        setIsOpen(true);
    }, [openRequestToken]);

    useEffect(() => {
        if (!isOpen) return;
        openedOnceRef.current = true;

        lastFocusedRef.current =
            document.activeElement instanceof HTMLElement && !document.activeElement.closest('.tutor-panel')
                ? document.activeElement
                : toggleRef.current;

        const raf = window.requestAnimationFrame(() => inputRef.current?.focus());
        const timeout = window.setTimeout(() => inputRef.current?.focus(), 180);

        return () => {
            window.cancelAnimationFrame(raf);
            window.clearTimeout(timeout);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        function handleEscape(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        }

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen]);

    useEffect(() => {
        const element = messagesRef.current;
        if (!element) return;
        element.scrollTop = element.scrollHeight;
    }, [isOpen, messages]);

    useEffect(() => {
        if (!openedOnceRef.current) return;
        if (isOpen) return;
        const focusTarget = lastFocusedRef.current;
        if (focusTarget && document.contains(focusTarget)) {
            focusTarget.focus({ preventScroll: true });
        } else {
            toggleRef.current?.focus({ preventScroll: true });
        }
    }, [isOpen]);

    async function submitPrompt(rawPrompt: string) {
        const prompt = rawPrompt.trim();
        if (!prompt || submitting) return;

        const userMessage: TutorMessage = {
            id: createMessageId('tutor-user'),
            role: 'user',
            text: prompt,
            status: 'ready',
        };
        const loadingMessage: TutorMessage = {
            id: createMessageId('tutor-loading'),
            role: 'assistant',
            text: '',
            status: 'loading',
        };
        const currentMessages = messagesStateRef.current;
        const nextMessages = [...currentMessages, userMessage, loadingMessage];
        const history = buildHistoryPayload([...currentMessages, userMessage]);

        setMessages(nextMessages);
        setInput('');
        setSubmitting(true);
        setIsOpen(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    history,
                    message: buildContextualMessage(contextPrompt, prompt),
                    module_slug: moduleSlug || undefined,
                }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw payload || new Error('chat failed');

            const assistantMessage: TutorMessage = {
                id: createMessageId('tutor-assistant'),
                role: 'assistant',
                text: typeof payload?.text === 'string' && payload.text.trim() ? payload.text : 'Nao houve resposta do tutor.',
                status: 'ready',
                mode: typeof payload?.mode === 'string' ? payload.mode : undefined,
                model: typeof payload?.model === 'string' ? payload.model : undefined,
            };

            setMessages((current) => current.map((message) => (message.id === loadingMessage.id ? assistantMessage : message)));
        } catch (error) {
            const fallback = buildChatFallbackMessage(error);
            setMessages((current) =>
                current.map((message) =>
                    message.id === loadingMessage.id
                        ? {
                              id: createMessageId('tutor-error'),
                              role: 'assistant',
                              text: fallback,
                              status: 'error',
                          }
                        : message,
                ),
            );
        } finally {
            setSubmitting(false);
            window.requestAnimationFrame(() => inputRef.current?.focus());
            window.setTimeout(() => inputRef.current?.focus(), 120);
        }
    }

    function handleComposerSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        void submitPrompt(input);
    }

    function handleQuickAction(action: TutorQuickAction) {
        void submitPrompt(action.prompt);
    }

    function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void submitPrompt(input);
        }
    }

    return (
        <div className={`tutor-shell ${isOpen ? 'tutor-shell--open' : ''}`}>
            <button
                ref={toggleRef}
                type="button"
                className="tutor-toggle"
                aria-expanded={isOpen}
                aria-controls="tutor-panel"
                onClick={() => setIsOpen((current) => !current)}
            >
                <span className="tutor-toggle__eyebrow">Tutor IA</span>
                <span className="tutor-toggle__label">{isOpen ? 'Fechar tutor' : 'Abrir tutor'}</span>
                <small>{contextLabel}</small>
            </button>

            <button
                type="button"
                className="tutor-backdrop"
                aria-label="Fechar tutor"
                onClick={() => setIsOpen(false)}
            />

            <aside id="tutor-panel" className="tutor-panel" role="dialog" aria-modal="false" aria-label="Tutor de matematica">
                <header className="tutor-panel__header">
                    <div className="tutor-panel__headline">
                        <span className="tutor-panel__eyebrow">Tutor de matematica</span>
                        <h3>{contextLabel}</h3>
                        <p>{contextSummary}</p>
                    </div>
                    <div className="tutor-panel__controls">
                        <label className="sr-only" htmlFor="tutor-model-select">Modelo do tutor</label>
                        <select id="tutor-model-select" value={model} onChange={(event) => setModel(event.target.value as 'flash' | 'pro' | 'lite')}>
                            <option value="flash">Flash</option>
                            <option value="pro">Pro</option>
                            <option value="lite">Lite</option>
                        </select>
                        <button type="button" className="tutor-close" aria-label="Fechar tutor" onClick={() => setIsOpen(false)}>
                            <X size={18} />
                        </button>
                    </div>
                </header>

                <div className="tutor-panel__body">
                    <section className="tutor-quick-actions" aria-label="Acoes rapidas do tutor">
                        {quickActions.map((action) => (
                            <button
                                key={action.id}
                                type="button"
                                className={`tutor-quick-action tutor-quick-action--${action.tone || 'secondary'}`}
                                onClick={() => handleQuickAction(action)}
                                disabled={submitting}
                            >
                                <strong>{action.label}</strong>
                                <span>{action.description}</span>
                            </button>
                        ))}
                    </section>

                    <div ref={messagesRef} className="tutor-messages" role="log" aria-live="polite" aria-relevant="additions text">
                        {messages.map((message) => (
                            <div key={message.id}>
                                {message.role === 'assistant' ? <TutorAssistantBubble message={message} /> : <TutorUserBubble message={message} />}
                            </div>
                        ))}
                    </div>
                </div>

                <form className="tutor-composer" onSubmit={handleComposerSubmit}>
                    <label className="sr-only" htmlFor="tutor-input">Digite sua pergunta</label>
                    <textarea
                        id="tutor-input"
                        ref={inputRef}
                        rows={3}
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={handleComposerKeyDown}
                        placeholder="Pergunte sobre a questao, o grafico, o raciocinio ou o proximo passo."
                    />
                    <button type="submit" className="tutor-send" disabled={submitting || !input.trim()}>
                        {submitting ? <CircleDashed className="spin" size={16} /> : <SendHorizontal size={16} />}
                        Enviar
                    </button>
                </form>
            </aside>

            <button type="button" className="tutor-fab" onClick={() => setIsOpen(true)} aria-label="Abrir tutor">
                <MessageCircleMore size={18} />
            </button>
        </div>
    );
}
