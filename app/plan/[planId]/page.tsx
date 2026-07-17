"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import SpodgeetHeader from "@/components/SpodgeetHeader";
import ElevationChart from "@/components/ElevationChart";
import PacingTable from "@/components/PacingTable";
import {
  downsample, nearestAidStation, GRADIENT_CONFIG, gradientCategory,
  type AidStation,
} from "@/lib/routeTypes";
import { isOverCutoff, isLowBuffer, type PacingRow } from "@/lib/pacingEngine";

const RouteMap = dynamic(() => import("@/components/RouteMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-ink/50">Loading map…</div>,
});

type DistanceMeta = {
  id: string; label: string; distance_km: number;
  elevation_gain_m: number | null; route_geojson: any[] | null;
};
type RaceMeta = { name: string; race_date: string | null };

function Countdown({ raceDate }: { raceDate: string | null }) {
  if (!raceDate) return null;
  const diff = Math.ceil((new Date(raceDate).getTime() - Date.now()) / 86400000);
  if (diff < 0)  return <span className="text-ink/40">Race completed</span>;
  if (diff === 0) return <span className="text-clay-600 font-bold">🏁 Race day!</span>;
  return <span className="text-clay-600 font-semibold">🐯 {diff} days to race</span>;
}

export default function PlanPage() {
  const { planId } = useParams<{ planId: string }>();
  const [plan, setPlan]           = useState<any>(null);
  const [distance, setDistance]   = useState<DistanceMeta | null>(null);
  const [race, setRace]           = useState<RaceMeta | null>(null);
  const [aidStations, setAidStations] = useState<AidStation[]>([]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");
  const [hoverCumKm, setHoverCumKm] = useState<number | null>(null);
  const [showGradientColors, setShowGradientColors] = useState(true);

  useEffect(() => {
    fetch(`/api/plans/${planId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setPlan(d.plan);
        setDistance(d.distance);
        setRace(d.race);
        setAidStations(d.aidStations || []);
      });
  }, [planId]);

  const startTime = useMemo(() => {
    try { return JSON.parse(plan?.notes || "{}").startTime || "06:00"; }
    catch { return "06:00"; }
  }, [plan]);

  const fullPoints  = useMemo(() => distance?.route_geojson || [], [distance]);
  const chartPoints = useMemo(() => downsample(fullPoints as any, 600), [fullPoints]);

  const hoverGradient = useMemo(() => {
    if (hoverCumKm === null || !chartPoints.length) return null;
    const pt = chartPoints.reduce((prev, cur) =>
      Math.abs(cur.cum_km - hoverCumKm) < Math.abs(prev.cum_km - hoverCumKm) ? cur : prev
    );
    return pt?.gradient ?? null;
  }, [hoverCumKm, chartPoints]);

  const nearestStation = useMemo(() => {
    if (hoverCumKm === null) return null;
    return nearestAidStation(aidStations, hoverCumKm);
  }, [hoverCumKm, aidStations]);

  // Compute cutoff status per aid station from current pacing rows
  const aidStatuses = useMemo(() => {
    const rows: PacingRow[] = plan?.pacing_table || [];
    const result: Record<string, "over" | "low" | "ok" | "default"> = {};
    for (const row of rows) {
      if (!aidStations.find((s) => s.id === row.stationId)) continue;
      if (isOverCutoff(row))      result[row.stationId] = "over";
      else if (isLowBuffer(row))  result[row.stationId] = "low";
      else if (row.cutoffTime)    result[row.stationId] = "ok";
      else                        result[row.stationId] = "default";
    }
    return result;
  }, [plan, aidStations]);

  async function handleSave(rows: PacingRow[]) {
    if (!plan) return;
    setSaving(true);
    const res = await fetch(`/api/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pacing_table: rows, notes: plan.notes }),
    });
    setSaving(false);
    if (res.ok) {
      const { plan: updated } = await res.json();
      setPlan(updated);
    }
  }

  const shareUrl = typeof window !== "undefined" && plan
    ? `${window.location.origin}/plan/${plan.share_token}` : "";

  const planTitle = plan?.plan_name
    ? `${plan.plan_name} — ${plan.user_name}`
    : `${plan?.user_name}'s plan`;

  return (
    <div className="min-h-screen">
      <SpodgeetHeader />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-6">
        {error && <div className="card p-8 text-center text-sm text-clay-600">{error}</div>}
        {!error && !plan && <p className="text-sm text-ink/60">Loading plan…</p>}

        {plan && (
          <>
            {/* Plan info bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                {race && <p className="label-eyebrow mb-1">{race.name}</p>}
                <h2 className="font-display text-xl tracking-wide text-ink">
                  {planTitle} · {distance?.label}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm text-ink/60">
                  <span>🏁 {startTime}</span>
                  {distance?.distance_km && <span>{distance.distance_km.toFixed(1)} km</span>}
                  {distance?.elevation_gain_m && <span>+{Math.round(distance.elevation_gain_m)}m</span>}
                  <Countdown raceDate={race?.race_date ?? null} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {shareUrl && (
                  <button className="btn-secondary text-xs"
                    onClick={() => navigator.clipboard.writeText(shareUrl)}>
                    📋 Share link
                  </button>
                )}
                <Link href={`/plan/${plan.id}/result`} className="btn-primary text-xs">🏅 Log result</Link>
              </div>
            </div>

            {/* MAP */}
            {fullPoints.length > 0 && (
              <section>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="label-eyebrow">Route map</p>
                  <div className="flex items-center gap-3">
                    {hoverCumKm !== null && (
                      <span className="font-mono text-xs text-ink/60">
                        {hoverCumKm.toFixed(1)} km
                        {hoverGradient !== null && (
                          <span className="ml-2 rounded-full px-1.5 py-0.5 text-white text-xs font-bold"
                            style={{ backgroundColor: GRADIENT_CONFIG[gradientCategory(hoverGradient)].color }}>
                            {hoverGradient > 0 ? "+" : ""}{hoverGradient.toFixed(1)}%
                          </span>
                        )}
                        {nearestStation && <span className="ml-2 text-ink/40">📍 {nearestStation.name}</span>}
                      </span>
                    )}
                    <button onClick={() => setShowGradientColors(s => !s)}
                      className="text-xs text-moss-600 hover:underline">
                      {showGradientColors ? "Solid line" : "Gradient"}
                    </button>
                  </div>
                </div>
                {/* Gradient legend */}
                <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
                  {Object.entries(GRADIENT_CONFIG).map(([key, val]) => (
                    <span key={key} className="flex items-center gap-1 text-xs text-ink/50">
                      <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: val.color }} />
                      {val.label}
                    </span>
                  ))}
                  <span className="ml-2 flex items-center gap-2 text-xs text-ink/50">
                    <span className="inline-flex gap-1">
                      <span className="inline-block h-3 w-3 rounded-full bg-[#ef4444] border-2 border-white" />over cutoff
                      <span className="inline-block h-3 w-3 rounded-full bg-[#f97316] border-2 border-white ml-1" />low buffer
                    </span>
                  </span>
                </div>
                <div className="card h-[380px] overflow-hidden sm:h-[420px]">
                  <RouteMap
                    points={fullPoints as any}
                    aidStations={aidStations}
                    hoverCumKm={hoverCumKm}
                    showGradientColors={showGradientColors}
                    aidStatuses={aidStatuses}
                  />
                </div>
              </section>
            )}

            {/* ELEVATION CHART */}
            {chartPoints.length > 0 && (
              <section>
                <p className="label-eyebrow mb-2">Elevation profile — hover or touch · drag brush to zoom</p>
                <div className="card h-[240px] p-3 sm:h-[260px]">
                  <ElevationChart
                    points={chartPoints as any}
                    aidStations={aidStations}
                    hoverCumKm={hoverCumKm}
                    onHover={setHoverCumKm}
                  />
                </div>
              </section>
            )}

            {/* PACING TABLE */}
            <section>
              <p className="label-eyebrow mb-3">Pacing table</p>
              <PacingTable
                initialRows={plan.pacing_table as PacingRow[]}
                startTime={startTime}
                onSave={handleSave}
                saving={saving}
              />
            </section>

            <div className="card bg-moss-50/50 p-4 text-sm text-ink/60">
              <strong className="text-ink/80">Editing: </strong>
              Tap <span className="font-mono bg-white px-1 rounded">pace</span> to set speed →
              leg time auto-calculates. Or tap <span className="font-mono bg-white px-1 rounded">leg time</span> directly →
              pace back-calculates. Either way, all rows below cascade automatically.
              Tap 🔒 to unlock a row. Rest time at each station shifts all arrivals below it.
            </div>
          </>
        )}
      </main>
    </div>
  );
}
