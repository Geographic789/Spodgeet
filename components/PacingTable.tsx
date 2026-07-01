"use client";

import { useState, useCallback } from "react";
import {
  recalcFromRow,
  isOverCutoff,
  isLowBuffer,
  minutesToDuration,
  durationToMinutes,
  minutesToTimeString,
  DEFAULT_FATIGUE_TIERS,
  type PacingRow,
  type FatigueTier,
} from "@/lib/pacingEngine";

type EditingCell = { rowIndex: number; field: "pace" | "duration" | "note" };

export default function PacingTable({
  initialRows,
  startTime,
  totalKm,
  fatigueTiers = DEFAULT_FATIGUE_TIERS,
  onSave,
  saving,
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

  function startEdit(rowIndex: number, field: EditingCell["field"]) {
    if (rowIndex === 0) return; // START row is not editable
    const row = rows[rowIndex];
    let val = "";
    if (field === "pace") val = row.targetPaceMinPerKm.toFixed(2);
    if (field === "duration") val = minutesToDuration(row.timeSpentMin);
    if (field === "note") val = row.note;
    setEditing({ rowIndex, field });
    setEditValue(val);
  }

  function commitEdit() {
    if (!editing) return;
    const { rowIndex, field } = editing;
    const updated = rows.map((r, i) =>
      i === rowIndex
        ? {
            ...r,
            targetPaceMinPerKm:
              field === "pace" ? parseFloat(editValue) || r.targetPaceMinPerKm : r.targetPaceMinPerKm,
            timeSpentMin:
              field === "duration" ? durationToMinutes(editValue) || r.timeSpentMin : r.timeSpentMin,
            note: field === "note" ? editValue : r.note,
          }
        : r
    );
    const recalculated =
      field === "note"
        ? updated
        : recalcFromRow(updated, rowIndex, field, startTime, totalKm, fatigueTiers);
    setRows(recalculated);
    setEditing(null);
  }

  function unlockRow(rowIndex: number) {
    const updated = rows.map((r, i) =>
      i === rowIndex ? { ...r, manualLocked: false } : r
    );
    const recalculated = recalcFromRow(updated, rowIndex, "pace", startTime, totalKm, fatigueTiers);
    setRows(recalculated);
  }

  const hasWarning = useCallback(
    (row: PacingRow) => isOverCutoff(row) || isLowBuffer(row),
    []
  );

  return (
    <div>
      {/* Legend */}
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-ink/60">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-clay-100 ring-1 ring-clay-400" />
          Over cutoff
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-amber-100 ring-1 ring-amber-400" />
          Buffer &lt; 15 min
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-moss-100 ring-1 ring-moss-400" />
          Manual override
        </span>
      </div>

      {/* Scrollable table */}
      <div className="card overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead>
            <tr className="bg-moss-50 text-left">
              {["Station", "Cum km", "Leg km", "Gain / Loss", "Pace (min/km)", "Leg time", "Time of day", "Cutoff", "Buffer", "Note"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink/50 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const overCutoff = isOverCutoff(row);
              const lowBuffer = isLowBuffer(row);
              const rowBg = overCutoff
                ? "bg-clay-50"
                : lowBuffer
                ? "bg-amber-50"
                : i % 2 === 0
                ? "bg-white"
                : "bg-moss-50/30";

              const isStart = row.stationId === "START";
              const isFinish = row.stationId === "FINISH";
              const isSpecial = isStart || isFinish;

              return (
                <tr
                  key={row.stationId}
                  className={`${rowBg} border-t border-moss-100 ${overCutoff ? "ring-1 ring-inset ring-clay-300" : ""}`}
                >
                  {/* Station name */}
                  <td className="px-3 py-2.5">
                    <span className={`font-medium ${isSpecial ? "text-moss-700" : "text-ink"}`}>
                      {row.stationName}
                    </span>
                    {(overCutoff || lowBuffer) && (
                      <span className={`ml-2 text-xs font-bold ${overCutoff ? "text-clay-600" : "text-amber-600"}`}>
                        {overCutoff ? "⚠ OVER CUTOFF" : "⚠ LOW BUFFER"}
                      </span>
                    )}
                  </td>

                  {/* Cumulative km */}
                  <td className="px-3 py-2.5 font-mono text-ink/70">{row.cumulativeKm.toFixed(1)}</td>

                  {/* Leg km */}
                  <td className="px-3 py-2.5 font-mono text-ink/70">
                    {isStart ? "—" : row.legKm.toFixed(1)}
                  </td>

                  {/* Gain / Loss */}
                  <td className="px-3 py-2.5 font-mono text-xs">
                    {isStart ? "—" : (
                      <span>
                        <span className="text-moss-600">+{Math.round(row.legGainM)}</span>
                        {" / "}
                        <span className="text-clay-600">-{Math.round(row.legLossM)}</span>
                      </span>
                    )}
                  </td>

                  {/* Pace (editable) */}
                  <td className="px-3 py-2.5">
                    {isStart ? "—" : editing?.rowIndex === i && editing.field === "pace" ? (
                      <input
                        autoFocus
                        className="w-20 rounded border border-moss-400 px-1 py-0.5 font-mono text-sm focus:outline-none"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(i, "pace")}
                        className={`font-mono tabular-nums hover:underline ${row.manualLocked ? "text-moss-700 font-semibold" : "text-ink"}`}
                      >
                        {row.targetPaceMinPerKm.toFixed(2)}
                      </button>
                    )}
                  </td>

                  {/* Leg time (editable) */}
                  <td className="px-3 py-2.5">
                    {isStart ? "—" : editing?.rowIndex === i && editing.field === "duration" ? (
                      <input
                        autoFocus
                        className="w-20 rounded border border-moss-400 px-1 py-0.5 font-mono text-sm focus:outline-none"
                        value={editValue}
                        placeholder="HH:MM"
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
                      />
                    ) : (
                      <span className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(i, "duration")}
                          className={`font-mono tabular-nums hover:underline ${row.manualLocked ? "text-moss-700 font-semibold" : "text-ink"}`}
                        >
                          {minutesToDuration(row.timeSpentMin)}
                        </button>
                        {row.manualLocked && (
                          <button
                            title="Unlock — recompute from pace"
                            onClick={() => unlockRow(i)}
                            className="text-moss-500 hover:text-moss-700 text-xs"
                          >
                            🔒
                          </button>
                        )}
                      </span>
                    )}
                  </td>

                  {/* Time of day */}
                  <td className="px-3 py-2.5 font-mono font-semibold text-ink">{row.timeOfDay}</td>

                  {/* Cutoff */}
                  <td className="px-3 py-2.5 font-mono text-ink/60">
                    {row.cutoffTime || "—"}
                  </td>

                  {/* Buffer */}
                  <td className={`px-3 py-2.5 font-mono font-semibold ${overCutoff ? "text-clay-600" : lowBuffer ? "text-amber-600" : "text-ink/60"}`}>
                    {row.bufferMin === null ? "—" : (
                      <span>{row.bufferMin < 0 ? "-" : "+"}{Math.abs(Math.round(row.bufferMin))} min</span>
                    )}
                  </td>

                  {/* Note (editable) */}
                  <td className="px-3 py-2.5 max-w-[160px]">
                    {editing?.rowIndex === i && editing.field === "note" ? (
                      <input
                        autoFocus
                        className="w-36 rounded border border-moss-400 px-1 py-0.5 text-sm focus:outline-none"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
                        placeholder="Add note…"
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(i, "note")}
                        className="text-left text-ink/60 hover:text-ink truncate max-w-[140px] block"
                      >
                        {row.note || <span className="text-ink/30 italic">note…</span>}
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
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-6 font-mono text-sm text-ink/70">
          <span>Total: <strong className="text-ink">{minutesToDuration(rows[rows.length - 1]?.cumulativeTimeMin || 0)}</strong></span>
          <span>Finish: <strong className="text-ink">{rows[rows.length - 1]?.timeOfDay || "—"}</strong></span>
        </div>
        <button className="btn-primary" onClick={() => onSave(rows)} disabled={saving}>
          {saving ? "Saving…" : "💾 Save plan"}
        </button>
      </div>
    </div>
  );
}
