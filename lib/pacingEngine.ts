/**
 * Spodgeet — Pacing Engine v3
 * Grade-adjusted pace + fatigue multiplier (hybrid model).
 *
 * Core formula:
 *   effectiveKm   = legKm + legGainM / 100
 *   segmentTime   = effectiveKm × flatPace × fatigue
 *   displayedPace = segmentTime / legKm  (what runner sees)
 *
 * flatPace = back-calculated from goal time, stored in plan notes.
 * Manual overrides: user enters displayedPace → row locks, bypasses terrain math.
 */

import type { TrackPoint, AidStation } from "./routeTypes";

export type PacingRow = {
  stationId: string;
  stationName: string;
  cumulativeKm: number;
  legKm: number;
  legGainM: number;
  legLossM: number;
  cumulativeGainM: number;
  effectiveKm: number;
  displayedPaceMinPerKm: number;
  timeSpentMin: number;
  restMin: number;
  elapsedMovingMin: number;
  cumulativeTimeMin: number;
  timeOfDay: string;
  cutoffTime: string;
  bufferMin: number | null;
  manualLocked: boolean;
  note: string;
};

export type FatigueTier = { minPct: number; maxPct: number; multiplier: number };

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
  const abs = Math.abs(totalMin);
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
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
  for (const t of tiers) {
    if (pct >= t.minPct && pct <= t.maxPct) return t.multiplier;
  }
  return tiers[tiers.length - 1].multiplier;
}

export function computeEffectiveKm(legKm: number, legGainM: number): number {
  return legKm + legGainM / 100;
}

export function computeSegmentTime(
  effectiveKm: number,
  flatPaceMinPerKm: number,
  multiplier: number
): number {
  return effectiveKm * flatPaceMinPerKm * multiplier;
}

/**
 * Back-calculate flat pace from goal time.
 *   goalTime = flatPace × Σ(effectiveKm_i × fatigue_i)
 *   flatPace = goalTime / Σ(effectiveKm_i × fatigue_i)
 */
export function backCalculateFlatPace(
  aidStations: AidStation[],
  totalKm: number,
  goalTimeMin: number,
  tiers: FatigueTier[] = DEFAULT_FATIGUE_TIERS
): number {
  const checkpoints = [
    { cumKm: 0, gainM: 0 },
    ...aidStations.map((s: any) => ({ cumKm: s.cumulative_km, gainM: s.leg_gain_m || 0 })),
    { cumKm: totalKm, gainM: 0 },
  ];

  let weightedTotal = 0;
  for (let i = 1; i < checkpoints.length; i++) {
    const legKm = checkpoints[i].cumKm - checkpoints[i - 1].cumKm;
    const effKm = computeEffectiveKm(legKm, checkpoints[i].gainM);
    const mult = fatigueMultiplier(checkpoints[i].cumKm, totalKm, tiers);
    weightedTotal += effKm * mult;
  }
  if (weightedTotal === 0) return goalTimeMin / Math.max(totalKm, 1);
  return goalTimeMin / weightedTotal;
}

