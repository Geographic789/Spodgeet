"use client";

import { useEffect, useState } from "react";
import type { TriggerCondition } from "@/lib/xpEngine";

const TRIGGER_CONDITIONS: { value: TriggerCondition; label: string; description: string }[] = [
  { value: "Percentile_G1", label: "🥇 Group 1 (Top 25%)",    description: "Keep minimal — 1-2 lines only" },
  { value: "Percentile_G2", label: "🥈 Group 2 (26–50%)",     description: "Medium roast" },
  { value: "Percentile_G3", label: "🥉 Group 3 (51–75%)",     description: "Heavy roast — most friends land here" },
  { value: "Percentile_G4", label: "💀 Group 4 (76–100%)",    description: "Maximum roast, keep it fun" },
  { value: "DNF",           label: "❌ DNF",                   description: "Roast + empathy combo" },
  { value: "Ahead_Pace",    label: "⚡ Ahead of pace",         description: "Came in faster than the plan" },
  { value: "Behind_Pace",   label: "🐢 Behind pace",           description: "Came in slower than the plan" },
  { value: "Top_100",       label: "🏆 Top 100 bonus",         description: "Overall top 100 finishers" },
];

type Comment = { id: string; trigger_condition: TriggerCondition; comment_text: string };
type Level   = { id: string; min_xp: number; max_xp: number; title_name: string; sort_order: number };

export default function GamificationPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [levels, setLevels]     = useState<Level[]>([]);
  const [activeTab, setActiveTab] = useState<"comments" | "levels">("comments");
  const [activeTrigger, setActiveTrigger] = useState<TriggerCondition>("Percentile_G3");
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [newLevel, setNewLevel] = useState({ min_xp: "", max_xp: "", title_name: "" });
  const [addingLevel, setAddingLevel] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/gamification");
    const data = await res.json();
    setComments(data.comments || []);
    setLevels(data.levels || []);
  }

  useEffect(() => { load(); }, []);

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setAddingComment(true);
    await fetch("/api/admin/gamification/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger_condition: activeTrigger, comment_text: newComment.trim() }),
    });
    setNewComment("");
    setAddingComment(false);
    load();
  }

  async function handleDeleteComment(id: string) {
    await fetch(`/api/admin/gamification/comments/${id}`, { method: "DELETE" });
    load();
  }

  async function handleAddLevel(e: React.FormEvent) {
    e.preventDefault();
    setAddingLevel(true);
    await fetch("/api/admin/gamification/levels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        min_xp: parseFloat(newLevel.min_xp),
        max_xp: parseFloat(newLevel.max_xp),
        title_name: newLevel.title_name,
        sort_order: levels.length,
      }),
    });
    setNewLevel({ min_xp: "", max_xp: "", title_name: "" });
    setAddingLevel(false);
    load();
  }

  async function handleDeleteLevel(id: string) {
    await fetch(`/api/admin/gamification/levels/${id}`, { method: "DELETE" });
    load();
  }

  const filteredComments = comments.filter((c) => c.trigger_condition === activeTrigger);
  const triggerInfo = TRIGGER_CONDITIONS.find((t) => t.value === activeTrigger);

  return (
    <div>
      <div className="mb-6">
        <p className="label-eyebrow mb-1">Admin</p>
        <h1 className="font-display text-2xl tracking-wide text-ink">Gamification</h1>
        <p className="text-sm text-ink/60">Manage XP levels and roast comment pools</p>
      </div>

      {/* Tab toggle */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setActiveTab("comments")}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${activeTab === "comments" ? "bg-moss-600 text-sand" : "bg-moss-100 text-moss-700"}`}
        >
          💬 Comment pools
        </button>
        <button
          onClick={() => setActiveTab("levels")}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${activeTab === "levels" ? "bg-moss-600 text-sand" : "bg-moss-100 text-moss-700"}`}
        >
          ⭐ Level titles
        </button>
      </div>

      {/* ── COMMENTS TAB ── */}
      {activeTab === "comments" && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[280px_1fr]">
          {/* Trigger selector */}
          <div className="card p-4 space-y-1 h-fit">
            <p className="field-label mb-3">Select trigger</p>
            {TRIGGER_CONDITIONS.map((t) => {
              const count = comments.filter((c) => c.trigger_condition === t.value).length;
              return (
                <button
                  key={t.value}
                  onClick={() => setActiveTrigger(t.value)}
                  className={`w-full text-left rounded-md px-3 py-2.5 text-sm transition-colors ${
                    activeTrigger === t.value
                      ? "bg-moss-600 text-sand"
                      : "hover:bg-moss-50 text-ink"
                  }`}
                >
                  <span className="font-medium">{t.label}</span>
                  <span className={`ml-2 text-xs ${activeTrigger === t.value ? "text-sand/70" : "text-ink/40"}`}>
                    {count} comment{count !== 1 ? "s" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Comment editor */}
          <div className="space-y-4">
            <div className="card p-5">
              <p className="font-display text-lg text-ink mb-0.5">{triggerInfo?.label}</p>
              <p className="text-xs text-ink/50 mb-4">{triggerInfo?.description}</p>

              <form onSubmit={handleAddComment} className="flex gap-2 mb-5">
                <input
                  className="field-input flex-1"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="เพิ่มคอมเมนต์ใหม่... ยิ่งตลกยิ่งดี 🔥"
                />
                <button className="btn-primary whitespace-nowrap" disabled={addingComment}>
                  {addingComment ? "Adding…" : "+ Add"}
                </button>
              </form>

              {filteredComments.length === 0 ? (
                <p className="text-sm text-ink/40 text-center py-8">
                  No comments yet for this trigger. Add the first one!
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredComments.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-moss-100 bg-moss-50/50 px-4 py-3"
                    >
                      <p className="text-sm text-ink leading-relaxed">{c.comment_text}</p>
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="shrink-0 text-xs text-clay-500 hover:text-clay-700"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── LEVELS TAB ── */}
      {activeTab === "levels" && (
        <div className="space-y-5">
          <form onSubmit={handleAddLevel} className="card grid grid-cols-1 gap-3 p-5 sm:grid-cols-[1fr_1fr_2fr_auto]">
            <div>
              <label className="field-label">Min XP</label>
              <input type="number" className="field-input font-mono" required
                value={newLevel.min_xp} onChange={(e) => setNewLevel({ ...newLevel, min_xp: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Max XP</label>
              <input type="number" className="field-input font-mono" required
                value={newLevel.max_xp} onChange={(e) => setNewLevel({ ...newLevel, max_xp: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Title</label>
              <input className="field-input" required placeholder="เทพเจ้าดอยอินทนนท์"
                value={newLevel.title_name} onChange={(e) => setNewLevel({ ...newLevel, title_name: e.target.value })} />
            </div>
            <div className="flex items-end">
              <button className="btn-primary w-full" disabled={addingLevel}>
                {addingLevel ? "Adding…" : "+ Add level"}
              </button>
            </div>
          </form>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-moss-50 text-left">
                <tr>
                  {["XP Range", "Title", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink/50">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {levels.map((lvl) => (
                  <tr key={lvl.id} className="border-t border-moss-100">
                    <td className="px-4 py-3 font-mono text-sm text-ink/70">
                      {lvl.min_xp} – {lvl.max_xp === 999999 ? "∞" : lvl.max_xp}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">{lvl.title_name}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDeleteLevel(lvl.id)} className="btn-danger">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
