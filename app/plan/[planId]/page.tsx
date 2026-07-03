"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PacingTable from "@/components/PacingTable";
import type { PacingRow } from "@/lib/pacingEngine";

type PlanMeta = {
  id: string;
  user_name: string;
  share_token: string;
  pacing_table: PacingRow[];
  notes: string | null;
};

type DistanceMeta = { id: string; label: string; distance_km: number; elevation_gain_m: number | null };
type RaceMeta = { id: string; name: string; race_date: string | null };

export default function PlanPage() {
  const { planId } = useParams<{ planId: string }>();
  const [plan, setPlan] = useState<PlanMeta | null>(null);
  const [distance, setDistance] = useState<DistanceMeta | null>(null);
  const [race, setRace] = useState<RaceMeta | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/plans/${planId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setPlan(d.plan);
        setDistance(d.distance);
        setRace(d.race);
      });
  }, [planId]);

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
      setSavedAt(new Date());
    }
  }

  const startTime = (() => {
    try { return JSON.parse(plan?.notes || "{}").startTime || "06:00"; }
    catch { return "06:00"; }
  })();

  const shareUrl =
    typeof window !== "undefined" && plan
      ? `${window.location.origin}/plan/${plan.share_token}`
      : "";

  return (
    <div className="min-h-screen">
      <header className="border-b border-moss-200/70 bg-white/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/plan/new" className="font-display text-lg tracking-wide text-moss-700">
            SPODGEET
          </Link>
          <div className="flex items-center gap-3">
            {savedAt && (
              <span className="text-xs text-ink/50">
                Saved {savedAt.toLocaleTimeString()}
              </span>
            )}
            {shareUrl && (
              <button
                className="btn-secondary text-xs"
                onClick={() => navigator.clipboard.writeText(shareUrl)}
                title={shareUrl}
              >
                📋 Copy share link
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {error && (
          <div className="card p-8 text-center text-sm text-clay-600">{error}</div>
        )}

        {!error && !plan && (
          <p className="text-sm text-ink/60">Loading plan…</p>
        )}

        {plan && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                {race && <p className="label-eyebrow mb-1">{race.name}{race.race_date ? ` · ${new Date(race.race_date).toLocaleDateString()}` : ""}</p>}
                <h1 className="font-display text-2xl tracking-wide text-ink">
                  {plan.user_name}'s plan — {distance?.label}
                </h1>
                <p className="mt-1 font-mono text-sm text-ink/60">
                  Start: {startTime}
                  {distance?.distance_km ? ` · ${distance.distance_km.toFixed(1)} km` : ""}
                  {distance?.elevation_gain_m ? ` · +${Math.round(distance.elevation_gain_m)}m` : ""}
                </p>
              </div>
              <div className="flex gap-2 self-start sm:self-auto">
                {distance && (
                  <Link href={`/route/${distance.id}`} target="_blank" className="btn-secondary text-xs">View map →</Link>
                )}
                <Link href={`/plan/${plan.id}/result`} className="btn-primary text-xs">🏅 Log result</Link>
              </div>
            </div>

            {/* Pacing table */}
            <PacingTable
              initialRows={plan.pacing_table as PacingRow[]}
              startTime={startTime}
              totalKm={distance?.distance_km || 0}
              onSave={handleSave}
              saving={saving}
            />

            {/* Instructions */}
            <div className="card bg-moss-50/50 p-5 text-sm text-ink/60">
              <p className="font-semibold text-ink/80 mb-1">How to edit</p>
              <p>Click any <span className="font-mono bg-moss-100 px-1 rounded">pace</span> or <span className="font-mono bg-moss-100 px-1 rounded">leg time</span> cell to edit it. That row locks 🔒 and all later rows recalculate automatically. Click 🔒 to unlock and return to auto-calculation. Notes don't trigger recalculation.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
