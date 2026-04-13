import type { CSSProperties, ReactNode } from 'react';
import { IMPORTED_GRAPH_ASSETS } from './imported/generated';
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

function escapeXml(value: string) {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const SVG_STYLE_BLOCK = `
    .graph-axis,.interval-axis{stroke:rgba(36,54,78,.78);stroke-width:1.5}
    .graph-axis-label,.graph-tick-label,.interval-label,.interval-value{fill:rgba(36,54,78,.92);font-size:12px;font-family:Manrope,Segoe UI,sans-serif}
    .graph-tick,.interval-arrow{stroke:rgba(36,54,78,.72);stroke-width:1.2}
    .graph-guide{stroke:rgba(36,54,78,.45);stroke-dasharray:8 8;stroke-width:1.3}
    .graph-guide-soft{stroke:rgba(63,139,127,.42);stroke-dasharray:8 8;stroke-width:1.3}
    .graph-line{fill:none;stroke:#2f3b4c;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
    .graph-line-cool{stroke:#355f92}
    .graph-line-green{stroke:#4d965d}
    .graph-point{fill:#214f89;stroke:#fff;stroke-width:1.5}
    .graph-point-cool{fill:#28548d}
    .graph-point-warm{fill:#d4574b;stroke:#4b221f;stroke-width:1.5}
    .interval-segment{stroke:#101820;stroke-width:3}
    .interval-point{fill:#101820}
    .interval-point-open{fill:#fff;stroke:#101820;stroke-width:2}
`;

function svgDocument(width: number, height: number, title: string, body: string) {
    return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(title)}">
            <defs>
                <style>${SVG_STYLE_BLOCK}</style>
            </defs>
            <rect width="${width}" height="${height}" rx="20" fill="rgba(255,253,248,1)" />
            ${body}
        </svg>
    `.trim();
}

function axesMarkup({
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
    return `
        <line x1="64" y1="${height - 54}" x2="${width - 24}" y2="${height - 54}" class="graph-axis" />
        <line x1="64" y1="${height - 54}" x2="64" y2="28" class="graph-axis" />
        <text x="${width - 28}" y="${height - 60}" class="graph-axis-label" text-anchor="end">${escapeXml(xLabel)}</text>
        <text x="70" y="38" class="graph-axis-label">${escapeXml(yLabel)}</text>
    `;
}

function ticksMarkup({
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
    return `
        ${xTicks
            .map((tick) => {
                const x = scaleLinear(tick, xDomain, [64, width - 28]);
                return `
                    <g>
                        <line x1="${x}" y1="${height - 54}" x2="${x}" y2="${height - 48}" class="graph-tick" />
                        <text x="${x}" y="${height - 26}" text-anchor="middle" class="graph-tick-label">${tick}</text>
                    </g>
                `;
            })
            .join('')}
        ${yTicks
            .map((tick) => {
                const y = scaleLinear(tick, yDomain, [height - 54, 28]);
                return `
                    <g>
                        <line x1="58" y1="${y}" x2="64" y2="${y}" class="graph-tick" />
                        <text x="52" y="${y + 4}" text-anchor="end" class="graph-tick-label">${tick}</text>
                    </g>
                `;
            })
            .join('')}
    `;
}

function guidelineMarkup(x1: number, y1: number, x2: number, y2: number, soft = false) {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${soft ? 'graph-guide-soft' : 'graph-guide'}" />`;
}

function pointMarkup(x: number, y: number, className = 'graph-point', radius = 4.5) {
    return `<circle cx="${x}" cy="${y}" r="${radius}" class="${className}" />`;
}

const IMPORTED_GRAPH_ASSET_MAP = new Map(IMPORTED_GRAPH_ASSETS.map((asset) => [asset.id, asset]));

function uniqueSorted(values: number[]) {
    return Array.from(new Set(values)).sort((left, right) => left - right);
}

