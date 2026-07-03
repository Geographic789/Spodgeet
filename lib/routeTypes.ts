export type TrackPoint = {
  lat: number;
  lon: number;
  ele: number;
  cum_km: number;
  gradient?: number;  // % gradient (smoothed), added by parser
};

// ── Suunto gradient colour system ─────────────────────────────────────────
// Source: suunto.com — Climb Guidance feature docs
// "climb = red, uphill = orange, downhill = lime, descent = green, flat = blue"
// Thresholds from trail-running community standards.
export type GradientCategory = "descent" | "downhill" | "flat" | "uphill" | "climb";

export const GRADIENT_CONFIG: Record<GradientCategory, { min: number; max: number; color: string; label: string }> = {
  descent:  { min: -Infinity, max: -8,       color: "#16a34a", label: "Descent"  }, // green
  downhill: { min: -8,        max: -3,       color: "#84cc16", label: "Downhill" }, // lime
  flat:     { min: -3,        max:  3,       color: "#3b82f6", label: "Flat"     }, // blue
  uphill:   { min:  3,        max:  8,       color: "#f97316", label: "Uphill"   }, // orange
  climb:    { min:  8,        max: Infinity, color: "#ef4444", label: "Climb"    }, // red
};

export function gradientCategory(pct: number): GradientCategory {
  if (pct <= -8) return "descent";
  if (pct <= -3) return "downhill";
  if (pct <   3) return "flat";
  if (pct <   8) return "uphill";
  return "climb";
}

export function gradientColor(pct: number): string {
  return GRADIENT_CONFIG[gradientCategory(pct)].color;
}

export type AidStation = {
  id: string;
  name: string;
  cumulative_km: number;
  cutoff_time: string | null;
};

export type DistanceWithRoute = {
  id: string;
  label: string;
  distance_km: number;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  route_geojson: TrackPoint[] | null;
  race_id: string;
};

export type RaceSummary = {
  id: string;
  name: string;
  route_map_url: string | null;
};

/** Binary search for nearest track point by cum_km */
export function nearestPointIndex(points: TrackPoint[], cumKm: number): number {
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (points[mid].cum_km < cumKm) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0) {
    const prevDiff = Math.abs(points[lo - 1].cum_km - cumKm);
    const currDiff = Math.abs(points[lo].cum_km - cumKm);
    if (prevDiff < currDiff) return lo - 1;
  }
  return lo;
}

export function nearestAidStation(stations: AidStation[], cumKm: number): AidStation | null {
  if (stations.length === 0) return null;
  let nearest = stations[0];
  let bestDiff = Math.abs(stations[0].cumulative_km - cumKm);
  for (const s of stations) {
    const diff = Math.abs(s.cumulative_km - cumKm);
    if (diff < bestDiff) { bestDiff = diff; nearest = s; }
  }
  return nearest;
}

/** Downsample to ~target points for chart rendering */
export function downsample(points: TrackPoint[], target = 500): TrackPoint[] {
  if (points.length <= target) return points;
  const step = points.length / target;
  const result: TrackPoint[] = [];
  for (let i = 0; i < target; i++) result.push(points[Math.floor(i * step)]);
  result.push(points[points.length - 1]);
  return result;
}

/** Split a point array into consecutive same-color segments for polyline rendering */
export type ColoredSegment = { color: string; positions: [number, number][] };

export function buildColoredSegments(points: TrackPoint[]): ColoredSegment[] {
  if (points.length === 0) return [];
  const segments: ColoredSegment[] = [];
  let currentColor = gradientColor(points[0].gradient ?? 0);
  let currentPositions: [number, number][] = [[points[0].lat, points[0].lon]];

  for (let i = 1; i < points.length; i++) {
    const color = gradientColor(points[i].gradient ?? 0);
    if (color !== currentColor) {
      // Include this point as the start of the next segment for continuity
      currentPositions.push([points[i].lat, points[i].lon]);
      segments.push({ color: currentColor, positions: currentPositions });
      currentColor = color;
      currentPositions = [[points[i].lat, points[i].lon]];
    } else {
      currentPositions.push([points[i].lat, points[i].lon]);
    }
  }
  if (currentPositions.length > 1) {
    segments.push({ color: currentColor, positions: currentPositions });
  }
  return segments;
}
