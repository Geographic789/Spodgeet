// Client-side GPX parser — runs in the browser (DOMParser).
// Elevation gain/loss uses a 13m accumulation threshold,
// calibrated against Suunto app for RFTW 50K GPX data.

export type TrackPoint = {
  lat: number;
  lon: number;
  ele: number;
  cum_km: number;
  gradient: number; // % gradient (smoothed)
};

export type WaypointFromGpx = {
  name: string;
  lat: number;
  lon: number;
  km_hint: number | null;
};

export type ParsedRoute = {
  points: TrackPoint[];
  waypoints: WaypointFromGpx[];
  totalDistanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function smoothGradients(raw: number[], windowSize = 12): number[] {
  return raw.map((_, i) => {
    const half = Math.floor(windowSize / 2);
    const lo = Math.max(0, i - half);
    const hi = Math.min(raw.length - 1, i + half);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += raw[j];
    return sum / (hi - lo + 1);
  });
}

function extractKmHint(name: string): number | null {
  const thai = name.match(/กม\.?\s*([\d.]+)/);
  if (thai) return parseFloat(thai[1]);
  const eng = name.match(/km\.?\s*([\d.]+)/i);
  if (eng) return parseFloat(eng[1]);
  const rev = name.match(/([\d.]+)\s*km/i);
  if (rev) return parseFloat(rev[1]);
  return null;
}

/**
 * Elevation gain/loss using 13m accumulation threshold.
 * Calibrated: gives +1636m vs Suunto's +1632m on RFTW_50NEW_2.gpx
 * Raw GPS noise reduction: ~55% vs naive point-to-point.
 */
function computeElevation(eles: number[]): { gainM: number; lossM: number } {
  const THRESHOLD = 13;
  let gain = 0, loss = 0, acc = 0;
  for (let i = 1; i < eles.length; i++) {
    acc += eles[i] - eles[i - 1];
    if (Math.abs(acc) >= THRESHOLD) {
      if (acc > 0) gain += acc;
      else loss += Math.abs(acc);
      acc = 0;
    }
  }
  return { gainM: gain, lossM: loss };
}

export function parseGpx(gpxText: string): ParsedRoute {
  const parser = new DOMParser();
  const xml = parser.parseFromString(gpxText, "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("Invalid GPX file.");

  // Detect namespace
  const rootTag = xml.documentElement.tagName;
  const nsMatch = xml.documentElement.getAttribute("xmlns");
  const ns = nsMatch || "";

  function findAll(tag: string): Element[] {
    if (ns) {
      const els = Array.from(xml.getElementsByTagNameNS(ns, tag));
      if (els.length) return els;
    }
    return Array.from(xml.getElementsByTagName(tag));
  }

  function getText(el: Element, tag: string): string {
    if (ns) {
      const child = el.getElementsByTagNameNS(ns, tag)[0];
      if (child) return child.textContent?.trim() || "";
    }
    return el.getElementsByTagName(tag)[0]?.textContent?.trim() || "";
  }

  // ── Waypoints (aid stations) ───────────────────────────────────────────
  const wptEls = findAll("wpt");
  const waypoints: WaypointFromGpx[] = wptEls
    .map((node) => {
      const lat = parseFloat(node.getAttribute("lat") || "0");
      const lon = parseFloat(node.getAttribute("lon") || "0");
      const name = getText(node, "name");
      if (/^start|^finish/i.test(name)) return null;
      return { name, lat, lon, km_hint: extractKmHint(name) };
    })
    .filter(Boolean) as WaypointFromGpx[];

  // ── Track points ──────────────────────────────────────────────────────
  let trkpts = findAll("trkpt");
  if (!trkpts.length) trkpts = findAll("rtept");
  if (!trkpts.length) trkpts = findAll("wpt");
  if (!trkpts.length) throw new Error("No track points found in GPX file.");

  const rawPoints = trkpts.map((node) => ({
    lat: parseFloat(node.getAttribute("lat") || "0"),
    lon: parseFloat(node.getAttribute("lon") || "0"),
    ele: parseFloat(getText(node, "ele") || "0"),
  }));

  // Cumulative distances
  let cumKm = 0;
  const cumKms: number[] = [0];
  for (let i = 1; i < rawPoints.length; i++) {
    cumKm += haversineKm(
      rawPoints[i - 1].lat, rawPoints[i - 1].lon,
      rawPoints[i].lat, rawPoints[i].lon
    );
    cumKms.push(cumKm);
  }

  // Elevation gain/loss with 13m threshold (calibrated to Suunto)
  const eles = rawPoints.map((p) => p.ele);
  const { gainM, lossM } = computeElevation(eles);

  // Per-point gradient (for map coloring) — uses smoothed values
  const rawGradients: number[] = rawPoints.map((_, i) => {
    if (i === 0) return 0;
    const dEle = rawPoints[i].ele - rawPoints[i - 1].ele;
    const dKm = cumKms[i] - cumKms[i - 1];
    if (dKm < 0.000001) return 0;
    return (dEle / (dKm * 1000)) * 100;
  });
  const smoothed = smoothGradients(rawGradients, 12);

  const points: TrackPoint[] = rawPoints.map((p, i) => ({
    lat: p.lat, lon: p.lon, ele: p.ele,
    cum_km: cumKms[i],
    gradient: smoothed[i],
  }));

  return {
    points, waypoints,
    totalDistanceKm: cumKm,
    elevationGainM: gainM,
    elevationLossM: lossM,
  };
}