function buildImportedLineGraphAsset(graphKey: GraphKey) {
    const asset = IMPORTED_GRAPH_ASSET_MAP.get(graphKey);
    if (!asset || asset.graphType !== 'line') return null;

    const payload = asset.payload as {
        type?: string;
        xLabel?: string;
        yLabel?: string;
        points?: Array<[number, number]>;
        guides?: {
            vertical?: number[];
            horizontal?: number[];
        };
    };

    const points = Array.isArray(payload.points) ? payload.points.filter((point) => Array.isArray(point) && point.length === 2) : [];
    if (!points.length) return null;

    const xValues = uniqueSorted([0, ...points.map((point) => point[0]), ...(payload.guides?.vertical || [])]);
    const yValues = uniqueSorted([0, ...points.map((point) => point[1]), ...(payload.guides?.horizontal || [])]);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    const xPadding = Math.max(1, (xMax - xMin) * 0.15 || 1);
    const yPadding = Math.max(40, (yMax - yMin) * 0.14 || 40);
    const width = 420;
    const height = 300;
    const xDomain: [number, number] = [Math.min(0, Math.floor(xMin - xPadding)), Math.ceil(xMax + xPadding)];
    const yDomain: [number, number] = [Math.min(0, Math.floor(yMin - yPadding)), Math.ceil(yMax + yPadding)];
    const guideSegments: string[] = [];

    for (const guideX of payload.guides?.vertical || []) {
        const point = points.find((entry) => entry[0] === guideX);
        if (!point) continue;
        const pointCoords = chartPoint(point[0], point[1], xDomain, yDomain, width, height);
        guideSegments.push(guidelineMarkup(pointCoords.x, pointCoords.y, pointCoords.x, height - 54));
    }

    for (const guideY of payload.guides?.horizontal || []) {
        const point = points.find((entry) => entry[1] === guideY) || points.find((entry) => entry[1] >= guideY);
        const y = scaleLinear(guideY, yDomain, [height - 54, 28]);
        const x = point ? chartPoint(point[0], point[1], xDomain, yDomain, width, height).x : width - 28;
        guideSegments.push(guidelineMarkup(64, y, x, y));
    }

    return {
        title: `Grafico reconstruido de ${asset.questionId}`,
        width,
        height,
        xDomain,
        yDomain,
        xLabel: payload.xLabel || 'x',
        yLabel: payload.yLabel || 'y',
        xTicks: xValues,
        yTicks: yValues.filter((value) => value >= yDomain[0] && value <= yDomain[1]),
        points,
        extra: guideSegments.join(''),
        pointEntries: points.map((point) => ({ point })),
    };
}

function chartSvgMarkup({
    title,
    width,
    height,
    xDomain,
    yDomain,
    xLabel,
    yLabel,
    xTicks,
    yTicks,
    points,
    lineClass = 'graph-line',
    pointEntries = [],
    extra = '',
}: {
    title: string;
    width: number;
    height: number;
    xDomain: [number, number];
    yDomain: [number, number];
    xLabel: string;
    yLabel: string;
    xTicks: number[];
    yTicks: number[];
    points: Point[];
    lineClass?: string;
    pointEntries?: Array<{ point: Point; className?: string; radius?: number }>;
    extra?: string;
}) {
    const path = linePath(points, xDomain, yDomain, width, height);
    const pointMarkupText = pointEntries
        .map(({ point, className, radius }) => {
            const coords = chartPoint(point[0], point[1], xDomain, yDomain, width, height);
            return pointMarkup(coords.x, coords.y, className || 'graph-point', radius || 4.5);
        })
        .join('');

    return svgDocument(
        width,
        height,
        title,
        `
            ${axesMarkup({ width, height, xLabel, yLabel })}
            ${ticksMarkup({ width, height, xDomain, yDomain, xTicks, yTicks })}
            ${extra}
            <path d="${path}" class="${lineClass}" />
            ${pointMarkupText}
        `,
    );
}

