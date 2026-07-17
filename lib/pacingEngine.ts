/**
 * Spodgeet — Pacing Engine v2
 * Simplified: leg_time = leg_km × pace. No slope factor, no fatigue multiplier.
 * Bidirectional: edit pace → recalc time, edit time → recalc pace.
 */

import type { TrackPoint, AidStation } from "./routeTypes";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PacingRow = {
  stationId: string;
  stationName: string;
  cumulativeKm: number;
  legKm: number;
  legGainM: number;
  legLossM: number;
  cumulativeGainM: number;    // running total elevation gain
  targetPaceMinPerKm: number;
  timeSpentMin: number;       // moving time for this leg
  restMin: number;            // rest at this station before departing
  cumulativeTimeMin: number;  // elapsed time from start to ARRIVAL at this station
  timeOfDay: string;          // clock time of arrival (HH:MM)
  cutoffTime: string;
  bufferMin: number | null;
  manualLocked: boolean;
  note: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function timeStringToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTimeString(totalMin: number): string {
  const mod = ((totalMin % 1440) + 1440) % 1440;
  const h = Math.floor(mod / 60);
  const m = Math.round(mod % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function minutesToDuration(totalMin: number): string {
  const abs = Math.abs(totalMin);
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function durationToMinutes(d: string): number {
  return timeStringToMinutes(d);
}

/** Pure: leg_time = leg_km × pace */
export function computeLegTime(legKm: number, paceMinPerKm: number): number {
  return legKm * paceMinPerKm;
}

/** Pure: pace = leg_time / leg_km */
export function computePaceFromTime(legKm: number, timeMin: number): number {
  if (legKm === 0) return 0;
  return timeMin / legKm;
}

/** Back-calculate base pace from goal finish time */
export function backCalculatePace(goalTimeStr: string, totalKm: number): number {
  if (totalKm === 0) return 8;
  const goalMin = timeStringToMinutes(goalTimeStr);
  return goalMin / totalKm;
}

/** Elevation gain/loss for a leg using 13m threshold (calibrated to Suunto) */
export function legElevation(
  points: TrackPoint[],
  fromKm: number,
  toKm: number
): { gainM: number; lossM: number } {
  const THRESHOLD = 13;
  let gain = 0, loss = 0, acc = 0;
  let inSegment = false;
  let prevEle: number | null = null;

  for (const p of points) {
    if (p.cum_km >= fromKm && p.cum_km <= toKm) {
      if (!inSegment) { inSegment = true; prevEle = p.ele; continue; }
      if (prevEle !== null) {
        acc += p.ele - prevEle;
        if (Math.abs(acc) >= THRESHOLD) {
          if (acc > 0) gain += acc;
          else loss += Math.abs(acc);
          acc = 0;
        }
      }
      prevEle = p.ele;
    } else if (inSegment) break;
  }
  return { gainM: gain, lossM: loss };
}

// ── Table builder ─────────────────────────────────────────────────────────────

export function buildInitialPacingTable(
  aidStations: AidStation[],
  totalKm: number,
  points: TrackPoint[],
  startTimeStr: string,
  basePaceMinPerKm: number,
): PacingRow[] {
  const checkpoints = [
    { id: "START",  name: "START",  cumKm: 0,       cutoff: "" },
    ...aidStations.map((s) => ({
      id: s.id, name: s.name, cumKm: s.cumulative_km, cutoff: s.cutoff_time || "",
    })),
    { id: "FINISH", name: "FINISH", cumKm: totalKm, cutoff: "" },
  ];

  const startMin = timeStringToMinutes(startTimeStr);
  const rows: PacingRow[] = [];
  let departureElapsed = 0;
  let cumulativeGain = 0;

  for (let i = 0; i < checkpoints.length; i++) {
    const cp = checkpoints[i];
    const prev = i > 0 ? checkpoints[i - 1] : null;
    const legKm = prev ? Math.max(0, cp.cumKm - prev.cumKm) : 0;

    const { gainM, lossM } = prev
      ? legElevation(points, prev.cumKm, cp.cumKm)
      : { gainM: 0, lossM: 0 };

    cumulativeGain += gainM;

    const timeSpentMin = i === 0 ? 0 : computeLegTime(legKm, basePaceMinPerKm);
    const arrivalElapsed = i === 0 ? 0 : departureElapsed + timeSpentMin;

    rows.push({
      stationId: cp.id,
      stationName: cp.name,
      cumulativeKm: cp.cumKm,
      legKm,
      legGainM: gainM,
      legLossM: lossM,
      cumulativeGainM: cumulativeGain,
      targetPaceMinPerKm: i === 0 ? basePaceMinPerKm : computePaceFromTime(legKm, timeSpentMin),
      timeSpentMin,
      restMin: 0,
      cumulativeTimeMin: arrivalElapsed,
      timeOfDay: minutesToTimeString(startMin + arrivalElapsed),
      cutoffTime: cp.cutoff,
      bufferMin: cp.cutoff
        ? timeStringToMinutes(cp.cutoff) - (startMin + arrivalElapsed)
        : null,
      manualLocked: false,
      note: "",
    });

    departureElapsed = arrivalElapsed + 0; // rest is 0 on creation
  }
  return rows;
}

// ── Domino recalculation ──────────────────────────────────────────────────────

/**
 * changedField:
 *   "pace"  → recompute timeSpentMin = legKm × pace, lock row, cascade
 *   "time"  → recompute pace = time / legKm, lock row, cascade
 *   "rest"  → no lock, just cascade times forward
 *   "note"  → no recalc
 */
export function recalcFromRow(
  rows: PacingRow[],
  editedIndex: number,
  changedField: "pace" | "time" | "rest" | "note",
  startTimeStr: string,
): PacingRow[] {
  const next = rows.map((r) => ({ ...r }));
  const startMin = timeStringToMinutes(startTimeStr);

  if (changedField === "note") return next;

  const edited = next[editedIndex];

  if (changedField === "pace" && editedIndex > 0) {
    edited.timeSpentMin = computeLegTime(edited.legKm, edited.targetPaceMinPerKm);
    edited.manualLocked = true;
  }

  if (changedField === "time" && editedIndex > 0) {
    edited.targetPaceMinPerKm = computePaceFromTime(edited.legKm, edited.timeSpentMin);
    edited.manualLocked = true;
  }

  // Cascade from row 0 to rebuild all times
  let departureElapsed = 0;

  for (let i = 0; i < next.length; i++) {
    const row = next[i];

    if (i === 0) {
      row.cumulativeTimeMin = 0;
      row.timeOfDay = minutesToTimeString(startMin);
      row.bufferMin = null;
      departureElapsed = row.restMin;
      continue;
    }

    // Recompute time for unlocked rows that weren't directly edited
    if (!row.manualLocked && i !== editedIndex) {
      row.timeSpentMin = computeLegTime(row.legKm, row.targetPaceMinPerKm);
    }

    const arrivalElapsed = departureElapsed + row.timeSpentMin;
    row.cumulativeTimeMin = arrivalElapsed;
    row.timeOfDay = minutesToTimeString(startMin + arrivalElapsed);
    row.bufferMin = row.cutoffTime
      ? timeStringToMinutes(row.cutoffTime) - (startMin + arrivalElapsed)
      : null;

    departureElapsed = arrivalElapsed + row.restMin;
  }

  return next;
}

// ── Warning checks ────────────────────────────────────────────────────────────

export const BUFFER_WARNING_THRESHOLD = 15;

export function isOverCutoff(row: PacingRow): boolean {
  return !!row.cutoffTime && row.bufferMin !== null && row.bufferMin < 0;
}

export function isLowBuffer(row: PacingRow): boolean {
  return !!row.cutoffTime && row.bufferMin !== null &&
    row.bufferMin >= 0 && row.bufferMin < BUFFER_WARNING_THRESHOLD;
}
