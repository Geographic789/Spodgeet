"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  recalcFromRow, isOverCutoff, isLowBuffer,
  minutesToDuration, durationToMinutes, minutesToTimeString,
  computePaceFromTime,
  type PacingRow,
} from "@/lib/pacingEngine";

type EditingCell = { rowIndex: number; field: "pace" | "time" | "rest" | "note" };

export default function PacingTable({
  initialRows, startTime, onSave, saving,
}: {
  initialRows: PacingRow[];
  startTime: string;
  onSave: (rows: PacingRow[]) => Promise<void>;
  saving: boolean;
}) {
  const [rows, setRows] = useState<PacingRow[]>(initialRows);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Sync when plan loads from DB
  useEffect(() => {
    if (initialRows?.length > 0) {
      setRows(initialRows);
      setIsDirty(false);
    }
  }, [initialRows]);

  // Auto-save every 30s when dirty
  useEffect(() => {
    if (!isDirty) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      await onSave(rows);
      setIsDirty(false);
      setLastSaved(new Date());
    }, 30000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [rows, isDirty]);

  function updateRows(next: PacingRow[]) {
    setRows(next);
    setIsDirty(true);
  }

  function startEdit(rowIndex: number, field: EditingCell["field"]) {
    const row = rows[rowIndex];
    if (row.stationId === "START" && field !== "note" && field !== "rest") return;
    let val = "";
    if (field === "pace") val = row.targetPaceMinPerKm.toFixed(2);
    if (field === "time") val = minutesToDuration(row.timeSpentMin);
    if (field === "rest") val = String(row.restMin ?? 0);
    if (field === "note") val = row.note;
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
        targetPaceMinPerKm: field === "pace" ? parseFloat(editValue) || r.targetPaceMinPerKm : r.targetPaceMinPerKm,
        timeSpentMin:        field === "time" ? durationToMinutes(editValue) || r.timeSpentMin : r.timeSpentMin,
        restMin:             field === "rest" ? parseInt(editValue) || 0 : r.restMin,
        note:                field === "note" ? editValue : r.note,
      };
    });
    const result = field === "note" ? updated : recalcFromRow(updated, rowIndex, field, startTime);
    updateRows(result);
    setEditing(null);
  }

  function unlockRow(rowIndex: number) {
    const updated = rows.map((r, i) => i === rowIndex ? { ...r, manualLocked: false } : r);
    updateRows(recalcFromRow(updated, rowIndex, "pace", startTime));
  }

  async function handleManualSave() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    await onSave(rows);
    setIsDirty(false);
    setLastSaved(new Date());
  }

  // Summary totals
  const totalLegKm    = rows.reduce((s, r) => s + r.legKm, 0);
  const totalGain     = rows.reduce((s, r) => s + r.legGainM, 0);
  const totalLoss     = rows.reduce((s, r) => s + r.legLossM, 0);
  const totalMoving   = rows.reduce((s, r) => s + r.timeSpentMin, 0);
  const totalRest     = rows.reduce((s, r) => s + (r.restMin || 0), 0);
  const finishRow     = rows[rows.length - 1];
  const finishTime    = finishRow?.timeOfDay ?? "—";

  function EditableCell({ rowIndex, field, display, mono = true, disabled = false }: {
    rowIndex: number; field: EditingCell["field"]; display: string; mono?: boolean; disabled?: boolean;
  }) {
    const row = rows[rowIndex];
    const isEditing = editing?.rowIndex === rowIndex && editing.field === field;
    if (disabled) return <span className={`${mono ? "font-mono" : ""} text-ink/30`}>{display}</span>;
    if (isEditing) return (
      <input autoFocus
        className="w-16 rounded border border-moss-400 bg-white px-1 py-0.5 font-mono text-sm focus:outline-none"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
      />
    );
    return (
      <button onClick={() => startEdit(rowIndex, field)}
        className={`${mono ? "font-mono" : ""} text-left hover:underline hover:text-moss-700 transition-colors`}>
        {display}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap gap-4 text-ink/50">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-clay-100 ring-1 ring-clay-400" />Over cutoff
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-amber-100 ring-1 ring-amber-400" />Buffer &lt;15 min
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-moss-100 ring-1 ring-moss-400" />🔒 Manual
          </span>
        </div>
        <div className="flex items-center gap-3 text-ink/40">
          {isDirty && <span className="text-clay-500">● Unsaved changes</span>}
          {lastSaved && !isDirty && <span>Auto-saved {lastSaved.toLocaleTimeString()}</span>}
          <span className="italic">Tap pace, leg time, or rest to edit</span>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead>
            <tr className="bg-moss-50 text-left">
              {["Station","Cum km","Dist","↑ m","↓ m","Cum ↑","Pace","Leg time","Rest","Arrival","Cutoff","Buffer","Note"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink/50 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const overCutoff = isOverCutoff(row);
              const lowBuffer  = isLowBuffer(row);
              const isStart    = row.stationId === "START";
              const isFinish   = row.stationId === "FINISH";
              const bg = overCutoff ? "bg-clay-50" : lowBuffer ? "bg-amber-50" : i % 2 === 0 ? "bg-white" : "bg-moss-50/20";

              return (
                <tr key={row.stationId}
                  className={`${bg} border-t border-moss-100 ${overCutoff ? "ring-1 ring-inset ring-clay-300" : ""}`}>

                  {/* Station */}
                  <td className="px-3 py-2.5 min-w-[120px]">
                    <span className={`font-medium ${isStart || isFinish ? "text-moss-700 font-bold" : "text-ink"}`}>
                      {row.stationName}
                    </span>
                    {overCutoff && <span className="ml-1 text-xs font-bold text-clay-600">⚠ OVER</span>}
                    {lowBuffer  && <span className="ml-1 text-xs font-bold text-amber-600">⚠ LOW</span>}
                  </td>

                  {/* Cum km */}
                  <td className="px-3 py-2.5 font-mono text-ink/60">{row.cumulativeKm.toFixed(1)}</td>

                  {/* Leg dist */}
                  <td className="px-3 py-2.5 font-mono text-ink/60">{isStart ? "—" : row.legKm.toFixed(1)}</td>

                  {/* Gain */}
                  <td className="px-3 py-2.5 font-mono text-xs text-moss-600">
                    {isStart ? "—" : `+${Math.round(row.legGainM)}`}
                  </td>

                  {/* Loss */}
                  <td className="px-3 py-2.5 font-mono text-xs text-clay-500">
                    {isStart ? "—" : `-${Math.round(row.legLossM)}`}
                  </td>

                  {/* Cumulative gain */}
                  <td className="px-3 py-2.5 font-mono text-xs text-moss-700">
                    +{Math.round(row.cumulativeGainM)}
                  </td>

                  {/* Pace — editable */}
                  <td className="px-3 py-2.5">
                    {isStart ? <span className="text-ink/30 font-mono">—</span> : (
                      <span className="flex items-center gap-1">
                        <EditableCell rowIndex={i} field="pace"
                          display={row.targetPaceMinPerKm.toFixed(2)}
                          disabled={isStart} />
                        {row.manualLocked && (
                          <button onClick={() => unlockRow(i)} title="Unlock" className="text-moss-400 hover:text-moss-700 text-xs">🔒</button>
                        )}
                      </span>
                    )}
                  </td>

                  {/* Leg time — editable */}
                  <td className="px-3 py-2.5">
                    {isStart ? <span className="text-ink/30 font-mono">—</span> : (
                      <EditableCell rowIndex={i} field="time"
                        display={minutesToDuration(row.timeSpentMin)} />
                    )}
                  </td>

                  {/* Rest — editable */}
                  <td className="px-3 py-2.5">
                    {isFinish ? <span className="text-ink/30 font-mono">—</span> : (
                      <EditableCell rowIndex={i} field="rest"
                        display={(row.restMin ?? 0) > 0 ? `${row.restMin}m` : "—"}
                        mono={(row.restMin ?? 0) > 0} />
                    )}
                  </td>

                  {/* Arrival */}
                  <td className="px-3 py-2.5 font-mono font-semibold text-ink whitespace-nowrap">{row.timeOfDay}</td>

                  {/* Cutoff */}
                  <td className={`px-3 py-2.5 font-mono whitespace-nowrap ${row.cutoffTime ? "font-semibold text-clay-600" : "text-ink/25"}`}>
                    {row.cutoffTime || "—"}
                  </td>

                  {/* Buffer */}
                  <td className={`px-3 py-2.5 font-mono font-semibold whitespace-nowrap
                    ${overCutoff ? "text-clay-600" : lowBuffer ? "text-amber-600" : "text-ink/40"}`}>
                    {row.bufferMin === null ? "—" : `${row.bufferMin < 0 ? "" : "+"}${Math.round(row.bufferMin)}m`}
                  </td>

                  {/* Note */}
                  <td className="px-3 py-2.5 min-w-[120px]">
                    <EditableCell rowIndex={i} field="note" mono={false}
                      display={row.note || "add note…"} />
                  </td>
                </tr>
              );
            })}

            {/* Summary row */}
            <tr className="border-t-2 border-moss-300 bg-moss-100 font-semibold text-sm">
              <td className="px-3 py-3 text-moss-800 font-bold">TOTAL</td>
              <td className="px-3 py-3 font-mono text-moss-800">{totalLegKm.toFixed(1)}</td>
              <td className="px-3 py-3 font-mono text-ink/40">—</td>
              <td className="px-3 py-3 font-mono text-moss-600">+{Math.round(totalGain)}</td>
              <td className="px-3 py-3 font-mono text-clay-500">-{Math.round(totalLoss)}</td>
              <td className="px-3 py-3 font-mono text-moss-700">+{Math.round(totalGain)}</td>
              <td className="px-3 py-3 font-mono text-ink/40">—</td>
              <td className="px-3 py-3 font-mono text-ink">{minutesToDuration(totalMoving)}</td>
              <td className="px-3 py-3 font-mono text-clay-600">{totalRest > 0 ? `${totalRest}m` : "—"}</td>
              <td className="px-3 py-3 font-mono font-bold text-ink">{finishTime}</td>
              <td className="px-3 py-3 text-ink/40">—</td>
              <td className="px-3 py-3 text-ink/40">—</td>
              <td className="px-3 py-3 text-ink/40">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-4 font-mono text-sm text-ink/60">
          <span>Moving: <strong className="text-ink">{minutesToDuration(totalMoving)}</strong></span>
          <span>Rest: <strong className="text-ink">{totalRest > 0 ? `${totalRest} min` : "—"}</strong></span>
          <span>Total: <strong className="text-ink">{minutesToDuration(totalMoving + totalRest)}</strong></span>
          <span>Finish: <strong className="text-moss-700">{finishTime}</strong></span>
        </div>
        <button className="btn-primary" onClick={handleManualSave} disabled={saving}>
          {saving ? "Saving…" : isDirty ? "💾 Save now" : "✓ Saved"}
        </button>
      </div>
    </div>
  );
}