function intervalRowMarkup({
    yOffset,
    label,
    left,
    right,
    leftClosed,
    rightClosed,
    showLeftInfinity,
    showRightInfinity,
}: {
    yOffset: number;
    label: string;
    left: number;
    right: number;
    leftClosed: boolean;
    rightClosed: boolean;
    showLeftInfinity?: boolean;
    showRightInfinity?: boolean;
}) {
    const width = 380;
    const rowHeight = 64;
    const xFromValue = (value: number) => scaleLinear(value, [-5, 5], [46, width - 26]);
    const leftX = xFromValue(left);
    const rightX = xFromValue(right);
    const midY = yOffset + 24;
    const segmentStart = showLeftInfinity ? 22 : leftX;
    const segmentEnd = showRightInfinity ? width - 18 : rightX;

    return `
        <g transform="translate(20 ${yOffset})">
            <text x="4" y="28" class="interval-label">${escapeXml(label)}</text>
            <line x1="28" y1="24" x2="${width - 20}" y2="24" class="interval-axis" />
            <line x1="28" y1="24" x2="36" y2="19" class="interval-arrow" />
            <line x1="28" y1="24" x2="36" y2="29" class="interval-arrow" />
            <line x1="${width - 20}" y1="24" x2="${width - 28}" y2="19" class="interval-arrow" />
            <line x1="${width - 20}" y1="24" x2="${width - 28}" y2="29" class="interval-arrow" />
            <line x1="${segmentStart}" y1="24" x2="${segmentEnd}" y2="24" class="interval-segment" />
            ${
                showLeftInfinity
                    ? ''
                    : `<circle cx="${leftX}" cy="24" r="5" class="${leftClosed ? 'interval-point' : 'interval-point-open'}" />`
            }
            ${
                showRightInfinity
                    ? ''
                    : `<circle cx="${rightX}" cy="24" r="5" class="${rightClosed ? 'interval-point' : 'interval-point-open'}" />`
            }
            ${showLeftInfinity ? '' : `<text x="${leftX}" y="50" text-anchor="middle" class="interval-value">${left}</text>`}
            ${showRightInfinity ? '' : `<text x="${rightX}" y="50" text-anchor="middle" class="interval-value">${right}</text>`}
        </g>
    `;
}

export function getGraphExportMarkup(graphKey: GraphKey): { svgMarkup: string; width: number; height: number; title: string } | null {
    const importedLineGraph = buildImportedLineGraphAsset(graphKey);
    if (importedLineGraph) {
        return {
            width: importedLineGraph.width,
            height: importedLineGraph.height,
            title: importedLineGraph.title,
            svgMarkup: chartSvgMarkup(importedLineGraph),
        };
    }

    switch (graphKey) {
        case 'interval-examples': {
            const width = 420;
            const height = 360;
            return {
                width,
                height,
                title: 'Grafico da questao de intervalos',
                svgMarkup: svgDocument(
                    width,
                    height,
                    'Grafico da questao de intervalos',
                    `
                        <rect x="12" y="12" width="${width - 24}" height="${height - 24}" rx="18" fill="rgba(34,58,90,.04)" />
                        ${intervalRowMarkup({ yOffset: 28, label: 'a)', left: -4, right: 2, leftClosed: true, rightClosed: true })}
                        ${intervalRowMarkup({ yOffset: 90, label: 'b)', left: 1, right: 5, leftClosed: false, rightClosed: false, showRightInfinity: true })}
                        ${intervalRowMarkup({ yOffset: 152, label: 'c)', left: -3, right: 3, leftClosed: false, rightClosed: false })}
                        ${intervalRowMarkup({ yOffset: 214, label: 'd)', left: 0, right: 2, leftClosed: false, rightClosed: true })}
                        ${intervalRowMarkup({ yOffset: 276, label: 'e)', left: 1, right: 5, leftClosed: true, rightClosed: false, showLeftInfinity: true })}
                    `,
                ),
            };
        }
        case 'cost-line': {
            const width = 420;
            const height = 300;
            const xDomain: [number, number] = [0, 4.4];
            const yDomain: [number, number] = [0, 44000];
            const second = chartPoint(3, 30000, xDomain, yDomain, width, height);
            return {
                width,
                height,
                title: 'Grafico da questao 22',
                svgMarkup: chartSvgMarkup({
                    title: 'Grafico da questao 22',
                    width,
                    height,
                    xDomain,
                    yDomain,
                    xLabel: 't(h)',
                    yLabel: 'C($)',
                    xTicks: [0, 1, 2, 3, 4],
                    yTicks: [0, 10000, 20000, 30000, 40000],
                    points: [
                        [0, 20000],
                        [3, 30000],
                        [4.5, 35000],
                    ],
                    pointEntries: [{ point: [0, 20000] }, { point: [3, 30000] }],
                    extra: `${guidelineMarkup(second.x, second.y, second.x, height - 54)}${guidelineMarkup(64, second.y, second.x, second.y)}`,
                }),
            };
        }
        case 'coffee-demand': {
            const width = 420;
            const height = 300;
            const xDomain: [number, number] = [0, 7];
            const yDomain: [number, number] = [0, 220];
            const first = chartPoint(1, 180, xDomain, yDomain, width, height);
            const second = chartPoint(5, 100, xDomain, yDomain, width, height);
            return {
                width,
                height,
                title: 'Grafico da questao 23',
                svgMarkup: chartSvgMarkup({
                    title: 'Grafico da questao 23',
                    width,
                    height,
                    xDomain,
                    yDomain,
                    xLabel: 'preco($)',
                    yLabel: 'xicaras por mes',
                    xTicks: [1, 5],
                    yTicks: [100, 180],
                    points: [
                        [0, 200],
                        [1, 180],
                        [5, 100],
                        [7, 60],
                    ],
                    lineClass: 'graph-line graph-line-cool',
                    pointEntries: [
                        { point: [1, 180], className: 'graph-point graph-point-cool' },
                        { point: [5, 100], className: 'graph-point graph-point-cool' },
                    ],
                    extra: `${guidelineMarkup(first.x, first.y, first.x, height - 54)}${guidelineMarkup(second.x, second.y, second.x, height - 54)}${guidelineMarkup(64, second.y, second.x, second.y)}`,
                }),
            };
        }
        case 'vehicle-depreciation': {
            const width = 460;
            const height = 300;
            const xDomain: [number, number] = [0, 28];
            const yDomain: [number, number] = [0, 110];
            const second = chartPoint(24, 20, xDomain, yDomain, width, height);
            return {
                width,
                height,
                title: 'Grafico da questao 24',
                svgMarkup: chartSvgMarkup({
                    title: 'Grafico da questao 24',
                    width,
                    height,
                    xDomain,
                    yDomain,
                    xLabel: 't(anos)',
                    yLabel: '%',
                    xTicks: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28],
                    yTicks: [20, 40, 60, 80, 100],
                    points: [
                        [0, 100],
                        [24, 20],
                    ],
                    pointEntries: [{ point: [0, 100] }, { point: [24, 20] }],
                    extra: `${guidelineMarkup(second.x, second.y, second.x, height - 54)}${guidelineMarkup(64, second.y, second.x, second.y)}`,
                }),
            };
        }
        case 'quadratic-roots': {
            const width = 420;
            const height = 320;
            const xDomain: [number, number] = [-3, 2];
            const yDomain: [number, number] = [-2.4, 2.4];
            const points = Array.from({ length: 120 }, (_, index) => {
                const x = -3 + (5 * index) / 119;
                const y = 0.5 * x * x + 0.5 * x - 1;
                return [x, y] as Point;
            });
            const vertex = chartPoint(-0.5, -1.125, xDomain, yDomain, width, height);
            return {
                width,
                height,
                title: 'Grafico da questao 25',
                svgMarkup: chartSvgMarkup({
                    title: 'Grafico da questao 25',
                    width,
                    height,
                    xDomain,
                    yDomain,
                    xLabel: 'x',
                    yLabel: 'f(x)',
                    xTicks: [-2, -1, 0, 1],
                    yTicks: [-1, 0, 1],
                    points,
                    lineClass: 'graph-line graph-line-green',
                    pointEntries: [
                        { point: [-2, 0], className: 'graph-point graph-point-warm', radius: 5 },
                        { point: [1, 0], className: 'graph-point graph-point-warm', radius: 5 },
                        { point: [0, -1], className: 'graph-point graph-point-warm', radius: 5 },
                    ],
                    extra: guidelineMarkup(vertex.x, 28, vertex.x, height - 54, true),
                }),
            };
        }
        default:
            return null;
    }
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

