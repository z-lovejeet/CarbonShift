"use client";
import { useId } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { ComparisonV1, GridIntervalV1 } from "@/domain/schemas";
import { shortLondon } from "@/lib/presentation";

export default function IntensityChart({ intervals, comparison }: { intervals: GridIntervalV1[]; comparison: ComparisonV1 }) {
  const pattern = useId().replace(/:/g, "");
  const points = intervals.map((item) => ({ instant: Date.parse(item.fromUtc), factor: item.forecastGPerKwh }));
  const last = intervals.at(-1);
  if (last) points.push({ instant: Date.parse(last.toUtc), factor: last.forecastGPerKwh });
  const stride = Math.max(1, Math.ceil((points.length - 1) / 4));
  const ticks = points.filter((_, index) => index % stride === 0 || index === points.length - 1).map((point) => point.instant);
  const max = Math.max(1, ...intervals.map((item) => item.forecastGPerKwh ?? 0));
  return <div className="intensity-chart" aria-hidden="true">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={points} margin={{ top: 16, right: 16, bottom: 12, left: 0 }} accessibilityLayer={false}>
        <defs><pattern id={pattern} width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="#526158" strokeWidth="1" /></pattern></defs>
        <CartesianGrid vertical={false} stroke="#d7dfd6" />
        <XAxis ticks={ticks} dataKey="instant" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(value: number) => shortLondon(new Date(value).toISOString().replace(".000Z", "Z"))} minTickGap={40} tick={{ fontSize: 12, fill: "#526158" }} tickLine={false} />
        <YAxis domain={[0, Math.ceil(max * 1.1 / 10) * 10]} width={44} tick={{ fontSize: 12, fill: "#526158" }} tickLine={false} axisLine={false} />
        <ReferenceArea x1={Date.parse(comparison.baseline.startUtc)} x2={Date.parse(comparison.baseline.endUtc)} fill={`url(#${pattern})`} fillOpacity={.22} />
        <ReferenceArea x1={Date.parse(comparison.selected.startUtc)} x2={Date.parse(comparison.selected.endUtc)} fill="#165d3b" fillOpacity={.1} />
        <Line dataKey="factor" type="stepAfter" stroke="#165d3b" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}
