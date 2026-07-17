"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import SpodgeetHeader from "@/components/SpodgeetHeader";
import ElevationChart from "@/components/ElevationChart";
import { downsample, nearestAidStation, GRADIENT_CONFIG, gradientCategory, type AidStation, type DistanceWithRoute, type RaceSummary } from "@/lib/routeTypes";

const RouteMap = dynamic(() => import("@/components/RouteMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-ink/50">Loading map…</div>,
});

export default function RouteViewerPage() {
  const { distanceId } = useParams<{ distanceId: string }>();
  const [distance, setDistance] = useState<DistanceWithRoute | null>(null);
  const [race, setRace]         = useState<RaceSummary | null>(null);
  const [aidStations, setAidStations] = useState<AidStation[]>([]);
  const [hoverCumKm, setHoverCumKm] = useState<number | null>(null);
  const [showGradientColors, setShowGradientColors] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/distances/${distanceId}`)
      .then(async (r) => {
        if (!r.ok) { const b = await r.json(); throw new Error(b.error); }
        return r.json();
      })
      .then((d) => { setDistance(d.distance); setRace(d.race); setAidStations(d.aidStations || []); })
      .catch((e) => setError(e.message));
  }, [distanceId]);

  const fullPoints = useMemo(() => distance?.route_geojson || [], [distance]);
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

  return (
    <div className="min-h-screen">
      <SpodgeetHeader />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-6">
        {error && <div className="card p-8 text-center text-sm text-clay-600">{error}</div>}
        {!error && !distance && <p className="text-sm text-ink/60">Loading route…</p>}

        {distance && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                {race && <p className="label-eyebrow mb-1">{race.name}</p>}
                <h2 className="font-display text-2xl tracking-wide text-ink">{distance.label}</h2>
                <p className="font-mono text-sm text-ink/60">
                  {distance.distance_km.toFixed(1)} km
                  {distance.elevation_gain_m != null ? ` · +${Math.round(distance.elevation_gain_m)}m` : ""}
                  {distance.elevation_loss_m != null ? ` / -${Math.round(distance.elevation_loss_m)}m` : ""}
                </p>
              </div>
              <Link href="/plan/new" className="btn-primary text-xs">
                Create pacing plan →
              </Link>
            </div>

            {/* Hover status */}
            <div className="flex flex-wrap items-center gap-3 text-sm min-h-[28px]">
              {hoverCumKm !== null ? (
                <>
                  <span className="font-mono font-semibold text-ink">{hoverCumKm.toFixed(1)} km</span>
                  {hoverGradient !== null && (
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                      style={{ backgroundColor: GRADIENT_CONFIG[gradientCategory(hoverGradient)].color }}>
                      {hoverGradient > 0 ? "+" : ""}{hoverGradient.toFixed(1)}%
                      {" "}{GRADIENT_CONFIG[gradientCategory(hoverGradient)].label}
                    </span>
                  )}
                  {nearestStation && <span className="text-xs text-ink/50">📍 {nearestStation.name}</span>}
                </>
              ) : (
                <span className="text-xs text-ink/40">Hover or touch the elevation chart to explore</span>
              )}
            </div>

            {/* Gradient legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {Object.entries(GRADIENT_CONFIG).map(([key, val]) => (
                <span key={key} className="flex items-center gap-1.5 text-xs text-ink/60">
                  <span className="inline-block h-2.5 w-4 rounded-sm" style={{ backgroundColor: val.color }} />
                  {val.label}
                </span>
              ))}
              <button onClick={() => setShowGradientColors(s => !s)}
                className="ml-auto text-xs text-moss-600 hover:underline">
                {showGradientColors ? "Solid line" : "Gradient colors"}
              </button>
            </div>

            {/* MAP */}
            <div className="card h-[380px] overflow-hidden sm:h-[440px]">
              <RouteMap points={fullPoints as any} aidStations={aidStations}
                hoverCumKm={hoverCumKm} showGradientColors={showGradientColors} />
            </div>

            {/* ELEVATION CHART */}
            <div>
              <p className="label-eyebrow mb-2">Elevation profile</p>
              <div className="card h-[200px] p-3 sm:h-[220px]">
                <ElevationChart points={chartPoints as any} aidStations={aidStations}
                  hoverCumKm={hoverCumKm} onHover={setHoverCumKm} />
              </div>
            </div>

            {/* Aid stations */}
            <div className="card overflow-hidden">
              <div className="border-b border-moss-200/70 bg-moss-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Aid stations</p>
              </div>
              {aidStations.length === 0 ? (
                <p className="p-4 text-sm text-ink/40">No aid stations added yet.</p>
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
          </>
        )}
      </main>
    </div>
  );
}
