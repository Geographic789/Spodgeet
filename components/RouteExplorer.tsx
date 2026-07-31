"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import ElevationChart from "@/components/ElevationChart";
import {
  downsample,
  nearestAidStation,
  gradientCategory,
  GRADIENT_CONFIG,
  type AidStation,
  type DistanceWithRoute,
  type RaceSummary,
} from "@/lib/routeTypes";

const RouteMap = dynamic(() => import("@/components/RouteMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-ink/50">Loading map…</div>
  ),
});

type Tab = "map" | "elevation" | "info";

export default function RouteExplorer({
  distance,
  race,
  aidStations,
}: {
  distance: DistanceWithRoute;
  race: RaceSummary | null;
  aidStations: AidStation[];
}) {
  const [hoverCumKm, setHoverCumKm] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("map");
  const [showGradientColors, setShowGradientColors] = useState(true);

  const fullPoints = distance.route_geojson || [];
  const chartPoints = useMemo(() => downsample(fullPoints, 600), [fullPoints]);

  const highlightedStation = useMemo(() => {
    if (hoverCumKm === null) return null;
    return nearestAidStation(aidStations, hoverCumKm);
  }, [hoverCumKm, aidStations]);

  const hoverGradient = useMemo(() => {
    if (hoverCumKm === null || chartPoints.length === 0) return null;
    const pt = chartPoints.find(
      (p, i) => i === chartPoints.length - 1 || chartPoints[i + 1].cum_km > hoverCumKm
    );
    return pt?.gradient ?? null;
  }, [hoverCumKm, chartPoints]);

  const gradientLegend = Object.entries(GRADIENT_CONFIG);

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        {race && <p className="label-eyebrow mb-1">{race.name}</p>}
        <h1 className="font-display text-2xl tracking-wide text-ink">{distance.label}</h1>
        <p className="font-mono text-sm text-ink/60">
          {distance.distance_km.toFixed(1)} km
          {distance.elevation_gain_m != null ? ` · +${Math.round(distance.elevation_gain_m)}m` : ""}
          {distance.elevation_loss_m != null ? ` / -${Math.round(distance.elevation_loss_m)}m` : ""}
        </p>

        {/* Hover status bar */}
        <div className="mt-2 h-6 flex items-center gap-3 text-sm">
          {hoverCumKm !== null ? (
            <>
              <span className="font-mono text-ink font-semibold">{hoverCumKm.toFixed(1)} km</span>
              {hoverGradient !== null && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: GRADIENT_CONFIG[gradientCategory(hoverGradient)].color }}
                >
                  {hoverGradient > 0 ? "+" : ""}{hoverGradient.toFixed(1)}% {GRADIENT_CONFIG[gradientCategory(hoverGradient)].label}
                </span>
              )}
              {highlightedStation && (
                <span className="text-ink/60 text-xs">📍 {highlightedStation.name}</span>
              )}
            </>
          ) : (
            <span className="text-ink/40 text-xs">Hover or touch the elevation chart to explore</span>
          )}
        </div>
      </div>

      {/* Gradient legend + toggle */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {gradientLegend.map(([key, val]) => (
          <span key={key} className="flex items-center gap-1.5 text-xs text-ink/70">
            <span className="inline-block h-2.5 w-5 rounded-sm" style={{ backgroundColor: val.color }} />
            {val.label}
          </span>
        ))}
        <button
          onClick={() => setShowGradientColors((s) => !s)}
          className="ml-auto text-xs text-moss-600 hover:underline"
        >
          {showGradientColors ? "Show solid line" : "Show gradient colors"}
        </button>
      </div>

      {/* Mobile tabs */}
      <div className="mb-3 flex gap-2 sm:hidden">
        {(["map", "elevation", "info"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
              tab === t ? "bg-moss-600 text-sand" : "bg-moss-100 text-moss-700"
            }`}
          >
            {t === "map" ? "Map" : t === "elevation" ? "Elevation" : "Stations"}
          </button>
        ))}
      </div>

      {/* Mobile panels */}
      <div className="sm:hidden">
        {tab === "map" && (
          <div className="card h-[420px] overflow-hidden">
            <RouteMap points={fullPoints} aidStations={aidStations} hoverCumKm={hoverCumKm} showGradientColors={showGradientColors} />
          </div>
        )}
        {tab === "elevation" && (
          <div className="card h-[300px] p-3">
            <ElevationChart points={chartPoints} aidStations={aidStations} hoverCumKm={hoverCumKm} onHover={setHoverCumKm} />
          </div>
        )}
        {tab === "info" && <RaceInfoPanel aidStations={aidStations} />}
      </div>

      {/* Desktop split */}
      <div className="hidden sm:grid sm:grid-cols-2 sm:gap-6">
        <div className="space-y-4">
          <div className="card h-[380px] overflow-hidden">
            <RouteMap points={fullPoints} aidStations={aidStations} hoverCumKm={hoverCumKm} showGradientColors={showGradientColors} />
          </div>
          <div className="card h-[240px] p-3">
            <ElevationChart points={chartPoints} aidStations={aidStations} hoverCumKm={hoverCumKm} onHover={setHoverCumKm} />
          </div>
        </div>
        <div className="space-y-4">
          <RaceInfoPanel aidStations={aidStations} />
          <div className="card border-dashed p-5 text-sm text-ink/50">
            Pacing table lives here in the next phase.
          </div>
        </div>
      </div>
    </div>
  );
}

function RaceInfoPanel({ aidStations }: { aidStations: AidStation[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-moss-200/70 bg-moss-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Aid stations</p>
      </div>
      {aidStations.length === 0 ? (
        <p className="p-4 text-sm text-ink/50">No aid stations added yet.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {aidStations.map((s) => (
              <tr key={s.id} className="border-t border-moss-100">
                <td className="px-4 py-2.5">{s.name}</td>
                <td className="px-4 py-2.5 font-mono text-ink/60">{s.cumulative_km} km</td>
                <td className="px-4 py-2.5 font-mono text-ink/60">{s.cutoff_time || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
