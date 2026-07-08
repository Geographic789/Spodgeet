"use client";

import { useRef, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import type { TrackPoint, AidStation } from "@/lib/routeTypes";
import { gradientColor, gradientCategory, GRADIENT_CONFIG } from "@/lib/routeTypes";

// Custom tooltip
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const cat = gradientCategory(d.gradient ?? 0);
  const color = gradientColor(d.gradient ?? 0);
  return (
    <div className="rounded-lg border border-moss-200 bg-white/95 px-3 py-2 text-xs shadow-lg font-mono">
      <p className="font-semibold text-ink">{Number(d.cum_km).toFixed(1)} km</p>
      <p className="text-ink/60">{Math.round(d.ele)} m</p>
      <p style={{ color }} className="font-semibold mt-0.5">
        {(d.gradient ?? 0) > 0 ? "+" : ""}{(d.gradient ?? 0).toFixed(1)}%
        &nbsp;{GRADIENT_CONFIG[cat].label}
      </p>
    </div>
  );
}

// Custom dot for hover position  
function HoverDot({ cx, cy, value, index, data, hoverIndex }: any) {
  if (index !== hoverIndex) return null;
  return <circle cx={cx} cy={cy} r={5} fill="#1b2017" stroke="white" strokeWidth={2} />;
}

export default function ElevationChart({
  points, aidStations, hoverCumKm, onHover,
}: {
  points: TrackPoint[];
  aidStations: AidStation[];
  hoverCumKm: number | null;
  onHover: (cumKm: number | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const totalKm = points[points.length - 1]?.cum_km ?? 1;

  const data = points.map((p) => ({
    cum_km: p.cum_km,
    ele: Math.round(p.ele),
    gradient: p.gradient ?? 0,
  }));

  const pixelToCumKm = useCallback((clientX: number) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const leftPad = 48, rightPad = 16;
    const chartW = rect.width - leftPad - rightPad;
    const relX = clientX - rect.left - leftPad;
    return Math.max(0, Math.min(1, relX / chartW)) * totalKm;
  }, [totalKm]);

  const handleMouseMove = useCallback((state: any) => {
    const label = state?.activeLabel;
    const v = label !== undefined ? parseFloat(String(label)) : null;
    onHover(v !== null && !isNaN(v) ? v : null);
  }, [onHover]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const cumKm = pixelToCumKm(e.touches[0].clientX);
    if (cumKm !== null) onHover(cumKm);
  }, [pixelToCumKm, onHover]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const cumKm = pixelToCumKm(e.touches[0].clientX);
    if (cumKm !== null) onHover(cumKm);
  }, [pixelToCumKm, onHover]);

  // Build stroke segments as linear gradient stops for colored area
  // We use a single area with a custom gradient that approximates the gradient colors
  // For simplicity: teal/blue fill with colored reference lines at gradient changes

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      onTouchEnd={() => onHover(null)}
      style={{ touchAction: "pan-y" }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => onHover(null)}
        >
          <defs>
            <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5f814c" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#5f814c" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="cum_km" type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v) => `${Number(v).toFixed(0)}km`}
            tick={{ fontSize: 10, fill: "#1b2017aa" }}
            axisLine={{ stroke: "#c7d7bc" }} tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `${v}m`}
            tick={{ fontSize: 10, fill: "#1b2017aa" }}
            axisLine={false} tickLine={false} width={46}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#1b2017", strokeWidth: 1.5 }} />

          {/* Aid station lines */}
          {aidStations.map((s) => (
            <ReferenceLine key={s.id} x={s.cumulative_km}
              stroke="#a85a31" strokeDasharray="3 3"
              label={{ value: s.name, position: "insideTopRight", fontSize: 9, fill: "#a85a31" }}
            />
          ))}

          <Area
            type="monotone" dataKey="ele" isAnimationActive={false}
            stroke="#49653a" strokeWidth={2}
            fill="url(#eleGrad)"
            dot={false}
            activeDot={{ r: 5, fill: "#1b2017", stroke: "white", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
