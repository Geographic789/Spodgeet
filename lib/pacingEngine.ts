/**
 * Spodgeet — Pacing Engine
 *
 * Pure functions only. No React, no Supabase — this can be unit-tested
 * independently and runs on both server and client.
 */

import type { TrackPoint, AidStation } from "./routeTypes";

// ─── Row types ──────────────────────────────────────────────────────────────

export type PacingRow = {
  /** Matches aid_stations.id, or "START" / "FINISH" */
  stationId: string;
  stationName: string;
  cumulativeKm: number;
  legKm: number;
  legGainM: number;
  legLossM: number;
  /** Minutes per km — the user's target pace for THIS leg */
  targetPaceMinPerKm: number;
  /** Minutes spent on this leg (computed or manually locked) */
  timeSpentMin: number;
  /** Minutes from race start when arriving at this station */
  cumulativeTimeMin: number;
  /** Clock time string HH:MM when arriving (derived from start time + cumulative) */
  timeOfDay: string;
  /** Cut-off time string HH:MM set by admin (empty = no cutoff) */
  cutoffTime: string;
  /** Buffer in minutes = cutoffMinutesFromStart - cumulativeTimeMin */
  bufferMin: number | null;
  /** True if this row's timeSpentMin is manually overridden */
  manualLocked: boolean;
  note: string;
};

export type FatigueTier = {
  minPct: number;
  maxPct: number;
  multiplier: number;
};

