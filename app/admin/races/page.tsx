"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Race = {
  id: string;
  name: string;
  race_date: string | null;
  location: string | null;
  distances: { id: string }[];
};

const emptyForm = {
  name: "",
  race_date: "",
  location: "",
  logo_url: "",
  route_map_url: "",
  official_link: "",
  timezone: "Asia/Bangkok",
};

export default function RacesPage() {
  const [races, setRaces] = useState<Race[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadRaces() {
    const res = await fetch("/api/admin/races");
    const data = await res.json();
    setRaces(data.races || []);
  }

  useEffect(() => {
    loadRaces();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/races", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setForm(emptyForm);
      setShowForm(false);
      loadRaces();
    } else {
      const data = await res.json();
      setError(data.error || "Couldn't create race.");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all of its distances? This can't be undone.`)) return;
    await fetch(`/api/admin/races/${id}`, { method: "DELETE" });
    loadRaces();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="label-eyebrow mb-1">Master data</p>
          <h1 className="font-display text-2xl tracking-wide text-ink">Races</h1>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ New race"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card mb-8 grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label">Race name</label>
            <input
              className="field-input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Doi Inthanon Trail Festival"
            />
          </div>
          <div>
            <label className="field-label">Date</label>
            <input
              type="date"
              className="field-input"
              value={form.race_date}
              onChange={(e) => setForm({ ...form, race_date: e.target.value })}
            />
          </div>
          <div>
            <label className="field-label">Location</label>
            <input
              className="field-input"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Chiang Mai, Thailand"
            />
          </div>
          <div>
            <label className="field-label">Timezone</label>
            <input
              className="field-input"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            />
          </div>
          <div>
            <label className="field-label">Official link</label>
            <input
              className="field-input"
              value={form.official_link}
              onChange={(e) => setForm({ ...form, official_link: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="field-label">Logo URL</label>
            <input
              className="field-input"
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              placeholder="https://... (upload an image somewhere and paste the link)"
            />
          </div>
          <div>
            <label className="field-label">Official route map image URL</label>
            <input
              className="field-input"
              value={form.route_map_url}
              onChange={(e) => setForm({ ...form, route_map_url: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-clay-600 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <button className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Create race"}
            </button>
          </div>
        </form>
      )}

      {races === null && <p className="text-sm text-ink/60">Loading…</p>}
      {races?.length === 0 && (
        <div className="card p-8 text-center text-sm text-ink/60">
          No races yet. Create the first one above to start seeding master data.
        </div>
      )}

      <div className="space-y-3">
        {races?.map((race) => (
          <div key={race.id} className="card flex items-center justify-between p-5">
            <Link href={`/admin/races/${race.id}`} className="flex-1">
              <p className="font-display text-lg tracking-wide text-ink">{race.name}</p>
              <p className="text-sm text-ink/60">
                {race.race_date ? new Date(race.race_date).toLocaleDateString() : "No date set"}
                {race.location ? ` · ${race.location}` : ""}
                {" · "}
                {race.distances?.length || 0} distance{race.distances?.length === 1 ? "" : "s"}
              </p>
            </Link>
            <div className="flex items-center gap-2">
              <Link href={`/admin/races/${race.id}`} className="btn-secondary text-xs">
                Manage
              </Link>
              <button className="btn-danger" onClick={() => handleDelete(race.id, race.name)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
