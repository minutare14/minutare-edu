import { MathText } from '../content';
import type { QuestionDraft, ToggleAnswer } from '../grading';
import type { ExamQuestion } from '../model';

interface ExamAnswerAreaProps {
    question: ExamQuestion;
    draft: QuestionDraft;
    onAnswerChange: (fieldKey: string, value: string) => void;
    onMatrixChange: (rowKey: string, columnKey: string, value: ToggleAnswer) => void;
}

export function ExamAnswerArea({ question, draft, onAnswerChange, onMatrixChange }: ExamAnswerAreaProps) {
    if (question.answerSchema.kind === 'open') {
        const { field } = question.answerSchema;
        const value = draft.answers[field.key] || '';

        return (
            <div className="groups-grid">
                <section className="answer-group">
                    <div className="answer-group__title">
                        <span>{field.label}</span>
                        {question.answerSchema.instructions ? <small>{question.answerSchema.instructions}</small> : null}
                    </div>

                    <label className="field-card field-card--stacked">
                        <span className="field-card__label">{field.label}</span>
                        <textarea
                            rows={field.rows || 8}
                            value={value}
                            placeholder={field.placeholder}
                            onChange={(event) => onAnswerChange(field.key, event.target.value)}
                        />
                    </label>
                </section>
            </div>
        );
    }

    if (question.answerSchema.kind === 'matrix') {
        const schema = question.answerSchema;

        return (
            <div className="matrix-wrapper">
                <div className="matrix-header">{schema.instructions}</div>
                <div className="matrix-table">
                    <div className="matrix-row matrix-row--head">
                        <div className="matrix-cell matrix-cell--label">Intervalo</div>
                        {schema.columns.map((column) => (
                            <div key={column.key} className="matrix-cell matrix-cell--head">
                                <MathText text={column.label} />
                            </div>
                        ))}
                    </div>
                    {schema.rows.map((row) => (
                        <div key={row.key} className="matrix-row">
                            <div className="matrix-cell matrix-cell--label">
                                <MathText text={row.label} />
                            </div>
                            {schema.columns.map((column) => {
                                const current = draft.matrixAnswers[row.key]?.[column.key] || '';

                                return (
                                    <div key={`${row.key}-${column.key}`} className="matrix-cell">
                                        <div className="toggle-set toggle-set--matrix">
                                            <button
                                                type="button"
                                                className={`toggle-chip ${current === 'sim' ? 'toggle-chip--active' : ''}`}
                                                onClick={() => onMatrixChange(row.key, column.key, 'sim')}
                                            >
                                                {schema.trueLabel}
                                            </button>
                                            <button
                                                type="button"
                                                className={`toggle-chip ${current === 'nao' ? 'toggle-chip--active-alt' : ''}`}
                                                onClick={() => onMatrixChange(row.key, column.key, 'nao')}
                                            >
                                                {schema.falseLabel}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="groups-grid">
            {question.answerSchema.groups.map((group) => (
                <section key={group.key} className={`answer-group ${group.compact ? 'answer-group--compact' : ''}`}>
                    <div className="answer-group__title">
                        <span>{group.label}</span>
                        {group.prompt ? (
                            <small>
                                <MathText text={group.prompt} />
                            </small>
                        ) : null}
                    </div>

                    <div className={`field-stack ${group.fields.length > 1 ? 'field-stack--multi' : ''}`}>
                        {group.fields.map((field) => {
                            const value = draft.answers[field.key] || '';
                            const expectsBoolean =
                                field.input === 'toggle' &&
                                field.checker.type === 'exact' &&
                                ['v', 'f'].includes(field.checker.accepted[0].toLowerCase());

                            return (
                                <label key={field.key} className="field-card">
                                    <span className="field-card__label">{field.label}</span>
                                    {field.helpText ? <span className="field-card__help">{field.helpText}</span> : null}
                                    {field.input === 'textarea' ? (
                                        <textarea
                                            rows={field.rows || 4}
                                            value={value}
                                            placeholder={field.placeholder}
                                            onChange={(event) => onAnswerChange(field.key, event.target.value)}
                                        />
                                    ) : field.input === 'toggle' ? (
                                        <div className="toggle-set">
                                            <button
                                                type="button"
                                                className={`toggle-chip ${value === (expectsBoolean ? 'V' : 'sim') ? 'toggle-chip--active' : ''}`}
                                                onClick={() => onAnswerChange(field.key, expectsBoolean ? 'V' : 'sim')}
                                            >
                                                {expectsBoolean ? 'V' : 'Sim'}
                                            </button>
                                            <button
                                                type="button"
                                                className={`toggle-chip toggle-chip--alt ${value === (expectsBoolean ? 'F' : 'nao') ? 'toggle-chip--active-alt' : ''}`}
                                                onClick={() => onAnswerChange(field.key, expectsBoolean ? 'F' : 'nao')}
                                            >
                                                {expectsBoolean ? 'F' : 'Nao'}
                                            </button>
                                        </div>
                                    ) : (
                                        <input
                                            type="text"
                                            value={value}
                                            placeholder={field.placeholder}
                                            onChange={(event) => onAnswerChange(field.key, event.target.value)}
                                        />
                                    )}
                                </label>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}
