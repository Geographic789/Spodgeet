"use client";

import { useState, useEffect, useCallback } from "react";
import {
  recalcFromRow, isOverCutoff, isLowBuffer,
  minutesToDuration, durationToMinutes, minutesToTimeString,
  DEFAULT_FATIGUE_TIERS, type PacingRow, type FatigueTier,
} from "@/lib/pacingEngine";

type EditingCell = {
  rowIndex: number;
  field: "pace" | "duration" | "rest" | "note";
};

export default function PacingTable({
  initialRows, startTime, totalKm,
  fatigueTiers = DEFAULT_FATIGUE_TIERS,
  onSave, saving,
}: {
  initialRows: PacingRow[];
  startTime: string;
  totalKm: number;
  fatigueTiers?: FatigueTier[];
  onSave: (rows: PacingRow[]) => void;
  saving: boolean;
}) {
  const [rows, setRows] = useState<PacingRow[]>(initialRows);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState("");

  // Fix: sync rows when initialRows loads from DB (async)
  useEffect(() => {
    if (initialRows && initialRows.length > 0) {
      setRows(initialRows);
    }
  }, [initialRows]);

  function startEdit(rowIndex: number, field: EditingCell["field"]) {
    if (rowIndex === 0 && field !== "note") return;
    const row = rows[rowIndex];
    let val = "";
    if (field === "pace")     val = row.targetPaceMinPerKm.toFixed(2);
    if (field === "duration") val = minutesToDuration(row.timeSpentMin);
    if (field === "rest")     val = String(row.restMin ?? 0);
    if (field === "note")     val = row.note;
    setEditing({ rowIndex, field });
    setEditValue(val);
  }

  function commitEdit() {
    if (!editing) return;
    const { rowIndex, field } = editing;

    const updated = rows.map((r, i) => {
      if (i !== rowIndex) return r;
      return {
        ...r,
        targetPaceMinPerKm: field === "pace"
          ? parseFloat(editValue) || r.targetPaceMinPerKm
          : r.targetPaceMinPerKm,
        timeSpentMin: field === "duration"
          ? durationToMinutes(editValue) || r.timeSpentMin
          : r.timeSpentMin,
        restMin: field === "rest"
          ? parseInt(editValue) || 0
          : r.restMin,
        note: field === "note" ? editValue : r.note,
      };
    });

    const result = field === "note"
      ? updated
      : recalcFromRow(updated, rowIndex, field, startTime, totalKm, fatigueTiers);

    setRows(result);
    setEditing(null);
  }

  function unlockRow(rowIndex: number) {
    const updated = rows.map((r, i) =>
      i === rowIndex ? { ...r, manualLocked: false } : r
    );
    setRows(recalcFromRow(updated, rowIndex, "pace", startTime, totalKm, fatigueTiers));
  }

  const totals = rows[rows.length - 1];

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-ink/50">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-clay-100 ring-1 ring-clay-400" />Over cutoff
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-amber-100 ring-1 ring-amber-400" />Buffer &lt;15 min
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-moss-100 ring-1 ring-moss-400" />🔒 Manual override
        </span>
        <span className="ml-auto text-ink/40 italic">Tap any pace / leg time / rest cell to edit</span>
      </div>

      {/* Table — horizontally scrollable on mobile */}
      <div className="card overflow-x-auto">
        <table className="min-w-[860px] w-full text-sm">
          <thead>
            <tr className="bg-moss-50 text-left">
              {[
                "Station", "Cum km", "Dist", "↑ m", "↓ m",
                "Pace", "Leg time", "Rest", "Arrival", "Cutoff", "Buffer", "Note"
              ].map((h) => (
                <th key={h} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink/50 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const overCutoff = isOverCutoff(row);
              const lowBuffer  = isLowBuffer(row);
              const isStart    = row.stationId === "START";
              const isFinish   = row.stationId === "FINISH";
              const bg = overCutoff ? "bg-clay-50"
                       : lowBuffer  ? "bg-amber-50"
                       : i % 2 === 0 ? "bg-white" : "bg-moss-50/20";

              return (
                <tr key={row.stationId}
                  className={`${bg} border-t border-moss-100 ${overCutoff ? "ring-1 ring-inset ring-clay-300" : ""}`}
                >
                  {/* Station */}
                  <td className="px-3 py-2.5 min-w-[120px]">
                    <span className={`font-medium ${isStart || isFinish ? "text-moss-700" : "text-ink"}`}>
                      {row.stationName}
                    </span>
                    {(overCutoff || lowBuffer) && (
                      <span className={`ml-1 text-xs font-bold ${overCutoff ? "text-clay-600" : "text-amber-600"}`}>
                        {overCutoff ? "⚠ OVER" : "⚠ LOW"}
                      </span>
                    )}
                  </td>

                  {/* Cum km */}
                  <td className="px-3 py-2.5 font-mono text-ink/60 whitespace-nowrap">
                    {row.cumulativeKm.toFixed(1)}
                  </td>

                  {/* Leg dist */}
                  <td className="px-3 py-2.5 font-mono text-ink/60">
                    {isStart ? "—" : row.legKm.toFixed(1)}
                  </td>

                  {/* Gain */}
                  <td className="px-3 py-2.5 font-mono text-xs text-moss-600">
                    {isStart ? "—" : `+${Math.round(row.legGainM)}`}
                  </td>

                  {/* Loss */}
                  <td className="px-3 py-2.5 font-mono text-xs text-clay-500">
                    {isStart ? "—" : `-${Math.round(row.legLossM)}`}
                  </td>

                  {/* Pace — editable */}
                  <td className="px-3 py-2.5">
                    {isStart ? "—" : editing?.rowIndex === i && editing.field === "pace" ? (
                      <input autoFocus
                        className="w-16 rounded border border-moss-400 px-1 py-0.5 font-mono text-sm focus:outline-none"
                        value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
                      />
                    ) : (
                      <button onClick={() => startEdit(i, "pace")}
                        className={`font-mono hover:underline ${row.manualLocked ? "font-bold text-moss-700" : "text-ink"}`}>
                        {row.targetPaceMinPerKm.toFixed(1)}
                      </button>
                    )}
                  </td>

                  {/* Leg time — editable */}
                  <td className="px-3 py-2.5">
                    {isStart ? "—" : editing?.rowIndex === i && editing.field === "duration" ? (
                      <input autoFocus placeholder="HH:MM"
                        className="w-16 rounded border border-moss-400 px-1 py-0.5 font-mono text-sm focus:outline-none"
                        value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
                      />
                    ) : (
                      <span className="flex items-center gap-1">
                        <button onClick={() => startEdit(i, "duration")}
                          className={`font-mono hover:underline ${row.manualLocked ? "font-bold text-moss-700" : "text-ink"}`}>
                          {minutesToDuration(row.timeSpentMin)}
                        </button>
                        {row.manualLocked && (
                          <button onClick={() => unlockRow(i)} title="Unlock" className="text-moss-400 hover:text-moss-700">🔒</button>
                        )}
                      </span>
                    )}
                  </td>

                  {/* Rest — editable (minutes) */}
                  <td className="px-3 py-2.5">
                    {isFinish ? "—" : editing?.rowIndex === i && editing.field === "rest" ? (
                      <input autoFocus
                        className="w-14 rounded border border-moss-400 px-1 py-0.5 font-mono text-sm focus:outline-none"
                        value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
                      />
                    ) : (
                      <button onClick={() => startEdit(i, "rest")}
                        className={`font-mono hover:underline ${(row.restMin ?? 0) > 0 ? "font-bold text-clay-600" : "text-ink/40"}`}>
                        {(row.restMin ?? 0) > 0 ? `${row.restMin}m` : "—"}
                      </button>
                    )}
                  </td>

                  {/* Arrival time */}
                  <td className="px-3 py-2.5 font-mono font-semibold text-ink whitespace-nowrap">
                    {row.timeOfDay}
                  </td>

                  {/* Cutoff */}
                  <td className={`px-3 py-2.5 font-mono whitespace-nowrap ${row.cutoffTime ? "font-semibold text-clay-600" : "text-ink/30"}`}>
                    {row.cutoffTime || "—"}
                  </td>

                  {/* Buffer */}
                  <td className={`px-3 py-2.5 font-mono font-semibold whitespace-nowrap ${overCutoff ? "text-clay-600" : lowBuffer ? "text-amber-600" : "text-ink/50"}`}>
                    {row.bufferMin === null ? "—" : (
                      <span>{row.bufferMin < 0 ? "" : "+"}{Math.round(row.bufferMin)}m</span>
                    )}
                  </td>

                  {/* Note */}
                  <td className="px-3 py-2.5 min-w-[120px]">
                    {editing?.rowIndex === i && editing.field === "note" ? (
                      <input autoFocus
                        className="w-28 rounded border border-moss-400 px-1 py-0.5 text-sm focus:outline-none"
                        value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit} placeholder="note…"
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
                      />
                    ) : (
                      <button onClick={() => startEdit(i, "note")}
                        className="text-left text-ink/50 hover:text-ink max-w-[120px] truncate block text-xs">
                        {row.note || <span className="italic text-ink/25">add note</span>}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary + save */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-5 font-mono text-sm text-ink/60">
          <span>Moving time: <strong className="text-ink">{minutesToDuration(totals?.cumulativeTimeMin || 0)}</strong></span>
          <span>Finish: <strong className="text-ink">{totals?.timeOfDay || "—"}</strong></span>
          <span>Total incl. rest: <strong className="text-ink">
            {minutesToDuration(
              (totals?.cumulativeTimeMin || 0) +
              rows.reduce((s, r) => s + (r.restMin || 0), 0)
            )}
          </strong></span>
        </div>
        <button className="btn-primary" onClick={() => onSave(rows)} disabled={saving}>
          {saving ? "Saving…" : "💾 Save plan"}
        </button>
      </div>
    </div>
  );
}
