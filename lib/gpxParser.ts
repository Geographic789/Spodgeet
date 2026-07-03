// Client-side GPX parser. Runs in the browser (DOMParser), result uploaded to DB.

export type TrackPoint = {
  lat: number;
  lon: number;
  ele: number;
  cum_km: number;
  gradient: number;   // % gradient to next point (smoothed)
};

export type WaypointFromGpx = {
  name: string;
  lat: number;
  lon: number;
  /** km extracted from name string, e.g. "A1 คลองโบด กม9.86" → 9.86 */
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

/** Smooth gradients using a rolling window to avoid noise spikes */
function smoothGradients(raw: number[], windowSize = 10): number[] {
  return raw.map((_, i) => {
    const half = Math.floor(windowSize / 2);
    const lo = Math.max(0, i - half);
    const hi = Math.min(raw.length - 1, i + half);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += raw[j];
    return sum / (hi - lo + 1);
  });
}

/** Extract km hint from Thai/English waypoint names like "กม9.86", "กม .37.52", "km9", "9.86km" */
function extractKmHint(name: string): number | null {
  // Thai: กม followed by optional space and number
  const thai = name.match(/กม\.?\s*([\d.]+)/);
  if (thai) return parseFloat(thai[1]);
  // English: km or KM
  const eng = name.match(/km\.?\s*([\d.]+)/i);
  if (eng) return parseFloat(eng[1]);
  // Number before km
  const rev = name.match(/([\d.]+)\s*km/i);
  if (rev) return parseFloat(rev[1]);
  return null;
}

export function parseGpx(gpxText: string): ParsedRoute {
  const parser = new DOMParser();
  const xml = parser.parseFromString(gpxText, "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("Invalid GPX file.");

  // ── Waypoints (aid stations embedded in file) ──────────────────────────
  const wptNodes = Array.from(xml.getElementsByTagName("wpt"));
  const waypoints: WaypointFromGpx[] = wptNodes
    .map((node) => {
      const lat = parseFloat(node.getAttribute("lat") || "0");
      const lon = parseFloat(node.getAttribute("lon") || "0");
      const nameEl = node.getElementsByTagName("name")[0];
      const name = nameEl?.textContent?.trim() || "";
      // Skip start/finish markers
      if (/^start|^finish/i.test(name)) return null;
      return { name, lat, lon, km_hint: extractKmHint(name) };
    })
    .filter(Boolean) as WaypointFromGpx[];

  // ── Track points ─────────────────────────────────────────────────────────
  let nodes = Array.from(xml.getElementsByTagName("trkpt"));
  if (nodes.length === 0) nodes = Array.from(xml.getElementsByTagName("rtept"));
  if (nodes.length === 0) nodes = Array.from(xml.getElementsByTagName("wpt"));
  if (nodes.length === 0) throw new Error("No track points found in GPX file.");

  const rawPoints = nodes.map((node) => ({
    lat: parseFloat(node.getAttribute("lat") || "0"),
    lon: parseFloat(node.getAttribute("lon") || "0"),
    ele: parseFloat(node.getElementsByTagName("ele")[0]?.textContent || "0"),
  }));

  // Compute cumulative distances
  let cumKm = 0;
  let gain = 0;
  let loss = 0;
  const cumKms: number[] = [0];
  for (let i = 1; i < rawPoints.length; i++) {
    const prev = rawPoints[i - 1];
    const cur = rawPoints[i];
    cumKm += haversineKm(prev.lat, prev.lon, cur.lat, cur.lon);
    cumKms.push(cumKm);
    const diff = cur.ele - prev.ele;
    if (diff > 0) gain += diff;
    else loss += Math.abs(diff);
  }

  // Raw gradient per point (% = ele_diff / horiz_dist * 100)
  const rawGradients: number[] = rawPoints.map((_, i) => {
    if (i === 0) return 0;
    const dEle = rawPoints[i].ele - rawPoints[i - 1].ele;
    const dKm = cumKms[i] - cumKms[i - 1];
    if (dKm < 0.000001) return 0;
    return (dEle / (dKm * 1000)) * 100;
  });

  const smoothed = smoothGradients(rawGradients, 12);

  const points: TrackPoint[] = rawPoints.map((p, i) => ({
    lat: p.lat,
    lon: p.lon,
    ele: p.ele,
    cum_km: cumKms[i],
    gradient: smoothed[i],
  }));

  return {
    points,
    waypoints,
    totalDistanceKm: cumKm,
    elevationGainM: gain,
    elevationLossM: loss,
  };
}