/** GPX leg elevation with 13m threshold */
export function legElevation(
  points: TrackPoint[],
  fromKm: number,
  toKm: number
): { gainM: number; lossM: number } {
  const THRESHOLD = 13;
  let gain = 0, loss = 0, acc = 0;
  let inSegment = false, prevEle: number | null = null;
  for (const p of points) {
    if (p.cum_km >= fromKm && p.cum_km <= toKm) {
      if (!inSegment) { inSegment = true; prevEle = p.ele; continue; }
      if (prevEle !== null) {
        acc += p.ele - prevEle;
        if (Math.abs(acc) >= THRESHOLD) {
          if (acc > 0) gain += acc; else loss += Math.abs(acc);
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
  flatPaceMinPerKm: number,
  tiers: FatigueTier[] = DEFAULT_FATIGUE_TIERS
): PacingRow[] {
  const checkpoints = [
    { id: "START",  name: "START",  cumKm: 0,       cutoff: "", gainM: 0, lossM: 0 },
    ...aidStations.map((s: any) => ({
      id: s.id, name: s.name, cumKm: s.cumulative_km,
      cutoff: s.cutoff_time || "",
      gainM: s.leg_gain_m || 0,
      lossM: s.leg_loss_m || 0,
    })),
    { id: "FINISH", name: "FINISH", cumKm: totalKm, cutoff: "", gainM: 0, lossM: 0 },
  ];

  const startMin = timeStringToMinutes(startTimeStr);
  const rows: PacingRow[] = [];
  let departureElapsed = 0;
  let movingElapsed = 0;
  let cumulativeGain = 0;

  for (let i = 0; i < checkpoints.length; i++) {
    const cp = checkpoints[i];
    const prev = i > 0 ? checkpoints[i - 1] : null;
    const legKm = prev ? Math.max(0, cp.cumKm - prev.cumKm) : 0;

    let gainM = 0, lossM = 0;
    if (points.length > 0 && prev) {
      const ele = legElevation(points, prev.cumKm, cp.cumKm);
      gainM = ele.gainM; lossM = ele.lossM;
    } else if (i > 0) {
      gainM = cp.gainM; lossM = cp.lossM;
    }

    cumulativeGain += gainM;
    const effKm = computeEffectiveKm(legKm, gainM);
    const mult = fatigueMultiplier(cp.cumKm, totalKm, tiers);
    const timeSpentMin = i === 0 ? 0 : computeSegmentTime(effKm, flatPaceMinPerKm, mult);
    const displayedPace = legKm > 0 && timeSpentMin > 0 ? timeSpentMin / legKm : 0;

    movingElapsed += timeSpentMin;
    const arrivalElapsed = i === 0 ? 0 : departureElapsed + timeSpentMin;

    rows.push({
      stationId: cp.id, stationName: cp.name,
      cumulativeKm: cp.cumKm, legKm,
      legGainM: gainM, legLossM: lossM,
      cumulativeGainM: cumulativeGain,
      effectiveKm: effKm,
      displayedPaceMinPerKm: displayedPace,
      timeSpentMin, restMin: 0,
      elapsedMovingMin: movingElapsed,
      cumulativeTimeMin: arrivalElapsed,
      timeOfDay: minutesToTimeString(startMin + arrivalElapsed),
      cutoffTime: cp.cutoff,
      bufferMin: cp.cutoff
        ? timeStringToMinutes(cp.cutoff) - (startMin + arrivalElapsed) : null,
      manualLocked: false, note: "",
    });

    departureElapsed = arrivalElapsed;
  }
  return rows;
}

// ── Domino recalculation ──────────────────────────────────────────────────────

export function recalcFromRow(
  rows: PacingRow[],
  editedIndex: number,
  changedField: "pace" | "time" | "rest" | "note",
  startTimeStr: string,
  totalKm: number,
  flatPaceMinPerKm: number,
  tiers: FatigueTier[] = DEFAULT_FATIGUE_TIERS
): PacingRow[] {
  const next = rows.map((r) => ({ ...r }));
  const startMin = timeStringToMinutes(startTimeStr);
  if (changedField === "note") return next;

  const edited = next[editedIndex];
  if (changedField === "pace" && editedIndex > 0) {
    edited.timeSpentMin = edited.legKm * edited.displayedPaceMinPerKm;
    edited.manualLocked = true;
  }
  if (changedField === "time" && editedIndex > 0) {
    edited.displayedPaceMinPerKm = edited.legKm > 0 ? edited.timeSpentMin / edited.legKm : 0;
    edited.manualLocked = true;
  }

  let departureElapsed = 0;
  let movingElapsed = 0;

  for (let i = 0; i < next.length; i++) {
    const row = next[i];
    if (i === 0) {
      row.cumulativeTimeMin = 0;
      row.elapsedMovingMin = 0;
      row.timeOfDay = minutesToTimeString(startMin);
      row.bufferMin = null;
      departureElapsed = row.restMin;
      continue;
    }

    if (!row.manualLocked) {
      const mult = fatigueMultiplier(row.cumulativeKm, totalKm, tiers);
      row.timeSpentMin = computeSegmentTime(row.effectiveKm, flatPaceMinPerKm, mult);
      row.displayedPaceMinPerKm = row.legKm > 0 ? row.timeSpentMin / row.legKm : 0;
    }

    movingElapsed += row.timeSpentMin;
    row.elapsedMovingMin = movingElapsed;
    const arrivalElapsed = departureElapsed + row.timeSpentMin;
    row.cumulativeTimeMin = arrivalElapsed;
    row.timeOfDay = minutesToTimeString(startMin + arrivalElapsed);
    row.bufferMin = row.cutoffTime
      ? timeStringToMinutes(row.cutoffTime) - (startMin + arrivalElapsed) : null;
    departureElapsed = arrivalElapsed + row.restMin;
  }
  return next;
}

export const BUFFER_WARNING_THRESHOLD = 15;
export function isOverCutoff(r: PacingRow) { return !!r.cutoffTime && r.bufferMin !== null && r.bufferMin < 0; }
export function isLowBuffer(r: PacingRow) { return !!r.cutoffTime && r.bufferMin !== null && r.bufferMin >= 0 && r.bufferMin < BUFFER_WARNING_THRESHOLD; }