// Default PRD values — overridden by admin DB config when available
export const DEFAULT_FATIGUE_TIERS: FatigueTier[] = [
  { minPct: 0,  maxPct: 30,  multiplier: 1.00 },
  { minPct: 31, maxPct: 60,  multiplier: 1.15 },
  { minPct: 61, maxPct: 90,  multiplier: 1.30 },
  { minPct: 91, maxPct: 100, multiplier: 1.40 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** "06:30" → minutes since midnight (390) */
export function timeStringToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Minutes since midnight → "06:30" */
export function minutesToTimeString(totalMin: number): string {
  // Handle times crossing midnight (e.g. 100km night races)
  const mod = ((totalMin % 1440) + 1440) % 1440;
  const h = Math.floor(mod / 60);
  const m = Math.round(mod % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Minutes → "HH:MM" duration string */
export function minutesToDuration(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "HH:MM" duration string → total minutes */
export function durationToMinutes(d: string): number {
  return timeStringToMinutes(d);
}

/** Get fatigue multiplier for a given cumulative distance percentage */
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

/**
 * Compute time spent on a leg (minutes).
 *
 * Formula (PRD Module 2):
 *   adjusted_equivalent_km = leg_km + (leg_gain_m / 100)
 *   leg_time = adjusted_km × pace × fatigue_multiplier
 *
 * The "100m gain = 1 equivalent flat km" follows international trail-running
 * pacing standards (Scarf / trail-running community convention).
 */
export function computeLegTime(
  legKm: number,
  legGainM: number,
  paceMinPerKm: number,
  multiplier: number
): number {
  const adjustedKm = legKm + legGainM / 100;
  return adjustedKm * paceMinPerKm * multiplier;
}

/**
 * Compute elevation gain and loss for a leg between two cumulative km values
 * by scanning the GPX track points in that segment.
 */
export function legElevation(
  points: TrackPoint[],
  fromKm: number,
  toKm: number
): { gainM: number; lossM: number } {
  let gain = 0;
  let loss = 0;
  let inSegment = false;
  let prevEle: number | null = null;

  for (const p of points) {
    if (p.cum_km >= fromKm && p.cum_km <= toKm) {
      if (!inSegment) {
        inSegment = true;
        prevEle = p.ele;
        continue;
      }
      if (prevEle !== null) {
        const diff = p.ele - prevEle;
        if (diff > 0) gain += diff;
        else loss += Math.abs(diff);
      }
      prevEle = p.ele;
    } else if (inSegment) {
      break; // points are ordered, once we pass toKm we're done
    }
  }
  return { gainM: gain, lossM: loss };
}

// ─── Table builder ────────────────────────────────────────────────────────────

/**
 * Build an initial PacingRow[] from aid stations + GPX route + user settings.
 * Called once when the user first creates a plan.
 */
export function buildInitialPacingTable(
  aidStations: AidStation[],
  totalKm: number,
  points: TrackPoint[],
  startTimeStr: string,       // "HH:MM"
  basePaceMinPerKm: number,
  tiers: FatigueTier[] = DEFAULT_FATIGUE_TIERS
): PacingRow[] {
  // Build checkpoint list: START + aid stations + FINISH
  const checkpoints = [
    { id: "START", name: "START", cumKm: 0, cutoff: "" },
    ...aidStations.map((s) => ({
      id: s.id,
      name: s.name,
      cumKm: s.cumulative_km,
      cutoff: s.cutoff_time || "",
    })),
    { id: "FINISH", name: "FINISH", cumKm: totalKm, cutoff: "" },
  ];

  const startMin = timeStringToMinutes(startTimeStr);
  const rows: PacingRow[] = [];
  let cumTimeMin = 0;

  for (let i = 0; i < checkpoints.length; i++) {
    const cp = checkpoints[i];
    const prev = i > 0 ? checkpoints[i - 1] : null;
    const legKm = prev ? cp.cumKm - prev.cumKm : 0;

    const { gainM, lossM } = prev
      ? legElevation(points, prev.cumKm, cp.cumKm)
      : { gainM: 0, lossM: 0 };

    const multiplier = fatigueMultiplier(cp.cumKm, totalKm, tiers);
    const timeSpentMin =
      i === 0 ? 0 : computeLegTime(legKm, gainM, basePaceMinPerKm, multiplier);

    cumTimeMin += timeSpentMin;
    const timeOfDay = minutesToTimeString(startMin + cumTimeMin);

    const bufferMin =
      cp.cutoff && i > 0
        ? timeStringToMinutes(cp.cutoff) - (startMin + cumTimeMin)
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
      cumulativeTimeMin: cumTimeMin,
      timeOfDay,
      cutoffTime: cp.cutoff,
      bufferMin,
      manualLocked: false,
      note: "",
    });
  }
  return rows;
}

// ─── Domino recalculation ─────────────────────────────────────────────────────

/**
 * After the user edits row[editedIndex]:
 *   - Lock that row (manualLocked = true)
 *   - Recompute timeSpentMin from pace (if user edited pace, not duration)
 *   - Cascade Time of Day and Cumulative Time forward for all subsequent rows
 *
 * `changedField` distinguishes:
 *   "pace"     → recompute timeSpentMin from new pace, then cascade
 *   "duration" → use new timeSpentMin directly (user typed duration), cascade
 *   "note"     → no recalculation needed
 */
export function recalcFromRow(
  rows: PacingRow[],
  editedIndex: number,
  changedField: "pace" | "duration" | "note",
  startTimeStr: string,
  totalKm: number,
  tiers: FatigueTier[] = DEFAULT_FATIGUE_TIERS
): PacingRow[] {
  const next = rows.map((r) => ({ ...r }));
  const startMin = timeStringToMinutes(startTimeStr);

  if (changedField === "note") return next;

  const edited = next[editedIndex];
  edited.manualLocked = true;

  if (changedField === "pace") {
    // Recompute timeSpentMin from the updated pace (keeps multiplier)
    if (editedIndex > 0) {
      const multiplier = fatigueMultiplier(edited.cumulativeKm, totalKm, tiers);
      edited.timeSpentMin = computeLegTime(
        edited.legKm,
        edited.legGainM,
        edited.targetPaceMinPerKm,
        multiplier
      );
    }
  }
  // "duration": timeSpentMin already set by the caller

  // Cascade from editedIndex forward
  let cumTimeMin =
    editedIndex > 0 ? next[editedIndex - 1].cumulativeTimeMin : 0;
  for (let i = editedIndex; i < next.length; i++) {
    const row = next[i];
    if (i === 0) {
      row.cumulativeTimeMin = 0;
      row.timeOfDay = minutesToTimeString(startMin);
      row.bufferMin = null;
      continue;
    }
    // Skip recomputing time for manually-locked rows AFTER the edited one
    // (only recompute the edited one itself; leave other locked rows alone but
    //  still update their cumulative time from the cascade)
    if (i > editedIndex && !row.manualLocked) {
      const multiplier = fatigueMultiplier(row.cumulativeKm, totalKm, tiers);
      row.timeSpentMin = computeLegTime(
        row.legKm,
        row.legGainM,
        row.targetPaceMinPerKm,
        multiplier
      );
    }
    cumTimeMin += row.timeSpentMin;
    row.cumulativeTimeMin = cumTimeMin;
    row.timeOfDay = minutesToTimeString(startMin + cumTimeMin);
    row.bufferMin =
      row.cutoffTime
        ? timeStringToMinutes(row.cutoffTime) - (startMin + cumTimeMin)
        : null;
  }

  return next;
}

// ─── Warning checks ───────────────────────────────────────────────────────────

export const BUFFER_WARNING_THRESHOLD = 15; // minutes, from PRD

export function isOverCutoff(row: PacingRow): boolean {
  if (!row.cutoffTime) return false;
  return row.bufferMin !== null && row.bufferMin < 0;
}

export function isLowBuffer(row: PacingRow): boolean {
  if (!row.cutoffTime) return false;
  return (
    row.bufferMin !== null &&
    row.bufferMin >= 0 &&
    row.bufferMin < BUFFER_WARNING_THRESHOLD
  );
}
