/**
 * Builds a synthetic elevation profile from aid station gain/loss data.
 * Used when no GPX file is available.
 * 
 * Model: each leg climbs first then descends (peak model).
 * Returns interpolated points in the same format as GPX track points.
 */

import type { TrackPoint } from "./routeTypes";

type StationWithEle = {
  cumulative_km: number;
  leg_gain_m: number;
  leg_loss_m: number;
};

export function buildSyntheticElevation(stations: StationWithEle[]): TrackPoint[] {
  if (!stations || stations.length === 0) return [];

  const BASE_ELE = 100; // Start at 100m above sea level
  const points: TrackPoint[] = [];

  let currentEle = BASE_ELE;
  // Add start point
  points.push({ lat: 0, lon: 0, ele: BASE_ELE, cum_km: 0, gradient: 0 });

  for (let i = 0; i < stations.length; i++) {
    const station = stations[i];
    const prevKm = i === 0 ? 0 : stations[i - 1].cumulative_km;
    const legKm = station.cumulative_km - prevKm;
    if (legKm <= 0) continue;

    const gain = station.leg_gain_m || 0;
    const loss = station.leg_loss_m || 0;

    const peakEle = currentEle + gain;
    const endEle = peakEle - loss;

    // Peak position along leg (proportional to gain vs loss)
    const totalChange = gain + loss;
    const peakFraction = totalChange > 0 ? gain / totalChange : 0.5;
    const peakKm = prevKm + legKm * peakFraction;

    // Generate interpolated points (one per 0.5km minimum)
    const numPoints = Math.max(10, Math.ceil(legKm / 0.5));

    for (let j = 1; j <= numPoints; j++) {
      const km = prevKm + (legKm * j) / numPoints;
      let ele: number;

      if (peakFraction <= 0) {
        // Pure descent
        ele = currentEle - loss * (j / numPoints);
      } else if (peakFraction >= 1) {
        // Pure ascent
        ele = currentEle + gain * (j / numPoints);
      } else if (km <= peakKm) {
        // Climbing phase
        const t = (km - prevKm) / (peakKm - prevKm);
        ele = currentEle + gain * t;
      } else {
        // Descending phase
        const t = (km - peakKm) / (station.cumulative_km - peakKm);
        ele = peakEle - loss * t;
      }

      const prevPoint = points[points.length - 1];
      const dEle = ele - prevPoint.ele;
      const dKm = km - prevPoint.cum_km;
      const gradient = dKm > 0 ? (dEle / (dKm * 1000)) * 100 : 0;

      points.push({ lat: 0, lon: 0, ele: Math.round(ele * 10) / 10, cum_km: km, gradient });
    }

    currentEle = endEle;
  }

  return points;
}
