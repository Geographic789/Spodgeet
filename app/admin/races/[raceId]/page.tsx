"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { parseGpx, type ParsedRoute, type WaypointFromGpx } from "@/lib/gpxParser";

type Distance = {
  id: string; label: string; distance_km: number;
  elevation_gain_m: number | null; elevation_loss_m: number | null;
  gpx_filename: string | null; start_time: string | null;
};
type Race = { id: string; name: string; race_date: string | null; location: string | null };

export default function RaceDetailPage() {
  const { raceId } = useParams<{ raceId: string }>();
  const [race, setRace]           = useState<Race | null>(null);
  const [distances, setDistances] = useState<Distance[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [label, setLabel]         = useState("");
  const [startTime, setStartTime] = useState("06:00");
  const [parsed, setParsed]       = useState<ParsedRoute | null>(null);
  const [gpxFilename, setGpxFilename] = useState("");
  const [parseError, setParseError]   = useState("");
  const [saving, setSaving]       = useState(false);
  const [detectedWaypoints, setDetectedWaypoints] = useState<WaypointFromGpx[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch(`/api/admin/races/${raceId}`);
    const data = await res.json();
    setRace(data.race);
    setDistances(data.distances || []);
  }

  useEffect(() => { load(); }, [raceId]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");
    try {
      const text = await file.text();
      const result = parseGpx(text);
      setParsed(result);
      setGpxFilename(file.name);
      if (!label) setLabel(`${Math.round(result.totalDistanceKm)}km`);
      // Filter: only keep intermediate checkpoints, not start/finish/water stations
      const aidLike = result.waypoints.filter((w) =>
        w.km_hint !== null && !/^start|^finish|^ws|^water/i.test(w.name)
      );
      setDetectedWaypoints(aidLike);
    } catch (err: any) {
      setParseError(err.message || "Couldn't parse GPX.");
      setParsed(null);
      setDetectedWaypoints([]);
    }
  }

  function removeWaypoint(index: number) {
    setDetectedWaypoints((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed && detectedWaypoints.length === 0) {
      setParseError("Upload a GPX file or the distance will have no route data.");
    }
    setSaving(true);

    const res = await fetch("/api/admin/distances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        race_id: raceId,
        label,
        start_time: startTime,
        distance_km: parsed?.totalDistanceKm ?? 0,
        elevation_gain_m: parsed?.elevationGainM ?? null,
        elevation_loss_m: parsed?.elevationLossM ?? null,
        gpx_filename: gpxFilename || null,
        route_geojson: parsed?.points ?? null,
        sort_order: distances.length,
      }),
    });

    if (!res.ok) {
      const d = await res.json();
      setParseError(d.error || "Couldn't save distance.");
      setSaving(false);
      return;
    }

    const { distance } = await res.json();

    // Auto-create aid stations from GPX waypoints
    for (let i = 0; i < detectedWaypoints.length; i++) {
      const w = detectedWaypoints[i];
      await fetch("/api/admin/aid-stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          distance_id: distance.id,
          name: w.name,
          cumulative_km: w.km_hint ?? 0,
          lat: w.lat, lon: w.lon,
          sort_order: i,
        }),
      });
    }

    setSaving(false);
    setShowForm(false);
    setLabel(""); setStartTime("06:00");
    setParsed(null); setGpxFilename("");
    setDetectedWaypoints([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    load();
  }

  async function handleDelete(id: string, lbl: string) {
    if (!confirm(`Delete distance "${lbl}"? Removes aid stations too.`)) return;
    await fetch(`/api/admin/distances/${id}`, { method: "DELETE" });
    load();
  }

  if (!race) return <p className="text-sm text-ink/60">Loading…</p>;

  return (
    <div>
      <Link href="/admin/races" className="mb-4 inline-block text-sm text-moss-600 hover:underline">← All races</Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="label-eyebrow mb-1">Race</p>
          <h1 className="font-display text-2xl tracking-wide text-ink">{race.name}</h1>
          <p className="text-sm text-ink/60">
            {race.race_date ? new Date(race.race_date).toLocaleDateString() : "No date"}
            {race.location ? ` · ${race.location}` : ""}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ Add distance"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card mb-8 space-y-5 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">Distance label</label>
              <input className="field-input" required value={label}
                onChange={(e) => setLabel(e.target.value)} placeholder="50km" />
            </div>
            <div>
              <label className="field-label">Official start time</label>
              <input type="time" className="field-input" required
                value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              <p className="mt-1 text-xs text-ink/40">Set by race organiser — shown to runners on plan creation</p>
            </div>
          </div>

          <div>
            <label className="field-label">GPX file (optional)</label>
            <input ref={fileInputRef} type="file" accept=".gpx"
              onChange={handleFile} className="field-input cursor-pointer" />
            <p className="mt-1 text-xs text-ink/40">
              If no GPX: map and elevation chart won't show, but the pacing table works perfectly.
              Aid stations must be added manually in the next step.
            </p>
          </div>

          {parsed && (
            <div className="grid grid-cols-3 gap-3 rounded-md border border-moss-200 bg-moss-50 p-4 text-sm">
              <div><p className="text-ink/50">Distance</p><p className="font-mono font-semibold">{parsed.totalDistanceKm.toFixed(1)} km</p></div>
              <div><p className="text-ink/50">Gain</p><p className="font-mono font-semibold text-moss-600">+{Math.round(parsed.elevationGainM)} m</p></div>
              <div><p className="text-ink/50">Loss</p><p className="font-mono font-semibold text-clay-500">-{Math.round(parsed.elevationLossM)} m</p></div>
            </div>
          )}

          {detectedWaypoints.length > 0 && (
            <div>
              <label className="field-label">
                Aid stations detected from GPX ({detectedWaypoints.length})
              </label>
              <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                ⚠ START and FINISH are added automatically — only intermediate checkpoints should appear here. Remove any that are start/finish points.
              </div>
              <div className="space-y-2">
                {detectedWaypoints.map((w, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border border-moss-200 bg-white px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium">{w.name}</span>
                      {w.km_hint !== null && <span className="ml-2 font-mono text-xs text-ink/40">km {w.km_hint}</span>}
                    </span>
                    <button type="button" className="btn-danger" onClick={() => removeWaypoint(i)}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {parseError && <p className="text-sm text-clay-600">{parseError}</p>}

          <button className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : `Save distance${detectedWaypoints.length > 0 ? ` + ${detectedWaypoints.length} aid stations` : ""}`}
          </button>
        </form>
      )}

      {distances.length === 0 && !showForm && (
        <div className="card p-8 text-center text-sm text-ink/60">No distances yet. Add one above.</div>
      )}

      <div className="space-y-3">
        {distances.map((d) => (
          <div key={d.id} className="card flex items-center justify-between p-5">
            <Link href={`/admin/races/${raceId}/distances/${d.id}`} className="flex-1">
              <p className="font-display text-lg tracking-wide text-ink">{d.label}</p>
              <p className="font-mono text-sm text-ink/60">
                {d.distance_km.toFixed(1)} km
                {d.elevation_gain_m != null ? ` · +${Math.round(d.elevation_gain_m)}m` : ""}
                {d.start_time ? ` · starts ${d.start_time}` : ""}
                {!d.gpx_filename && " · no GPX"}
              </p>
            </Link>
            <div className="flex items-center gap-2">
              <Link href={`/admin/races/${raceId}/distances/${d.id}`} className="btn-secondary text-xs">Manage</Link>
              <Link href={`/route/${d.id}`} target="_blank" className="btn-secondary text-xs">View map →</Link>
              <button className="btn-danger" onClick={() => handleDelete(d.id, d.label)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
