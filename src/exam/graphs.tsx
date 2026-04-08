import type { CSSProperties, ReactNode } from 'react';
import type { GraphKey } from './model';

type Point = [number, number];

function scaleLinear(value: number, domain: [number, number], range: [number, number]) {
    const [d0, d1] = domain;
    const [r0, r1] = range;
    const ratio = (value - d0) / (d1 - d0);
    return r0 + ratio * (r1 - r0);
}

function linePath(points: Point[], xDomain: [number, number], yDomain: [number, number], width: number, height: number) {
    return points
        .map(([x, y], index) => {
            const px = scaleLinear(x, xDomain, [64, width - 28]);
            const py = scaleLinear(y, yDomain, [height - 54, 28]);
            return `${index === 0 ? 'M' : 'L'} ${px} ${py}`;
        })
        .join(' ');
}

function chartPoint(x: number, y: number, xDomain: [number, number], yDomain: [number, number], width: number, height: number) {
    return {
        x: scaleLinear(x, xDomain, [64, width - 28]),
        y: scaleLinear(y, yDomain, [height - 54, 28]),
    };
}

function ChartShell({
    title,
    children,
    width = 420,
    height = 280,
    style,
}: {
    title: string;
    children: ReactNode;
    width?: number;
    height?: number;
    style?: CSSProperties;
}) {
    return (
        <div className="graph-shell" style={style}>
            <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
                {children}
            </svg>
        </div>
    );
}

function Axes({
    width,
    height,
    xLabel,
    yLabel,
}: {
    width: number;
    height: number;
    xLabel: string;
    yLabel: string;
}) {
    return (
        <>
            <line x1="64" y1={height - 54} x2={width - 24} y2={height - 54} className="graph-axis" />
            <line x1="64" y1={height - 54} x2="64" y2="28" className="graph-axis" />
            <text x={width - 28} y={height - 60} className="graph-axis-label" textAnchor="end">
                {xLabel}
            </text>
            <text x="70" y="38" className="graph-axis-label">
                {yLabel}
            </text>
        </>
    );
}

function Ticks({
    width,
    height,
    xDomain,
    yDomain,
    xTicks,
    yTicks,
}: {
    width: number;
    height: number;
    xDomain: [number, number];
    yDomain: [number, number];
    xTicks: number[];
    yTicks: number[];
}) {
    return (
        <>
            {xTicks.map((tick) => {
                const x = scaleLinear(tick, xDomain, [64, width - 28]);
                return (
                    <g key={`x-${tick}`}>
                        <line x1={x} y1={height - 54} x2={x} y2={height - 48} className="graph-tick" />
                        <text x={x} y={height - 26} textAnchor="middle" className="graph-tick-label">
                            {tick}
                        </text>
                    </g>
                );
            })}
            {yTicks.map((tick) => {
                const y = scaleLinear(tick, yDomain, [height - 54, 28]);
                return (
                    <g key={`y-${tick}`}>
                        <line x1="58" y1={y} x2="64" y2={y} className="graph-tick" />
                        <text x="52" y={y + 4} textAnchor="end" className="graph-tick-label">
                            {tick}
                        </text>
                    </g>
                );
            })}
        </>
    );
}

