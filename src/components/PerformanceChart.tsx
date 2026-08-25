import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ServerStats } from "@/lib/types";

const chartConfig = {
  tps: {
    label: "TPS",
    color: "var(--color-primary)",
  },
  ram: {
    label: "RAM %",
    color: "var(--color-primary-dim)",
  },
} satisfies ChartConfig;

export function PerformanceChart({
  history,
  className,
}: {
  history: ServerStats["history"];
  className?: string;
}) {
  const data = (history ?? []).map((h, i) => ({
    i,
    t: h.t?.slice(-8) ?? String(i),
    tps: h.tps ?? 0,
    ram: h.ram ?? 0,
  }));

  if (data.length < 2) {
    return (
      <div
        className={`flex h-[160px] items-center justify-center rounded-lg border border-border/60 bg-card/40 text-caption text-muted-foreground ${className ?? ""}`}
      >
        Storico TPS/RAM insufficiente — aggiorna le metriche.
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-border bg-card/40 p-3 sm:p-4 ${className ?? ""}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-label text-primary">Performance</h3>
        <span className="text-caption text-muted-foreground">TPS · RAM %</span>
      </div>
      <ChartContainer config={chartConfig} className="aspect-[2.4/1] w-full">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fillTps" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-tps)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-tps)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="fillRam" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-ram)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--color-ram)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="t"
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            minTickGap={28}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            width={28}
            tick={{ fontSize: 10 }}
            domain={[0, "auto"]}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                indicator="line"
                className="border-border bg-background/95 font-mono"
              />
            }
          />
          <Area
            type="monotone"
            dataKey="tps"
            stroke="var(--color-tps)"
            fill="url(#fillTps)"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: "var(--color-tps)" }}
          />
          <Area
            type="monotone"
            dataKey="ram"
            stroke="var(--color-ram)"
            fill="url(#fillRam)"
            strokeWidth={1.25}
            strokeDasharray="4 2"
            dot={false}
            activeDot={{ r: 3, fill: "var(--color-ram)" }}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
