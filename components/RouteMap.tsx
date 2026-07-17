"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TrackPoint, AidStation } from "@/lib/routeTypes";
import { nearestPointIndex, buildColoredSegments } from "@/lib/routeTypes";

// Aid station pin — colored by cutoff status
function makeAidIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:13px;height:13px;border-radius:9999px;background:${color};border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>`,
    iconSize: [13, 13], iconAnchor: [6, 6],
  });
}

const aidIconDefault = makeAidIcon("#a85a31");
const aidIconOver    = makeAidIcon("#ef4444");
const aidIconLow     = makeAidIcon("#f97316");
const aidIconOk      = makeAidIcon("#16a34a");

// Hover tracker
const hoverIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:9999px;background:#1b2017;border:3px solid white;box-shadow:0 0 0 3px rgba(27,32,23,0.25)"></div>`,
  iconSize: [16, 16], iconAnchor: [8, 8],
});

// START/FINISH label pin
function makeStartFinishIcon(label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      background:#1b2017;color:#f6f3ec;
      padding:2px 6px;border-radius:4px;
      font-size:10px;font-weight:700;font-family:monospace;
      white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.4);
    ">${label}</div>`,
    iconSize: [60, 20], iconAnchor: [30, 10],
  });
}

// Direction arrow at a given bearing
function makeArrowIcon(bearing: number) {
  return L.divIcon({
    className: "",
    html: `<svg width="14" height="14" viewBox="0 0 14 14" style="display:block">
      <path d="M7 1 L11 13 L7 10 L3 13 Z"
        fill="white" fill-opacity="0.9" stroke="#49653a" stroke-width="0.8"
        transform="rotate(${bearing},7,7)" />
    </svg>`,
    iconSize: [14, 14], iconAnchor: [7, 7],
  });
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1R = lat1 * Math.PI / 180;
  const lat2R = lat2 * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2R);
  const x = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function FitBounds({ points }: { points: TrackPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [28, 28] });
  }, [points, map]);
  return null;
}

type AidStatus = "over" | "low" | "ok" | "default";

export default function RouteMap({
  points, aidStations, hoverCumKm, showGradientColors = true, aidStatuses = {},
}: {
  points: TrackPoint[];
  aidStations: AidStation[];
  hoverCumKm: number | null;
  showGradientColors?: boolean;
  aidStatuses?: Record<string, AidStatus>;
}) {
  const coloredSegments = useMemo(() => {
    if (!showGradientColors || !points.length) return null;
    return buildColoredSegments(points);
  }, [points, showGradientColors]);

  const flatPositions = useMemo(
    () => points.map((p) => [p.lat, p.lon] as [number, number]), [points]
  );

  const hoverPoint = useMemo(() => {
    if (hoverCumKm === null || !points.length) return null;
    return points[nearestPointIndex(points, hoverCumKm)];
  }, [hoverCumKm, points]);

  // Aid station markers (positioned on nearest track point)
  const aidMarkers = useMemo(() =>
    aidStations.map((s) => {
      const p = points[nearestPointIndex(points, s.cumulative_km)];
      return p ? { station: s, lat: p.lat, lon: p.lon } : null;
    }).filter(Boolean) as { station: AidStation; lat: number; lon: number }[],
  [aidStations, points]);

  // Direction arrows — sample every ~2km
  const arrowMarkers = useMemo(() => {
    if (!points.length) return [];
    const spacing = 2; // km
    const result: { lat: number; lon: number; bearing: number }[] = [];
    let nextKm = spacing;
    for (let i = 1; i < points.length; i++) {
      if (points[i].cum_km >= nextKm) {
        const bearing = calculateBearing(
          points[i - 1].lat, points[i - 1].lon,
          points[i].lat, points[i].lon
        );
        result.push({ lat: points[i].lat, lon: points[i].lon, bearing });
        nextKm += spacing;
      }
    }
    return result;
  }, [points]);

  const startPoint = points[0];
  const endPoint   = points[points.length - 1];
  const isLoop     = startPoint && endPoint &&
    Math.abs(startPoint.lat - endPoint.lat) < 0.001 &&
    Math.abs(startPoint.lon - endPoint.lon) < 0.001;

  if (!points.length) return (
    <div className="flex h-full items-center justify-center text-sm text-ink/50">No route data.</div>
  );

  return (
    <MapContainer
      center={[startPoint.lat, startPoint.lon]}
      zoom={13} scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd" maxZoom={19}
      />
      <FitBounds points={points} />

      {/* Route */}
      {coloredSegments
        ? coloredSegments.map((seg, i) => (
            <Polyline key={i} positions={seg.positions}
              pathOptions={{ color: seg.color, weight: 4, opacity: 0.95 }} />
          ))
        : <Polyline positions={flatPositions}
            pathOptions={{ color: "#a85a31", weight: 4 }} />
      }

      {/* Direction arrows */}
      {arrowMarkers.map((a, i) => (
        <Marker key={`arrow-${i}`} position={[a.lat, a.lon]}
          icon={makeArrowIcon(a.bearing)} interactive={false} />
      ))}

      {/* Aid station markers */}
      {aidMarkers.map(({ station, lat, lon }) => {
        const status = aidStatuses[station.id] ?? "default";
        const icon = status === "over" ? aidIconOver
                   : status === "low"  ? aidIconLow
                   : status === "ok"   ? aidIconOk
                   : aidIconDefault;
        return <Marker key={station.id} position={[lat, lon]} icon={icon} />;
      })}

      {/* START / FINISH pins */}
      {startPoint && (
        <Marker
          position={[startPoint.lat, startPoint.lon]}
          icon={makeStartFinishIcon(isLoop ? "START / FINISH" : "START")}
        />
      )}
      {endPoint && !isLoop && (
        <Marker
          position={[endPoint.lat, endPoint.lon]}
          icon={makeStartFinishIcon("FINISH")}
        />
      )}

      {/* Hover tracker */}
      {hoverPoint && (
        <Marker position={[hoverPoint.lat, hoverPoint.lon]} icon={hoverIcon} />
      )}
    </MapContainer>
  );
}
