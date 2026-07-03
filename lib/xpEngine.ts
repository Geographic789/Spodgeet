/**
 * Spodgeet — XP & Gamification Engine
 * Pure functions, no framework dependencies.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type PercentileGroup = "G1" | "G2" | "G3" | "G4" | "DNF";

export type LevelTitle = {
  id: string;
  min_xp: number;
  max_xp: number;
  title_name: string;
  sort_order: number;
};

export type CommentEntry = {
  id: string;
  trigger_condition: TriggerCondition;
  comment_text: string;
};

export type TriggerCondition =
  | "Percentile_G1"
  | "Percentile_G2"
  | "Percentile_G3"
  | "Percentile_G4"
  | "DNF"
  | "Ahead_Pace"
  | "Behind_Pace"
  | "Top_100";

export type RaceResultInput = {
  status: "Finished" | "DNF";
  overall_rank: number | null;
  gender_rank: number | null;
  age_group_rank: number | null;
  total_finishers: number | null;
  top_100: boolean;
  actual_distance_km: number;
  actual_elevation_gain_m: number;
  /** Optional: plan's predicted finish time vs actual, in minutes. Negative = faster */
  pace_delta_min: number | null;
};

export type RaceResultOutput = {
  xp_earned: number;
  percentile_group: PercentileGroup;
  percentile_value: number | null;
  level_title: string;
  level_xp_min: number;
  level_xp_max: number;
  triggered_comments: string[];
};

// ── XP formula (PRD Module 4) ─────────────────────────────────────────────────
// XP = Actual Distance (km) + (Total Elevation Gain / 100)

export function computeXP(distanceKm: number, elevationGainM: number): number {
  return Math.round(distanceKm + elevationGainM / 100);
}

// ── Percentile group ──────────────────────────────────────────────────────────

export function computePercentileGroup(
  status: "Finished" | "DNF",
  rank: number | null,
  totalFinishers: number | null
): { group: PercentileGroup; percentile: number | null } {
  if (status === "DNF") return { group: "DNF", percentile: null };
  if (!rank || !totalFinishers || totalFinishers === 0) {
    return { group: "G3", percentile: null }; // default if no rank data
  }
  const pct = (rank / totalFinishers) * 100;
  let group: PercentileGroup;
  if (pct <= 25) group = "G1";
  else if (pct <= 50) group = "G2";
  else if (pct <= 75) group = "G3";
  else group = "G4";
  return { group, percentile: pct };
}

// ── Level lookup ──────────────────────────────────────────────────────────────

export function lookupLevel(
  xp: number,
  levels: LevelTitle[]
): { title: string; min_xp: number; max_xp: number } {
  const sorted = [...levels].sort((a, b) => a.min_xp - b.min_xp);
  let match = sorted[sorted.length - 1]; // default: highest
  for (const lvl of sorted) {
    if (xp >= lvl.min_xp && xp <= lvl.max_xp) {
      match = lvl;
      break;
    }
  }
  return { title: match.title_name, min_xp: match.min_xp, max_xp: match.max_xp };
}

// ── Comment picker ────────────────────────────────────────────────────────────
// Picks multiple random comments from the relevant trigger buckets simultaneously.
// PRD: "randomly pick multiple comments simultaneously (e.g. Rank Comment + Photo Comment)"

function pickRandom<T>(arr: T[], count = 1): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function pickComments(
  input: RaceResultInput,
  group: PercentileGroup,
  allComments: CommentEntry[]
): string[] {
  const triggered: string[] = [];

  // Map group to trigger condition
  const groupTrigger: TriggerCondition | null =
    group === "DNF"     ? "DNF"
    : group === "G1"    ? "Percentile_G1"
    : group === "G2"    ? "Percentile_G2"
    : group === "G3"    ? "Percentile_G3"
    : group === "G4"    ? "Percentile_G4"
    : null;

  // Pick rank comment (1–2 for G1, 2–3 for everyone else)
  if (groupTrigger) {
    const pool = allComments.filter((c) => c.trigger_condition === groupTrigger);
    const count = group === "G1" ? 1 : group === "G2" ? 2 : 3;
    pickRandom(pool, count).forEach((c) => triggered.push(c.comment_text));
  }

  // Pace comment (if plan delta available)
  if (input.pace_delta_min !== null) {
    const paceCondition: TriggerCondition =
      input.pace_delta_min < -10 ? "Ahead_Pace" : "Behind_Pace";
    const pacePool = allComments.filter((c) => c.trigger_condition === paceCondition);
    pickRandom(pacePool, 1).forEach((c) => triggered.push(c.comment_text));
  }

  // Top 100 bonus
  if (input.top_100) {
    const top100Pool = allComments.filter((c) => c.trigger_condition === "Top_100");
    pickRandom(top100Pool, 1).forEach((c) => triggered.push(c.comment_text));
  }

  return triggered;
}

// ── Main processor ────────────────────────────────────────────────────────────

export function processRaceResult(
  input: RaceResultInput,
  levels: LevelTitle[],
  allComments: CommentEntry[]
): RaceResultOutput {
  const xp = computeXP(input.actual_distance_km, input.actual_elevation_gain_m);
  const { group, percentile } = computePercentileGroup(
    input.status,
    input.overall_rank,
    input.total_finishers
  );
  const lvl = lookupLevel(xp, levels);
  const comments = pickComments(input, group, allComments);

  return {
    xp_earned: xp,
    percentile_group: group,
    percentile_value: percentile,
    level_title: lvl.title,
    level_xp_min: lvl.min_xp,
    level_xp_max: lvl.max_xp,
    triggered_comments: comments,
  };
}
