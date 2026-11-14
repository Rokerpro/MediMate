import type { HealthLog } from "@/lib/validations";
import { TREND_DAYS, dailySeries, type DailyPoint } from "@/lib/health/trends";

// Shared by the dashboard and the /summary page. Two separate charts (pain 0–10,
// sleep in hours), one measure and one axis each. Plain SVG: no chart dependency,
// and it prints cleanly. Days without a measurement are left as gaps.

const WIDTH = 560;
const HEIGHT = 200;
const MARGIN = { top: 12, right: 12, bottom: 28, left: 34 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;
const LINE_COLOR = "#1d4ed8"; // blue-700, the app's primary colour

function shortDate(date: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

type TrendChartProps = {
  title: string;
  unitLabel: string;
  points: readonly DailyPoint[];
  value: (point: DailyPoint) => number | null;
  yMax: number;
  yTicks: readonly number[];
  format: (value: number) => string;
};

export function TrendChart({ title, unitLabel, points, value, yMax, yTicks, format }: TrendChartProps) {
  const step = points.length > 1 ? PLOT_W / (points.length - 1) : 0;
  const x = (index: number) => MARGIN.left + index * step;
  const y = (v: number) => MARGIN.top + PLOT_H - (Math.min(v, yMax) / yMax) * PLOT_H;

  const recorded = points
    .map((point, index) => ({ point, index, v: value(point) }))
    .filter((entry): entry is { point: DailyPoint; index: number; v: number } => entry.v !== null);

  // Connect only consecutive days that both have a value, so gaps stay visible.
  const segments: string[] = [];
  for (let i = 1; i < recorded.length; i += 1) {
    const a = recorded[i - 1]!;
    const b = recorded[i]!;
    if (b.index === a.index + 1) segments.push(`M${x(a.index)},${y(a.v)}L${x(b.index)},${y(b.v)}`);
  }

  const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const summary = recorded.length
    ? `${title}: ${recorded.length} of ${points.length} days recorded, from ${format(Math.min(...recorded.map((r) => r.v)))} to ${format(Math.max(...recorded.map((r) => r.v)))}.`
    : `${title}: no measurements recorded in this period.`;

  return (
    <figure className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid print:shadow-none">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-slate-900">{title}</span>
        <span className="text-xs text-slate-500">{unitLabel}</span>
      </figcaption>
      {recorded.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
          No measurements recorded in the last {points.length} days.
        </p>
      ) : (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={summary} className="mt-2 h-auto w-full">
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke="#e2e8f0" strokeWidth={1} />
              <text x={MARGIN.left - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#64748b">
                {tick}
              </text>
            </g>
          ))}
          {labelIndexes.map((index) => (
            <text
              key={index}
              x={x(index)}
              y={HEIGHT - 8}
              textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
              fontSize={11}
              fill="#64748b"
            >
              {shortDate(points[index]!.date)}
            </text>
          ))}
          {segments.map((d) => (
            <path key={d} d={d} fill="none" stroke={LINE_COLOR} strokeWidth={2} strokeLinecap="round" />
          ))}
          {recorded.map(({ point, index, v }) => (
            <g key={point.date}>
              <circle cx={x(index)} cy={y(v)} r={4} fill={LINE_COLOR} stroke="#ffffff" strokeWidth={2} />
              {/* Larger invisible hit target; the native tooltip shows date and value. */}
              <circle cx={x(index)} cy={y(v)} r={12} fill="transparent">
                <title>{`${shortDate(point.date)}: ${format(v)}`}</title>
              </circle>
            </g>
          ))}
        </svg>
      )}
    </figure>
  );
}

/** Pain and sleep charts for the last TREND_DAYS days of logs. */
export function HealthTrends({ logs, now }: { logs: readonly HealthLog[]; now?: number }) {
  const points = dailySeries(logs, TREND_DAYS, now);
  const maxSleep = Math.max(10, ...points.map((p) => p.sleepHours ?? 0));
  const sleepMax = Math.ceil(maxSleep / 2) * 2;
  return (
    <div className="space-y-2">
      <div className="grid gap-4 md:grid-cols-2">
        <TrendChart
          title="Pain level"
          unitLabel="0–10, highest recorded each day"
          points={points}
          value={(p) => p.painLevel}
          yMax={10}
          yTicks={[0, 5, 10]}
          format={(v) => `${v}/10`}
        />
        <TrendChart
          title="Sleep duration"
          unitLabel="hours"
          points={points}
          value={(p) => p.sleepHours}
          yMax={sleepMax}
          yTicks={[0, sleepMax / 2, sleepMax]}
          format={(v) => `${v} h`}
        />
      </div>
      <p className="text-xs text-slate-500">
        User-reported measurements from the last {TREND_DAYS} days, not diagnostic indicators. Gaps are days with nothing recorded.
      </p>
    </div>
  );
}
