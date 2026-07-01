"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import RouteExplorer from "@/components/RouteExplorer";
import type { AidStation, DistanceWithRoute, RaceSummary } from "@/lib/routeTypes";

export default function RouteViewerPage() {
  const { distanceId } = useParams<{ distanceId: string }>();
  const [data, setData] = useState<{
    distance: DistanceWithRoute;
    race: RaceSummary | null;
    aidStations: AidStation[];
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/distances/${distanceId}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || "Couldn't load this route.");
        }
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [distanceId]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-moss-200/70 bg-white/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="font-display text-lg tracking-wide text-moss-700">SPODGEET</span>
          <a href="/plan/new" className="btn-primary text-xs">Create pacing plan →</a>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {error && (
          <div className="card p-8 text-center text-sm text-clay-600">
            {error}{" "}
            <Link href="/admin/races" className="underline">
              Back to admin
            </Link>
          </div>
        )}
        {!error && !data && <p className="text-sm text-ink/60">Loading route…</p>}
        {data && (
          <RouteExplorer
            distance={data.distance}
            race={data.race}
            aidStations={data.aidStations}
          />
        )}
      </main>
    </div>
  );
}
