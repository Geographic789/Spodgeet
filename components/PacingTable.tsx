"use client";

import { useState, useEffect, useRef } from "react";
import {
  recalcFromRow, isOverCutoff, isLowBuffer,
  minutesToDuration, durationToMinutes,
  DEFAULT_FATIGUE_TIERS, type PacingRow, type FatigueTier,
} from "@/lib/pacingEngine";

type EditingCell = { rowIndex: number; field: "pace" | "time" | "rest" | "note" };

// D+/D- intensity color (myresults.run style)
function gainBg(m: number) {
  if (m < 30) return "";
  const i = Math.min(m / 1200, 1);
  return `rgba(239,68,68,${0.1 + i * 0.7})`;
}
function lossBg(m: number) {
  if (m < 30) return "";
  const i = Math.min(m / 1200, 1);
  return `rgba(59,130,246,${0.1 + i * 0.7})`;
}

export default function PacingTable({
  initialRows, startTime, totalKm, flatPaceMinPerKm,
  fatigueTiers = DEFAULT_FATIGUE_TIERS,
  onSave, saving,
}: {
  initialRows: PacingRow[];
  startTime: string;
  totalKm: number;
  flatPaceMinPerKm: number;
  fatigueTiers?: FatigueTier[];
  onSave: (rows: PacingRow[]) => Promise<void>;
  saving: boolean;
}) {
  const [rows, setRows] = useState<PacingRow[]>(initialRows);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (initialRows?.length > 0) { setRows(initialRows); setIsDirty(false); }
  }, [initialRows]);

  useEffect(() => {
    if (!isDirty) return;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(async () => {
      await onSave(rows); setIsDirty(false); setLastSaved(new Date());
    }, 30000);
    return () => { if (autoTimer.current) clearTimeout(autoTimer.current); };
  }, [rows, isDirty]);

  function updateRows(next: PacingRow[]) { setRows(next); setIsDirty(true); }

  function startEdit(rowIndex: number, field: EditingCell["field"]) {
    const row = rows[rowIndex];
    if (row.stationId === "START" && field !== "note" && field !== "rest") return;
    let val = "";
    if (field === "pace") val = row.displayedPaceMinPerKm.toFixed(2);
    if (field === "time") val = minutesToDuration(row.timeSpentMin);
    if (field === "rest") val = String(row.restMin ?? 0);
    if (field === "note") val = row.note;
    setEditing({ rowIndex, field }); setEditValue(val);
  }

  function commitEdit() {
    if (!editing) return;
    const { rowIndex, field } = editing;
    const updated = rows.map((r, i) => {
      if (i !== rowIndex) return r;
      return {
        ...r,
        displayedPaceMinPerKm: field === "pace" ? parseFloat(editValue) || r.displayedPaceMinPerKm : r.displayedPaceMinPerKm,
        timeSpentMin:           field === "time" ? durationToMinutes(editValue) || r.timeSpentMin : r.timeSpentMin,
        restMin:                field === "rest" ? parseInt(editValue) || 0 : r.restMin,
        note:                   field === "note" ? editValue : r.note,
      };
    });
    const result = field === "note" ? updated
      : recalcFromRow(updated, rowIndex, field, startTime, totalKm, flatPaceMinPerKm, fatigueTiers);
    updateRows(result); setEditing(null);
  }

  function unlockRow(idx: number) {
    const updated = rows.map((r, i) => i === idx ? { ...r, manualLocked: false } : r);
    updateRows(recalcFromRow(updated, idx, "pace", startTime, totalKm, flatPaceMinPerKm, fatigueTiers));
  }

  async function handleSave() {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    await onSave(rows); setIsDirty(false); setLastSaved(new Date());
  }

  // Tightest margin = smallest positive buffer (bold that row)
  const tightestIdx = rows.reduce((tight, row, i) => {
    if (row.bufferMin === null || row.bufferMin < 0) return tight;
    if (tight === -1 || row.bufferMin < rows[tight].bufferMin!) return i;
    return tight;
  }, -1);

  const totalMoving = rows.reduce((s, r) => s + r.timeSpentMin, 0);
  const totalRest   = rows.reduce((s, r) => s + (r.restMin || 0), 0);
  const totalGain   = rows.reduce((s, r) => s + r.legGainM, 0);
  const totalLoss   = rows.reduce((s, r) => s + r.legLossM, 0);
  const finishRow   = rows[rows.length - 1];

  function EditCell({ rowIndex, field, display, disabled = false }: {
    rowIndex: number; field: EditingCell["field"]; display: string; disabled?: boolean;
  }) {
    if (disabled) return <span className="text-ink/25 font-mono">{display}</span>;
    const isEditing = editing?.rowIndex === rowIndex && editing.field === field;
    if (isEditing) return (
      <input autoFocus className="w-16 rounded border border-moss-400 bg-white px-1 py-0.5 font-mono text-sm focus:outline-none"
        value={editValue} onChange={(e) => setEditValue(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }} />
    );
    return (
      <button onClick={() => startEdit(rowIndex, field)}
        className="font-mono text-left hover:underline hover:text-moss-700 transition-colors">
        {display}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {/* Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap gap-4 text-ink/50">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-clay-50 ring-1 ring-clay-400 inline-block"/>Over cutoff</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-amber-50 ring-1 ring-amber-400 inline-block"/>Buffer &lt;15m</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-moss-100 ring-1 ring-moss-400 inline-block"/>🔒 Manual</span>
          <span className="text-ink/40 italic">Tap pace or leg time to edit · auto-saves in 30s</span>
        </div>
        {isDirty && <span className="text-clay-500 font-semibold">● Unsaved</span>}
        {lastSaved && !isDirty && <span className="text-ink/40">Saved {lastSaved.toLocaleTimeString()}</span>}
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="min-w-[960px] w-full text-sm">
          <thead>
            <tr className="bg-moss-50 text-left">
              {["Station","Cum km","Dist","D+","D-","Cum↑","Eff km","Pace","Leg time","Rest","Elapsed","Arrival","Cutoff","Buffer","Note"].map(h => (
                <th key={h} className="px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink/50 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const overCutoff = isOverCutoff(row);
              const lowBuffer  = isLowBuffer(row);
              const isStart    = row.stationId === "START";
              const isFinish   = row.stationId === "FINISH";
              const isTightest = i === tightestIdx;
              const bg = overCutoff ? "bg-clay-50" : lowBuffer ? "bg-amber-50" : i % 2 === 0 ? "bg-white" : "bg-moss-50/20";

              return (
                <tr key={row.stationId}
                  className={`${bg} border-t border-moss-100 ${overCutoff ? "ring-1 ring-inset ring-clay-300" : ""} ${isTightest ? "font-bold" : ""}`}>

                  <td className="px-2.5 py-2 min-w-[110px]">
                    <span className={`${isStart || isFinish ? "text-moss-700 font-bold" : "text-ink"}`}>{row.stationName}</span>
                    {overCutoff && <span className="ml-1 text-xs font-bold text-clay-600">⚠ OVER</span>}
                    {lowBuffer  && <span className="ml-1 text-xs font-bold text-amber-600">⚠ LOW</span>}
                  </td>
                  <td className="px-2.5 py-2 font-mono text-ink/60">{row.cumulativeKm.toFixed(1)}</td>
                  <td className="px-2.5 py-2 font-mono text-ink/60">{isStart ? "—" : row.legKm.toFixed(1)}</td>

                  {/* D+ colored by intensity */}
                  <td className="px-2.5 py-2 font-mono text-xs font-semibold text-center"
                    style={{ backgroundColor: gainBg(row.legGainM), color: row.legGainM > 300 ? "white" : "" }}>
                    {isStart ? "—" : `+${Math.round(row.legGainM)}`}
                  </td>

                  {/* D- colored by intensity */}
                  <td className="px-2.5 py-2 font-mono text-xs font-semibold text-center"
                    style={{ backgroundColor: lossBg(row.legLossM), color: row.legLossM > 300 ? "white" : "" }}>
                    {isStart ? "—" : `-${Math.round(row.legLossM)}`}
                  </td>

                  <td className="px-2.5 py-2 font-mono text-xs text-moss-700">+{Math.round(row.cumulativeGainM)}</td>
                  <td className="px-2.5 py-2 font-mono text-xs text-ink/40">{isStart ? "—" : row.effectiveKm.toFixed(1)}</td>

                  {/* Displayed pace — editable */}
                  <td className="px-2.5 py-2">
                    {isStart ? <span className="text-ink/25 font-mono">—</span> : (
                      <span className="flex items-center gap-1">
                        <EditCell rowIndex={i} field="pace"
                          display={row.displayedPaceMinPerKm.toFixed(2)} />
                        {row.manualLocked && (
                          <button onClick={() => unlockRow(i)} title="Unlock" className="text-moss-400 hover:text-moss-700 text-xs">🔒</button>
                        )}
                      </span>
                    )}
                  </td>

                  {/* Leg time — editable */}
                  <td className="px-2.5 py-2">
                    {isStart ? <span className="text-ink/25 font-mono">—</span> : (
                      <EditCell rowIndex={i} field="time" display={minutesToDuration(row.timeSpentMin)} />
                    )}
                  </td>

                  {/* Rest — editable */}
                  <td className="px-2.5 py-2">
                    {isFinish ? <span className="text-ink/25 font-mono">—</span> : (
                      <EditCell rowIndex={i} field="rest"
                        display={(row.restMin ?? 0) > 0 ? `${row.restMin}m` : "—"} />
                    )}
                  </td>

                  {/* Elapsed moving time */}
                  <td className="px-2.5 py-2 font-mono text-xs text-ink/50 whitespace-nowrap">
                    {isStart ? "—" : minutesToDuration(row.elapsedMovingMin)}
                  </td>

                  <td className="px-2.5 py-2 font-mono font-semibold text-ink whitespace-nowrap">{row.timeOfDay}</td>

                  <td className={`px-2.5 py-2 font-mono whitespace-nowrap ${row.cutoffTime ? "font-semibold text-clay-600" : "text-ink/25"}`}>
                    {row.cutoffTime || "—"}
                  </td>

                  <td className={`px-2.5 py-2 font-mono font-semibold whitespace-nowrap ${overCutoff ? "text-clay-600" : lowBuffer ? "text-amber-600" : "text-ink/40"}`}>
                    {row.bufferMin === null ? "—" : `${row.bufferMin < 0 ? "" : "+"}${Math.round(row.bufferMin)}m`}
                  </td>

                  <td className="px-2.5 py-2 min-w-[110px]">
                    <EditCell rowIndex={i} field="note" display={row.note || "add note…"} />
                  </td>
                </tr>
              );
            })}

            {/* Summary row */}
            <tr className="border-t-2 border-moss-300 bg-moss-100 font-semibold">
              <td className="px-2.5 py-3 text-moss-800 font-bold">TOTAL</td>
              <td className="px-2.5 py-3 font-mono text-moss-800">{rows[rows.length-1]?.cumulativeKm.toFixed(1)}</td>
              <td className="px-2.5 py-3 font-mono text-ink/40">—</td>
              <td className="px-2.5 py-3 font-mono text-xs font-bold" style={{backgroundColor: gainBg(totalGain), color: totalGain > 1000 ? "white" : ""}}>+{Math.round(totalGain)}</td>
              <td className="px-2.5 py-3 font-mono text-xs font-bold" style={{backgroundColor: lossBg(totalLoss), color: totalLoss > 1000 ? "white" : ""}}>-{Math.round(totalLoss)}</td>
              <td className="px-2.5 py-3 font-mono text-moss-700">+{Math.round(totalGain)}</td>
              <td className="px-2.5 py-3 font-mono text-ink/40">—</td>
              <td className="px-2.5 py-3 font-mono text-ink/40">—</td>
              <td className="px-2.5 py-3 font-mono text-ink">{minutesToDuration(totalMoving)}</td>
              <td className="px-2.5 py-3 font-mono text-clay-600">{totalRest > 0 ? `${totalRest}m` : "—"}</td>
              <td className="px-2.5 py-3 font-mono text-ink">{minutesToDuration(totalMoving)}</td>
              <td className="px-2.5 py-3 font-mono font-bold text-moss-700">{finishRow?.timeOfDay || "—"}</td>
              <td className="px-2.5 py-3 text-ink/30">—</td>
              <td className="px-2.5 py-3 text-ink/30">—</td>
              <td className="px-2.5 py-3 text-ink/30">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-5 font-mono text-sm text-ink/60">
          <span>Moving: <strong className="text-ink">{minutesToDuration(totalMoving)}</strong></span>
          <span>Rest: <strong className="text-ink">{totalRest > 0 ? `${totalRest} min` : "—"}</strong></span>
          <span>Total: <strong className="text-ink">{minutesToDuration(totalMoving + totalRest)}</strong></span>
          <span>Finish: <strong className="text-moss-700">{finishRow?.timeOfDay || "—"}</strong></span>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : isDirty ? "💾 Save now" : "✓ Saved"}
        </button>
      </div>
    </div>
  );
}
