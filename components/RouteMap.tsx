"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TrackPoint, AidStation } from "@/lib/routeTypes";
import { nearestPointIndex, buildColoredSegments, GRADIENT_CONFIG } from "@/lib/routeTypes";

const aidStationIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:9999px;background:#a85a31;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const hoverIcon = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:9999px;background:#1b2017;border:3px solid white;box-shadow:0 0 0 3px rgba(27,32,23,0.3)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function FitBounds({ points }: { points: TrackPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [28, 28] });
  }, [points, map]);
  return null;
}

export default function RouteMap({
  points,
  aidStations,
  hoverCumKm,
  showGradientColors = true,
}: {
  points: TrackPoint[];
  aidStations: AidStation[];
  hoverCumKm: number | null;
  showGradientColors?: boolean;
}) {
  // Colored segments (memoised — expensive on 10k+ points)
  const coloredSegments = useMemo(() => {
    if (!showGradientColors || points.length === 0) return null;
    return buildColoredSegments(points);
  }, [points, showGradientColors]);

  const flatPositions = useMemo(
    () => points.map((p) => [p.lat, p.lon] as [number, number]),
    [points]
  );

  const hoverPoint = useMemo(() => {
    if (hoverCumKm === null || points.length === 0) return null;
    return points[nearestPointIndex(points, hoverCumKm)];
  }, [hoverCumKm, points]);

  const aidMarkers = useMemo(() => {
    return aidStations
      .map((s) => {
        const idx = nearestPointIndex(points, s.cumulative_km);
        const p = points[idx];
        return p ? { station: s, lat: p.lat, lon: p.lon } : null;
      })
      .filter(Boolean) as { station: AidStation; lat: number; lon: number }[];
  }, [aidStations, points]);

  if (points.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-ink/50">No route data.</div>;
  }

  return (
    <MapContainer
      center={[points[0].lat, points[0].lon]}
      zoom={13}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)'
        url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
        maxZoom={17}
      />
      <FitBounds points={points} />

      {coloredSegments
        ? coloredSegments.map((seg, i) => (
            <Polyline
              key={i}
              positions={seg.positions}
              pathOptions={{ color: seg.color, weight: 4, opacity: 0.9 }}
            />
          ))
        : <Polyline positions={flatPositions} pathOptions={{ color: "#49653a", weight: 4 }} />
      }

      {aidMarkers.map(({ station, lat, lon }) => (
        <Marker key={station.id} position={[lat, lon]} icon={aidStationIcon} />
      ))}

      {hoverPoint && (
        <Marker position={[hoverPoint.lat, hoverPoint.lon]} icon={hoverIcon} />
      )}
    </MapContainer>
  );
}