function GuideLine({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
    return <line x1={x1} y1={y1} x2={x2} y2={y2} className="graph-guide" />;
}

function IntervalGraphic({
    label,
    left,
    right,
    leftClosed,
    rightClosed,
    showLeftInfinity,
    showRightInfinity,
}: {
    label: string;
    left: number;
    right: number;
    leftClosed: boolean;
    rightClosed: boolean;
    showLeftInfinity?: boolean;
    showRightInfinity?: boolean;
}) {
    const width = 380;
    const height = 70;
    const xFromValue = (value: number) => scaleLinear(value, [-5, 5], [46, width - 26]);
    const leftX = xFromValue(left);
    const rightX = xFromValue(right);
    const midY = 34;

    const segmentStart = showLeftInfinity ? 22 : leftX;
    const segmentEnd = showRightInfinity ? width - 18 : rightX;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="interval-mini" aria-label={label}>
            <text x="4" y="38" className="interval-label">
                {label}
            </text>
            <line x1="28" y1={midY} x2={width - 20} y2={midY} className="interval-axis" />
            <line x1="28" y1={midY} x2="36" y2={midY - 5} className="interval-arrow" />
            <line x1="28" y1={midY} x2="36" y2={midY + 5} className="interval-arrow" />
            <line x1={width - 20} y1={midY} x2={width - 28} y2={midY - 5} className="interval-arrow" />
            <line x1={width - 20} y1={midY} x2={width - 28} y2={midY + 5} className="interval-arrow" />
            <line x1={segmentStart} y1={midY} x2={segmentEnd} y2={midY} className="interval-segment" />
            {!showLeftInfinity && <circle cx={leftX} cy={midY} r="5" className={leftClosed ? 'interval-point' : 'interval-point interval-point--open'} />}
            {!showRightInfinity && <circle cx={rightX} cy={midY} r="5" className={rightClosed ? 'interval-point' : 'interval-point interval-point--open'} />}
            {!showLeftInfinity && (
                <text x={leftX} y="60" textAnchor="middle" className="interval-value">
                    {left}
                </text>
            )}
            {!showRightInfinity && (
                <text x={rightX} y="60" textAnchor="middle" className="interval-value">
                    {right}
                </text>
            )}
        </svg>
    );
}

function IntervalExamplesGraph() {
    return (
        <div className="interval-gallery">
            <IntervalGraphic label="a)" left={-4} right={2} leftClosed rightClosed />
            <IntervalGraphic label="b)" left={1} right={5} leftClosed={false} rightClosed={false} showRightInfinity />
            <IntervalGraphic label="c)" left={-3} right={3} leftClosed={false} rightClosed={false} />
            <IntervalGraphic label="d)" left={0} right={2} leftClosed={false} rightClosed />
            <IntervalGraphic label="e)" left={1} right={5} leftClosed rightClosed={false} showLeftInfinity />
        </div>
    );
}

function CostLineGraph() {
    const width = 420;
    const height = 300;
    const xDomain: [number, number] = [0, 4.4];
    const yDomain: [number, number] = [0, 44000];
    const points: Point[] = [
        [0, 20000],
        [3, 30000],
        [4.5, 35000],
    ];
    const first = chartPoint(0, 20000, xDomain, yDomain, width, height);
    const second = chartPoint(3, 30000, xDomain, yDomain, width, height);

    return (
        <ChartShell title="Grafico da questao 22" width={width} height={height}>
            <Axes width={width} height={height} xLabel="t(h)" yLabel="C($)" />
            <Ticks width={width} height={height} xDomain={xDomain} yDomain={yDomain} xTicks={[0, 1, 2, 3, 4]} yTicks={[0, 10000, 20000, 30000, 40000]} />
            <GuideLine x1={second.x} y1={second.y} x2={second.x} y2={height - 54} />
            <GuideLine x1={64} y1={second.y} x2={second.x} y2={second.y} />
            <path d={linePath(points, xDomain, yDomain, width, height)} className="graph-line" />
            <circle cx={first.x} cy={first.y} r="4.5" className="graph-point" />
            <circle cx={second.x} cy={second.y} r="4.5" className="graph-point" />
        </ChartShell>
    );
}

function CoffeeDemandGraph() {
    const width = 420;
    const height = 300;
    const xDomain: [number, number] = [0, 7];
    const yDomain: [number, number] = [0, 220];
    const points: Point[] = [
        [0, 200],
        [1, 180],
        [5, 100],
        [7, 60],
    ];
    const first = chartPoint(1, 180, xDomain, yDomain, width, height);
    const second = chartPoint(5, 100, xDomain, yDomain, width, height);

    return (
        <ChartShell title="Grafico da questao 23" width={width} height={height}>
            <Axes width={width} height={height} xLabel="preco($)" yLabel="xicaras por mes" />
            <Ticks width={width} height={height} xDomain={xDomain} yDomain={yDomain} xTicks={[1, 5]} yTicks={[100, 180]} />
            <GuideLine x1={first.x} y1={first.y} x2={first.x} y2={height - 54} />
            <GuideLine x1={second.x} y1={second.y} x2={second.x} y2={height - 54} />
            <GuideLine x1={64} y1={second.y} x2={second.x} y2={second.y} />
            <path d={linePath(points, xDomain, yDomain, width, height)} className="graph-line graph-line--cool" />
            <circle cx={first.x} cy={first.y} r="4.5" className="graph-point graph-point--cool" />
            <circle cx={second.x} cy={second.y} r="4.5" className="graph-point graph-point--cool" />
        </ChartShell>
    );
}