function ImportedGraphFigure({ graphKey }: { graphKey: GraphKey }) {
    const graphAsset = getGraphExportMarkup(graphKey);
    if (!graphAsset) return null;

    return (
        <div
            className="graph-shell"
            dangerouslySetInnerHTML={{
                __html: graphAsset.svgMarkup,
            }}
        />
    );
}

export function GraphFigure({ graphKey }: { graphKey: GraphKey }) {
    const importedAsset = IMPORTED_GRAPH_ASSET_MAP.get(graphKey);
    if (importedAsset) {
        return (
            <div className="graph-figure" data-graph-key={graphKey}>
                <ImportedGraphFigure graphKey={graphKey} />
            </div>
        );
    }

    let content: ReactNode = null;

    switch (graphKey) {
        case 'interval-examples':
            content = <IntervalExamplesGraph />;
            break;
        case 'cost-line':
            content = <CostLineGraph />;
            break;
        case 'coffee-demand':
            content = <CoffeeDemandGraph />;
            break;
        case 'vehicle-depreciation':
            content = <VehicleDepreciationGraph />;
            break;
        case 'quadratic-roots':
            content = <QuadraticRootsGraph />;
            break;
        default:
            content = null;
    }

    return content ? (
        <div className="graph-figure" data-graph-key={graphKey}>
            {content}
        </div>
    ) : null;
}
