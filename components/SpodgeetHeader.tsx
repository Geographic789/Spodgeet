"use client";

// Mountain silhouette path — hand-crafted to suggest a trail running elevation profile
const MOUNTAIN_PATH =
  "M0,80 L40,75 L70,65 L90,60 L110,55 L130,45 L145,30 L155,20 L163,12 L170,18 L178,28 " +
  "L190,35 L210,30 L225,20 L235,10 L242,4 L248,10 L256,22 L268,32 L285,38 L305,35 " +
  "L322,25 L332,18 L340,24 L352,36 L370,42 L395,40 L420,45 L450,50 L480,52 L510,48 " +
  "L540,42 L565,38 L585,32 L600,35 L620,38 L650,42 L680,48 L720,50 L760,52 " +
  "L800,55 L840,58 L880,60 L920,62 L960,64 L1000,65 L1000,100 L0,100 Z";

export default function SpodgeetHeader() {
  return (
    <header className="relative overflow-hidden bg-ink">
      {/* Mountain silhouette background */}
      <svg
        viewBox="0 0 1000 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full opacity-[0.07]"
        aria-hidden
      >
        <path d={MOUNTAIN_PATH} fill="#f6f3ec" />
      </svg>

      {/* Thin accent line top */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-clay-500 to-transparent opacity-60" />

      {/* Content */}
      <div className="relative mx-auto max-w-5xl px-6 py-7 sm:px-8">
        <div className="flex items-end justify-between">
          <div>
            {/* Main title */}
            <h1 className="font-display text-4xl tracking-[0.25em] text-sand sm:text-5xl">
              SPODGEET
            </h1>
            {/* Thai + tagline */}
            <p className="mt-1 font-mono text-xs tracking-widest text-sand/40 sm:text-sm">
              สะโปดกรี้ด &nbsp;·&nbsp; Trail Running Pace Planner
            </p>
          </div>

          {/* Tiger icon — RFTW vibe */}
          <span className="text-4xl opacity-30 select-none sm:text-5xl" aria-hidden>
            🐯
          </span>
        </div>

        {/* Bottom elevation squiggle decoration */}
        <svg
          viewBox="0 0 400 16"
          className="mt-4 w-48 opacity-25"
          preserveAspectRatio="none"
          aria-hidden
        >
          <polyline
            points="0,12 20,10 35,8 45,6 52,3 58,6 65,9 78,11 95,9 108,6 115,4 120,7 128,10 142,12 158,10 170,7 180,4 187,7 196,10 212,12 228,10 240,7 248,5 255,7 265,10 278,12 292,11 305,8 315,5 322,8 332,11 345,12 360,10 375,9 390,8 400,9"
            fill="none"
            stroke="#f97316"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </header>
  );
}
