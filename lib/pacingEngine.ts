/**
 * Spodgeet — Pacing Engine
 * Pure functions only. No React, no Supabase.
 */

import type { TrackPoint, AidStation } from "./routeTypes";

// ── Row types ─────────────────────────────────────────────────────────────────

export type PacingRow = {
  stationId: string;
  stationName: string;
  cumulativeKm: number;
  legKm: number;
  legGainM: number;
  legLossM: number;
  targetPaceMinPerKm: number;
  /** Moving time for this leg (min) */
  timeSpentMin: number;
  /** Rest time at this station before departing (min) */
  restMin: number;
  /** Total elapsed time from start to ARRIVAL at this station (min) */
  cumulativeTimeMin: number;
  /** Clock time of arrival (HH:MM) */
  timeOfDay: string;
  cutoffTime: string;
  bufferMin: number | null;
  manualLocked: boolean;
  note: string;
};

export type FatigueTier = {
  minPct: number;
  maxPct: number;
  multiplier: number;
};

export const DEFAULT_FATIGUE_TIERS: FatigueTier[] = [
  { minPct: 0,  maxPct: 30,  multiplier: 1.00 },
  { minPct: 31, maxPct: 60,  multiplier: 1.15 },
  { minPct: 61, maxPct: 90,  multiplier: 1.30 },
  { minPct: 91, maxPct: 100, multiplier: 1.40 },
];

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
  const h = Math.floor(Math.abs(totalMin) / 60);
  const m = Math.round(Math.abs(totalMin) % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function durationToMinutes(d: string): number {
  return timeStringToMinutes(d);
}

export function fatigueMultiplier(
  cumulativeKm: number,
  totalKm: number,
  tiers: FatigueTier[] = DEFAULT_FATIGUE_TIERS
): number {
  if (totalKm === 0) return 1;
  const pct = (cumulativeKm / totalKm) * 100;
  for (const tier of tiers) {
    if (pct >= tier.minPct && pct <= tier.maxPct) return tier.multiplier;
  }
  return tiers[tiers.length - 1].multiplier;
}

export function computeLegTime(
  legKm: number,
  legGainM: number,
  paceMinPerKm: number,
  multiplier: number
): number {
  const adjustedKm = legKm + legGainM / 100;
  return adjustedKm * paceMinPerKm * multiplier;
}

export function legElevation(
  points: TrackPoint[],
  fromKm: number,
  toKm: number
): { gainM: number; lossM: number } {
  let gain = 0, loss = 0;
  let inSegment = false;
  let prevEle: number | null = null;
  // Use same 13m threshold as parser for consistency
  let acc = 0;

  for (const p of points) {
    if (p.cum_km >= fromKm && p.cum_km <= toKm) {
      if (!inSegment) { inSegment = true; prevEle = p.ele; continue; }
      if (prevEle !== null) {
        acc += p.ele - prevEle;
        if (Math.abs(acc) >= 13) {
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
  tiers: FatigueTier[] = DEFAULT_FATIGUE_TIERS
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
  // departureElapsed = elapsed time from start when leaving previous station
  let departureElapsed = 0;

  for (let i = 0; i < checkpoints.length; i++) {
    const cp = checkpoints[i];
    const prev = i > 0 ? checkpoints[i - 1] : null;
    const legKm = prev ? cp.cumKm - prev.cumKm : 0;

    const { gainM, lossM } = prev
      ? legElevation(points, prev.cumKm, cp.cumKm)
      : { gainM: 0, lossM: 0 };

    const multiplier = fatigueMultiplier(cp.cumKm, totalKm, tiers);
    const timeSpentMin = i === 0 ? 0 : computeLegTime(legKm, gainM, basePaceMinPerKm, multiplier);

    const arrivalElapsed = i === 0 ? 0 : departureElapsed + timeSpentMin;
    const timeOfDay = minutesToTimeString(startMin + arrivalElapsed);

    const bufferMin = cp.cutoff
      ? timeStringToMinutes(cp.cutoff) - (startMin + arrivalElapsed)
      : null;

    rows.push({
      stationId: cp.id,
      stationName: cp.name,
      cumulativeKm: cp.cumKm,
      legKm,
      legGainM: gainM,
      legLossM: lossM,
      targetPaceMinPerKm: basePaceMinPerKm,
      timeSpentMin,
      restMin: 0,
      cumulativeTimeMin: arrivalElapsed,
      timeOfDay,
      cutoffTime: cp.cutoff,
      bufferMin,
      manualLocked: false,
      note: "",
    });

    // Next leg departs after rest
    departureElapsed = arrivalElapsed + 0; // rest defaults to 0
  }
  return rows;
}

// ── Domino recalculation ──────────────────────────────────────────────────────

export function recalcFromRow(
  rows: PacingRow[],
  editedIndex: number,
  changedField: "pace" | "duration" | "rest" | "note",
  startTimeStr: string,
  totalKm: number,
  tiers: FatigueTier[] = DEFAULT_FATIGUE_TIERS
): PacingRow[] {
  const next = rows.map((r) => ({ ...r }));
  const startMin = timeStringToMinutes(startTimeStr);

  if (changedField === "note") return next;

  if (changedField !== "rest") {
    next[editedIndex].manualLocked = true;
  }

  if (changedField === "pace" && editedIndex > 0) {
    const edited = next[editedIndex];
    const multiplier = fatigueMultiplier(edited.cumulativeKm, totalKm, tiers);
    edited.timeSpentMin = computeLegTime(
      edited.legKm, edited.legGainM, edited.targetPaceMinPerKm, multiplier
    );
  }

  // Cascade from row 1 (START row has no leg)
  // departureElapsed = elapsed time from start when leaving a station
  let departureElapsed = 0;

  for (let i = 0; i < next.length; i++) {
    const row = next[i];

    if (i === 0) {
      row.cumulativeTimeMin = 0;
      row.timeOfDay = minutesToTimeString(startMin);
      row.bufferMin = null;
      departureElapsed = row.restMin; // rest at start (unusual but possible)
      continue;
    }

    // Recompute leg time for unlocked rows after the edited one
    if (i > editedIndex && !row.manualLocked && changedField !== "rest") {
      const multiplier = fatigueMultiplier(row.cumulativeKm, totalKm, tiers);
      row.timeSpentMin = computeLegTime(
        row.legKm, row.legGainM, row.targetPaceMinPerKm, multiplier
      );
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