function VehicleDepreciationGraph() {
    const width = 460;
    const height = 300;
    const xDomain: [number, number] = [0, 28];
    const yDomain: [number, number] = [0, 110];
    const points: Point[] = [
        [0, 100],
        [24, 20],
    ];
    const first = chartPoint(0, 100, xDomain, yDomain, width, height);
    const second = chartPoint(24, 20, xDomain, yDomain, width, height);

    return (
        <ChartShell title="Grafico da questao 24" width={width} height={height}>
            <Axes width={width} height={height} xLabel="t(anos)" yLabel="%" />
            <Ticks
                width={width}
                height={height}
                xDomain={xDomain}
                yDomain={yDomain}
                xTicks={[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28]}
                yTicks={[20, 40, 60, 80, 100]}
            />
            <GuideLine x1={second.x} y1={second.y} x2={second.x} y2={height - 54} />
            <GuideLine x1={64} y1={second.y} x2={second.x} y2={second.y} />
            <path d={linePath(points, xDomain, yDomain, width, height)} className="graph-line" />
            <circle cx={first.x} cy={first.y} r="4.5" className="graph-point" />
            <circle cx={second.x} cy={second.y} r="4.5" className="graph-point" />
        </ChartShell>
    );
}

function QuadraticRootsGraph() {
    const width = 420;
    const height = 320;
    const xDomain: [number, number] = [-3, 2];
    const yDomain: [number, number] = [-2.4, 2.4];

    const points = Array.from({ length: 120 }, (_, index) => {
        const x = -3 + (5 * index) / 119;
        const y = 0.5 * x * x + 0.5 * x - 1;
        return [x, y] as Point;
    });

    const rootLeft = chartPoint(-2, 0, xDomain, yDomain, width, height);
    const rootRight = chartPoint(1, 0, xDomain, yDomain, width, height);
    const yPoint = chartPoint(0, -1, xDomain, yDomain, width, height);
    const vertex = chartPoint(-0.5, -1.125, xDomain, yDomain, width, height);

    return (
        <ChartShell title="Grafico da questao 25" width={width} height={height}>
            <Axes width={width} height={height} xLabel="x" yLabel="f(x)" />
            <Ticks width={width} height={height} xDomain={xDomain} yDomain={yDomain} xTicks={[-2, -1, 0, 1]} yTicks={[-1, 0, 1]} />
            <path d={linePath(points, xDomain, yDomain, width, height)} className="graph-line graph-line--green" />
            <line x1={vertex.x} y1={28} x2={vertex.x} y2={height - 54} className="graph-guide graph-guide--soft" />
            <circle cx={rootLeft.x} cy={rootLeft.y} r="5" className="graph-point graph-point--warm" />
            <circle cx={rootRight.x} cy={rootRight.y} r="5" className="graph-point graph-point--warm" />
            <circle cx={yPoint.x} cy={yPoint.y} r="5" className="graph-point graph-point--warm" />
        </ChartShell>
    );
}

export function GraphFigure({ graphKey }: { graphKey: GraphKey }) {
    switch (graphKey) {
        case 'interval-examples':
            return <IntervalExamplesGraph />;
        case 'cost-line':
            return <CostLineGraph />;
        case 'coffee-demand':
            return <CoffeeDemandGraph />;
        case 'vehicle-depreciation':
            return <VehicleDepreciationGraph />;
        case 'quadratic-roots':
            return <QuadraticRootsGraph />;
        default:
            return null;
    }
}
