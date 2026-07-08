"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { RaceResultOutput } from "@/lib/xpEngine";

type PlanMeta = {
  id: string;
  user_name: string;
  distance_id: string;
};

type DistanceMeta = {
  label: string;
  distance_km: number;
  elevation_gain_m: number | null;
};

type RaceMeta = { name: string };

const GROUP_STYLES: Record<string, { bg: string; border: string; emoji: string; label: string }> = {
  G1:  { bg: "bg-amber-50",  border: "border-amber-300", emoji: "🥇", label: "Top 25%" },
  G2:  { bg: "bg-moss-50",   border: "border-moss-300",  emoji: "🥈", label: "Top 50%" },
  G3:  { bg: "bg-blue-50",   border: "border-blue-300",  emoji: "🥉", label: "51–75%" },
  G4:  { bg: "bg-clay-50",   border: "border-clay-300",  emoji: "💀", label: "76–100%" },
  DNF: { bg: "bg-gray-50",   border: "border-gray-300",  emoji: "❌", label: "DNF" },
};

export default function ResultPage() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();

  const [plan, setPlan] = useState<PlanMeta | null>(null);
  const [distance, setDistance] = useState<DistanceMeta | null>(null);
  const [race, setRace] = useState<RaceMeta | null>(null);
  const [existingResult, setExistingResult] = useState<any>(null);
  const [computed, setComputed] = useState<RaceResultOutput | null>(null);

  const [status, setStatus] = useState<"Finished" | "DNF">("Finished");
  const [overallRank, setOverallRank] = useState("");
  const [genderRank, setGenderRank] = useState("");
  const [ageGroupRank, setAgeGroupRank] = useState("");
  const [totalFinishers, setTotalFinishers] = useState("");
  const [top100, setTop100] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Load plan details
    fetch(`/api/plans/${planId}`)
      .then((r) => r.json())
      .then((d) => {
        setPlan(d.plan);
        setDistance(d.distance);
        setRace(d.race);
      });
    // Check for existing result
    fetch(`/api/race-results/${planId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.result) {
          setExistingResult(d.result);
          setComputed(d.computed);
          setSubmitted(true);
          setStatus(d.result.status);
          setOverallRank(d.result.overall_rank?.toString() || "");
          setTotalFinishers(d.result.total_finishers?.toString() || "");
          setTop100(d.result.top_100);
        }
      });
  }, [planId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/race-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: planId,
        status,
        overall_rank: overallRank ? parseInt(overallRank) : null,
        gender_rank: genderRank ? parseInt(genderRank) : null,
        age_group_rank: ageGroupRank ? parseInt(ageGroupRank) : null,
        total_finishers: totalFinishers ? parseInt(totalFinishers) : null,
        top_100: top100,
        actual_distance_km: distance?.distance_km || 0,
        actual_elevation_gain_m: distance?.elevation_gain_m || 0,
        pace_delta_min: null,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      const { computed: c } = await res.json();
      setComputed(c);
      setSubmitted(true);
    } else {
      const d = await res.json();
      setError(d.error || "Couldn't save result.");
    }
  }

  const groupStyle = computed
    ? GROUP_STYLES[computed.percentile_group] ?? GROUP_STYLES.G3
    : null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-moss-200/70 bg-white/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href={`/plan/${planId}`} className="font-display text-lg tracking-wide text-moss-700">
            SPODGEET
          </Link>
          <Link href={`/plan/${planId}`} className="btn-secondary text-xs">← Back to plan</Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 space-y-6">
        {/* Header */}
        <div>
          {race && <p className="label-eyebrow mb-1">{race.name}</p>}
          <h1 className="font-display text-2xl tracking-wide text-ink">
            Post-race review
            {plan && <span className="text-ink/50"> — {plan.user_name}</span>}
          </h1>
          {distance && (
            <p className="font-mono text-sm text-ink/60">
              {distance.label} · {distance.distance_km.toFixed(1)} km
              {distance.elevation_gain_m ? ` · +${Math.round(distance.elevation_gain_m)}m` : ""}
            </p>
          )}
        </div>

        {/* Result entry form */}
        {!submitted && (
          <form onSubmit={handleSubmit} className="card space-y-5 p-7">
            {/* Status */}
            <div>
              <label className="field-label">Race status</label>
              <div className="flex gap-3">
                {(["Finished", "DNF"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex-1 rounded-md border-2 py-3 text-sm font-bold transition-colors ${
                      status === s
                        ? s === "Finished"
                          ? "border-moss-500 bg-moss-50 text-moss-700"
                          : "border-clay-500 bg-clay-50 text-clay-700"
                        : "border-moss-200 text-ink/50 hover:border-moss-300"
                    }`}
                  >
                    {s === "Finished" ? "✅ Finished" : "❌ DNF"}
                  </button>
                ))}
              </div>
            </div>

            {status === "Finished" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="field-label">Overall rank</label>
                    <input type="number" min="1" className="field-input font-mono"
                      value={overallRank} onChange={(e) => setOverallRank(e.target.value)}
                      placeholder="e.g. 47" />
                  </div>
                  <div>
                    <label className="field-label">Total finishers</label>
                    <input type="number" min="1" className="field-input font-mono"
                      value={totalFinishers} onChange={(e) => setTotalFinishers(e.target.value)}
                      placeholder="e.g. 200" />
                  </div>
                  <div>
                    <label className="field-label">Gender rank</label>
                    <input type="number" min="1" className="field-input font-mono"
                      value={genderRank} onChange={(e) => setGenderRank(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Age group rank</label>
                    <input type="number" min="1" className="field-input font-mono"
                      value={ageGroupRank} onChange={(e) => setAgeGroupRank(e.target.value)} />
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-moss-300 text-moss-600"
                    checked={top100}
                    onChange={(e) => setTop100(e.target.checked)}
                  />
                  <span className="text-sm font-medium text-ink">🏆 Overall Top 100</span>
                </label>
              </>
            )}

            {error && <p className="text-sm text-clay-600">{error}</p>}

            <button className="btn-primary w-full text-base py-3" disabled={submitting}>
              {submitting ? "Processing…" : "Submit result 🎉"}
            </button>
          </form>
        )}

        {/* Result display */}
        {submitted && computed && groupStyle && (
          <div className="space-y-4">
            {/* XP + Level card */}
            <div className={`card border-2 ${groupStyle.border} ${groupStyle.bg} p-7 text-center`}>
              <p className="text-5xl mb-3">{groupStyle.emoji}</p>
              <p className="label-eyebrow mb-1">{groupStyle.label}</p>
              <h2 className="font-display text-3xl tracking-wide text-ink mb-1">
                {computed.level_title}
              </h2>
              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="font-mono text-4xl font-bold text-moss-700">
                  +{computed.xp_earned}
                </span>
                <span className="text-lg text-ink/60">XP</span>
              </div>
              {/* XP bar */}
              <div className="mt-3 mx-auto max-w-xs">
                <div className="h-2.5 w-full rounded-full bg-moss-200/70">
                  <div
                    className="h-2.5 rounded-full bg-moss-600 transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        ((computed.xp_earned - computed.level_xp_min) /
                          Math.max(1, computed.level_xp_max - computed.level_xp_min)) *
                          100
                      )}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-ink/50 font-mono">
                  {computed.xp_earned} / {computed.level_xp_max === 999999 ? "∞" : computed.level_xp_max} XP
                </p>
              </div>
              {computed.percentile_value !== null && (
                <p className="mt-3 text-sm text-ink/60">
                  Top {computed.percentile_value.toFixed(0)}% of finishers
                </p>
              )}
            </div>

            {/* Roast comments */}
            {computed.triggered_comments.length > 0 && (
              <div className="card p-6 space-y-3">
                <p className="label-eyebrow mb-3">วิจารณ์ประจำสนาม 🔥</p>
                {computed.triggered_comments.map((comment, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-moss-200 bg-moss-50/60 px-4 py-3 text-sm text-ink leading-relaxed"
                  >
                    {comment}
                  </div>
                ))}
                <button
                  onClick={() => {
                    fetch(`/api/race-results/${planId}`)
                      .then((r) => r.json())
                      .then((d) => { if (d.computed) setComputed(d.computed); });
                  }}
                  className="btn-secondary text-xs w-full mt-2"
                >
                  🔀 New random comments
                </button>
              </div>
            )}

            {/* Re-submit option */}
            <button
              onClick={() => setSubmitted(false)}
              className="btn-secondary text-xs w-full"
            >
              Edit result
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
