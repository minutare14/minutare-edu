import katex from 'katex';
import type { ReactNode } from 'react';
import type { ContentBlock } from './model';

function renderKatex(expression: string, displayMode = false) {
    return katex.renderToString(expression, {
        displayMode,
        throwOnError: false,
        strict: 'ignore',
    });
}

export function MathText({ text }: { text: string }) {
    const parts: ReactNode[] = [];
    const pattern = /\$(.+?)\$/g;
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text))) {
        if (match.index > cursor) {
            parts.push(text.slice(cursor, match.index));
        }

        parts.push(
            <span
                key={`${match.index}-${match[1]}`}
                className="math-inline"
                dangerouslySetInnerHTML={{ __html: renderKatex(match[1]) }}
            />,
        );

        cursor = match.index + match[0].length;
    }

    if (cursor < text.length) {
        parts.push(text.slice(cursor));
    }

    return <>{parts}</>;
}

export function ContentRenderer({ blocks }: { blocks: ContentBlock[] }) {
    return (
        <div className="content-stack">
            {blocks.map((block, index) => {
                if (block.type === 'bullets') {
                    return (
                        <ul key={`block-${index}`} className="content-bullets">
                            {block.items.map((item) => (
                                <li key={item}>
                                    <MathText text={item} />
                                </li>
                            ))}
                        </ul>
                    );
                }

                if (block.type === 'equation') {
                    return (
                        <div
                            key={`block-${index}`}
                            className="math-display"
                            dangerouslySetInnerHTML={{ __html: renderKatex(block.text, true) }}
                        />
                    );
                }

                return (
                    <p key={`block-${index}`} className={block.type === 'note' ? 'content-note' : 'content-paragraph'}>
                        <MathText text={block.text} />
                    </p>
                );
            })}
        </div>
    );
}
