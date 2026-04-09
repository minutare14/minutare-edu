interface ExamScratchpadProps {
    value: string;
    onChange: (value: string) => void;
}

export function ExamScratchpad({ value, onChange }: ExamScratchpadProps) {
    return (
        <div>
            <div className="scratch-panel__header">
                <div>
                    <h3>Rascunho</h3>
                    <p>Use este espaco para organizar a estrategia, testar contas e registrar justificativas sem interferir na resposta oficial.</p>
                </div>
            </div>
            <textarea
                rows={8}
                placeholder="Escreva seu raciocinio, contas e lembretes desta questao."
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
}
