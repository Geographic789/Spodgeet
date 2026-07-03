"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type AidStation = {
  id: string;
  name: string;
  cumulative_km: number;
  cutoff_time: string | null;
};

type GearItem = { item: string; required: boolean };

type Distance = {
  id: string;
  label: string;
  distance_km: number;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  gpx_filename: string | null;
  mandatory_gear: GearItem[];
};

const emptyStation = { name: "", cumulative_km: "", cutoff_time: "" };

export default function DistanceDetailPage() {
  const { raceId, distanceId } = useParams<{ raceId: string; distanceId: string }>();
  const [distance, setDistance] = useState<Distance | null>(null);
  const [stations, setStations] = useState<AidStation[]>([]);
  const [stationForm, setStationForm] = useState(emptyStation);
  const [savingStation, setSavingStation] = useState(false);
  const [newGearItem, setNewGearItem] = useState("");

  async function load() {
    const res = await fetch(`/api/admin/distances/${distanceId}`);
    const data = await res.json();
    setDistance(data.distance);
    setStations(data.aidStations || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distanceId]);

  async function handleAddStation(e: React.FormEvent) {
    e.preventDefault();
    setSavingStation(true);
    const res = await fetch("/api/admin/aid-stations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        distance_id: distanceId,
        name: stationForm.name,
        cumulative_km: parseFloat(stationForm.cumulative_km),
        cutoff_time: stationForm.cutoff_time || null,
      }),
    });
    setSavingStation(false);
    if (res.ok) {
      setStationForm(emptyStation);
      load();
    }
  }

  async function handleDeleteStation(id: string) {
    await fetch(`/api/admin/aid-stations/${id}`, { method: "DELETE" });
    load();
  }

  async function handleAddGear() {
    if (!newGearItem.trim() || !distance) return;
    const updated = [...(distance.mandatory_gear || []), { item: newGearItem.trim(), required: true }];
    await fetch(`/api/admin/distances/${distanceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mandatory_gear: updated }),
    });
    setNewGearItem("");
    load();
  }

  async function handleRemoveGear(index: number) {
    if (!distance) return;
    const updated = distance.mandatory_gear.filter((_, i) => i !== index);
    await fetch(`/api/admin/distances/${distanceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mandatory_gear: updated }),
    });
    load();
  }

  if (!distance) return <p className="text-sm text-ink/60">Loading…</p>;

  return (
    <div>
      <Link href={`/admin/races/${raceId}`} className="mb-4 inline-block text-sm text-moss-600 hover:underline">
        ← Back to race
      </Link>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="label-eyebrow mb-1">Distance</p>
          <h1 className="font-display text-2xl tracking-wide text-ink">{distance.label}</h1>
          <p className="font-mono text-sm text-ink/60">
            {distance.distance_km.toFixed(1)} km
            {distance.elevation_gain_m != null ? ` · +${Math.round(distance.elevation_gain_m)}m` : ""}
            {distance.elevation_loss_m != null ? ` / -${Math.round(distance.elevation_loss_m)}m` : ""}
            {distance.gpx_filename ? ` · ${distance.gpx_filename}` : ""}
          </p>
        </div>
        <Link href={`/route/${distance.id}`} target="_blank" className="btn-secondary text-xs">
          View map & elevation →
        </Link>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-lg tracking-wide text-ink">Aid stations</h2>

        <form onSubmit={handleAddStation} className="card mb-4 grid grid-cols-1 gap-3 p-5 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <div>
            <label className="field-label">Name</label>
            <input
              className="field-input"
              required
              value={stationForm.name}
              onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })}
              placeholder="AS1 — Doi Pui"
            />
          </div>
          <div>
            <label className="field-label">Cumulative km</label>
            <input
              type="number"
              step="0.1"
              className="field-input"
              required
              value={stationForm.cumulative_km}
              onChange={(e) => setStationForm({ ...stationForm, cumulative_km: e.target.value })}
            />
          </div>
          <div>
            <label className="field-label">Cutoff (HH:MM)</label>
            <input
              className="field-input"
              value={stationForm.cutoff_time}
              onChange={(e) => setStationForm({ ...stationForm, cutoff_time: e.target.value })}
              placeholder="14:30"
            />
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full sm:w-auto" disabled={savingStation}>
              {savingStation ? "Adding…" : "Add"}
            </button>
          </div>
        </form>

        {stations.length === 0 ? (
          <p className="text-sm text-ink/50">No aid stations yet.</p>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-moss-50 text-left text-xs uppercase tracking-wide text-ink/50">
                <tr>
                  <th className="px-4 py-2.5">Station</th>
                  <th className="px-4 py-2.5">Cum. km</th>
                  <th className="px-4 py-2.5">Cutoff</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {stations.map((s) => (
                  <tr key={s.id} className="border-t border-moss-100">
                    <td className="px-4 py-2.5">{s.name}</td>
                    <td className="px-4 py-2.5 font-mono">{s.cumulative_km}</td>
                    <td className="px-4 py-2.5 font-mono">{s.cutoff_time || "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button className="btn-danger" onClick={() => handleDeleteStation(s.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg tracking-wide text-ink">Mandatory gear</h2>
        <div className="card p-5">
          <div className="mb-4 flex gap-2">
            <input
              className="field-input"
              value={newGearItem}
              onChange={(e) => setNewGearItem(e.target.value)}
              placeholder="e.g. Headlamp with spare batteries"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddGear())}
            />
            <button className="btn-primary whitespace-nowrap" onClick={handleAddGear}>
              + Add item
            </button>
          </div>
          {distance.mandatory_gear?.length ? (
            <ul className="space-y-2">
              {distance.mandatory_gear.map((g, i) => (
                <li key={i} className="flex items-center justify-between rounded-md bg-moss-50 px-3 py-2 text-sm">
                  <span>{g.item}</span>
                  <button className="btn-danger" onClick={() => handleRemoveGear(i)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/50">No mandatory gear items yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
