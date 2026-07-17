"use client";

import { useRef, useCallback, useMemo } from "react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, Brush,
} from "recharts";
import type { TrackPoint, AidStation } from "@/lib/routeTypes";
import { gradientColor, gradientCategory, GRADIENT_CONFIG } from "@/lib/routeTypes";

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
        {(d.gradient ?? 0) > 0 ? "+" : ""}{(d.gradient ?? 0).toFixed(1)}% · {GRADIENT_CONFIG[cat].label}
      </p>
    </div>
  );
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

  const data = useMemo(() => points.map((p) => ({
    cum_km: p.cum_km,
    ele: Math.round(p.ele),
    gradient: p.gradient ?? 0,
  })), [points]);

  // 1km ticks — labels every 5km, tick marks every 1km
  const ticks = useMemo(() =>
    Array.from({ length: Math.floor(totalKm) }, (_, i) => i + 1),
  [totalKm]);

  const pixelToCumKm = useCallback((clientX: number) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const leftPad = 46, rightPad = 16;
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

  return (
    <div ref={containerRef} className="h-full w-full"
      onTouchMove={handleTouchMove}
      onTouchStart={(e) => { const c = pixelToCumKm(e.touches[0].clientX); if (c !== null) onHover(c); }}
      onTouchEnd={() => onHover(null)}
      style={{ touchAction: "pan-y" }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}
          barCategoryGap={0} barGap={0}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => onHover(null)}
        >
          <XAxis
            dataKey="cum_km" type="number"
            domain={["dataMin", "dataMax"]}
            ticks={ticks}
            tickFormatter={(v) => v % 5 === 0 ? `${v}km` : ""}
            tick={{ fontSize: 9, fill: "#1b2017aa" }}
            axisLine={{ stroke: "#c7d7bc" }} tickLine={{ stroke: "#e3ebdd" }}
          />
          <YAxis
            tickFormatter={(v) => `${v}m`}
            tick={{ fontSize: 9, fill: "#1b2017aa" }}
            axisLine={false} tickLine={false} width={44}
          />
          <Tooltip content={<CustomTooltip />} cursor={false} />

          {/* Aid station reference lines */}
          {aidStations.map((s) => (
            <ReferenceLine key={s.id} x={s.cumulative_km}
              stroke="#a85a31" strokeDasharray="3 3" strokeWidth={1.5}
              label={{ value: s.name, position: "insideTopRight", fontSize: 8, fill: "#a85a31" }}
            />
          ))}

          {/* Hover position */}
          {hoverCumKm !== null && (
            <ReferenceLine x={hoverCumKm} stroke="#1b2017" strokeWidth={1.5} />
          )}

          {/* Brush zoom — drag to zoom, double-click to reset */}
          <Brush dataKey="cum_km" height={18} stroke="#c7d7bc" fill="#f6f3ec"
            travellerWidth={6}
            style={{ fontSize: 9, fontFamily: "monospace" }}
          />

          <Bar dataKey="ele" isAnimationActive={false} maxBarSize={6}>
            {data.map((entry, i) => (
              <Cell key={i} fill={gradientColor(entry.gradient)} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
