"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TrackPoint, AidStation } from "@/lib/routeTypes";
import { nearestPointIndex, buildColoredSegments, GRADIENT_CONFIG } from "@/lib/routeTypes";

const aidStationIcon = L.divIcon({
  className: "",
  html: `<div style="width:13px;height:13px;border-radius:9999px;background:#a85a31;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>`,
  iconSize: [13, 13], iconAnchor: [6, 6],
});

const hoverIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:9999px;background:#1b2017;border:3px solid white;box-shadow:0 0 0 3px rgba(27,32,23,0.25)"></div>`,
  iconSize: [16, 16], iconAnchor: [8, 8],
});

function FitBounds({ points }: { points: TrackPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [points, map]);
  return null;
}

export default function RouteMap({
  points, aidStations, hoverCumKm, showGradientColors = true,
}: {
  points: TrackPoint[];
  aidStations: AidStation[];
  hoverCumKm: number | null;
  showGradientColors?: boolean;
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

  const aidMarkers = useMemo(() =>
    aidStations.map((s) => {
      const p = points[nearestPointIndex(points, s.cumulative_km)];
      return p ? { station: s, lat: p.lat, lon: p.lon } : null;
    }).filter(Boolean) as { station: AidStation; lat: number; lon: number }[],
  [aidStations, points]);

  if (!points.length) return (
    <div className="flex h-full items-center justify-center text-sm text-ink/50">No route data.</div>
  );

  return (
    <MapContainer
      center={[points[0].lat, points[0].lon]}
      zoom={13}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      {/* CartoDB Positron — light/minimal base, route colors pop clearly */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />
      <FitBounds points={points} />

      {coloredSegments
        ? coloredSegments.map((seg, i) => (
            <Polyline key={i} positions={seg.positions}
              pathOptions={{ color: seg.color, weight: 4, opacity: 0.95 }} />
          ))
        : <Polyline positions={flatPositions}
            pathOptions={{ color: "#a85a31", weight: 4 }} />
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
