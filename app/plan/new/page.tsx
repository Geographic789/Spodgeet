"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SpodgeetHeader from "@/components/SpodgeetHeader";

type Distance = { id: string; label: string; distance_km: number; elevation_gain_m: number | null };
type Race = { id: string; name: string; race_date: string | null; location: string | null; distances: Distance[] };

export default function NewPlanPage() {
  const router = useRouter();
  const [races, setRaces] = useState<Race[] | null>(null);
  const [selectedRaceId, setSelectedRaceId] = useState("");
  const [selectedDistanceId, setSelectedDistanceId] = useState("");
  const [userName, setUserName] = useState("");
  const [startTime, setStartTime] = useState("06:00");
  const [basePace, setBasePace] = useState("8");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/public/races").then((r) => r.json()).then((d) => setRaces(d.races || []));
  }, []);

  const selectedRace = races?.find((r) => r.id === selectedRaceId);
  const distances = selectedRace?.distances || [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDistanceId) { setError("Please select a distance."); return; }
    setCreating(true);
    setError("");
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        distanceId: selectedDistanceId,
        userName,
        startTime,
        basePaceMinPerKm: parseFloat(basePace),
      }),
    });
    setCreating(false);
    if (res.ok) {
      const { plan } = await res.json();
      router.push(`/plan/${plan.id}`);
    } else {
      const d = await res.json();
      setError(d.error || "Couldn't create plan.");
    }
  }

  return (
    <div className="min-h-screen">
      <SpodgeetHeader />

      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <p className="label-eyebrow mb-2">New plan</p>
        <h2 className="mb-8 font-display text-2xl tracking-wide text-ink">
          Build your pacing plan
        </h2>

        <form onSubmit={handleCreate} className="card space-y-5 p-7">
          <div>
            <label className="field-label">Race</label>
            <select className="field-input" value={selectedRaceId} required
              onChange={(e) => { setSelectedRaceId(e.target.value); setSelectedDistanceId(""); }}>
              <option value="">— choose a race —</option>
              {races?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}{r.race_date ? ` · ${new Date(r.race_date).toLocaleDateString()}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Distance</label>
            <select className="field-input" value={selectedDistanceId} required
              disabled={!selectedRaceId}
              onChange={(e) => setSelectedDistanceId(e.target.value)}>
              <option value="">— choose a distance —</option>
              {distances.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} ({d.distance_km.toFixed(1)} km
                  {d.elevation_gain_m ? ` · +${Math.round(d.elevation_gain_m)}m` : ""})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Your name</label>
            <input className="field-input" required value={userName}
              onChange={(e) => setUserName(e.target.value)} placeholder="Tula" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Race start time</label>
              <input type="time" className="field-input" required
                value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Base pace (min/km)</label>
              <input type="number" step="0.1" min="3" max="30"
                className="field-input font-mono" required
                value={basePace} onChange={(e) => setBasePace(e.target.value)} />
              <p className="mt-1 text-xs text-ink/40">
                Flat pace — slope &amp; fatigue adjustments are automatic
              </p>
            </div>
          </div>

          {error && <p className="text-sm text-clay-600">{error}</p>}

          <button className="btn-primary w-full py-3 text-base" disabled={creating}>
            {creating ? "Building pacing table…" : "Create plan →"}
          </button>
        </form>
      </main>
    </div>
  );
}
