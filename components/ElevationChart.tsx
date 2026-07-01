"use client";

import { useRef, useCallback } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { TrackPoint, AidStation } from "@/lib/routeTypes";
import { gradientColor, GRADIENT_CONFIG } from "@/lib/routeTypes";

type ChartPoint = { cum_km: number; ele: number; gradient: number };

// Custom tooltip showing km, ele, gradient %, category
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: ChartPoint = payload[0]?.payload;
  if (!d) return null;
  const color = gradientColor(d.gradient);
  return (
    <div className="rounded-lg border border-moss-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm font-mono">
      <p className="font-semibold text-ink">{d.cum_km.toFixed(1)} km</p>
      <p className="text-ink/70">{Math.round(d.ele)} m elevation</p>
      <p style={{ color }} className="font-semibold">
        {d.gradient > 0 ? "+" : ""}{d.gradient.toFixed(1)}% · {
          Object.entries(GRADIENT_CONFIG).find(([, v]) => gradientColor(d.gradient) === v.color)?.[1].label
        }
      </p>
    </div>
  );
}

export default function ElevationChart({
  points,
  aidStations,
  hoverCumKm,
  onHover,
}: {
  points: TrackPoint[];
  aidStations: AidStation[];
  hoverCumKm: number | null;
  onHover: (cumKm: number | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const totalKm = points[points.length - 1]?.cum_km ?? 1;

  const data: ChartPoint[] = points.map((p) => ({
    cum_km: p.cum_km,
    ele: Math.round(p.ele),
    gradient: p.gradient ?? 0,
  }));

  // Convert pixel X position within the chart to a cumulative km value
  const pixelToCumKm = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      // Recharts leaves ~48px left margin for Y axis, ~16px right
      const leftPad = 48;
      const rightPad = 16;
      const chartW = rect.width - leftPad - rightPad;
      const relX = clientX - rect.left - leftPad;
      const fraction = Math.max(0, Math.min(1, relX / chartW));
      return fraction * totalKm;
    },
    [totalKm]
  );

  const handleMouseMove = useCallback(
    (state: any) => {
      const cumKm =
        state?.activeLabel !== undefined
          ? parseFloat(state.activeLabel)
          : null;
      onHover(Number.isNaN(cumKm) ? null : cumKm);
    },
    [onHover]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const cumKm = pixelToCumKm(touch.clientX);
      if (cumKm !== null) onHover(cumKm);
    },
    [pixelToCumKm, onHover]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const cumKm = pixelToCumKm(touch.clientX);
      if (cumKm !== null) onHover(cumKm);
    },
    [pixelToCumKm, onHover]
  );

  return (
    <div
      ref={containerRef}
      className="h-full w-full touch-pan-y"
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      onTouchEnd={() => onHover(null)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
          barCategoryGap={0}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => onHover(null)}
        >
          <XAxis
            dataKey="cum_km"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v) => `${Number(v).toFixed(0)}km`}
            tick={{ fontSize: 10, fill: "#1b2017aa" }}
            axisLine={{ stroke: "#c7d7bc" }}
            tickLine={false}
            scale="linear"
          />
          <YAxis
            tickFormatter={(v) => `${v}m`}
            tick={{ fontSize: 10, fill: "#1b2017aa" }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} cursor={false} />

          {/* Aid station reference lines */}
          {aidStations.map((s) => (
            <ReferenceLine
              key={s.id}
              x={s.cumulative_km}
              stroke="#a85a31"
              strokeDasharray="3 3"
              label={{ value: s.name, position: "top", fontSize: 9, fill: "#854727" }}
            />
          ))}

          {/* Hover crosshair */}
          {hoverCumKm !== null && (
            <ReferenceLine x={hoverCumKm} stroke="#1b2017" strokeWidth={1.5} />
          )}

          <Bar dataKey="ele" isAnimationActive={false} maxBarSize={4}>
            {data.map((entry, i) => (
              <Cell key={i} fill={gradientColor(entry.gradient)} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
