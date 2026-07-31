"use client";

import { useCallback } from "react";
import { minutesToDuration, type PacingRow } from "@/lib/pacingEngine";

export default function WallpaperGenerator({
  rows, raceName, distanceLabel, startTime,
}: {
  rows: PacingRow[];
  raceName: string;
  distanceLabel: string;
  startTime: string;
}) {
  const generate = useCallback(() => {
    // Phone lock screen: 393×852 CSS px at 2x = 786×1704 px
    const W = 786, H = 1704;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // Background
    ctx.fillStyle = "#1b2017";
    ctx.fillRect(0, 0, W, H);

    // Subtle gradient overlay
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(73,101,58,0.15)");
    grad.addColorStop(1, "rgba(27,32,23,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    let y = 60;

    // Header
    ctx.fillStyle = "#a3bd91";
    ctx.font = "bold 28px monospace";
    ctx.fillText("SPODGEET · สะโปดกรี้ด", 40, y); y += 44;

    ctx.fillStyle = "#f6f3ec";
    ctx.font = "bold 52px 'Arial Black', sans-serif";
    ctx.fillText(raceName.toUpperCase(), 40, y); y += 60;

    ctx.fillStyle = "#a3bd91";
    ctx.font = "32px monospace";
    ctx.fillText(`${distanceLabel}  ·  Start ${startTime}`, 40, y); y += 50;

    // Divider
    ctx.strokeStyle = "#49653a";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W - 40, y); ctx.stroke();
    y += 30;

    // Column headers
    ctx.fillStyle = "#5f814c";
    ctx.font = "bold 22px monospace";
    const cols = [40, 320, 500, 640];
    ["STATION", "CUM KM", "ETA", "CUTOFF"].forEach((h, i) => {
      ctx.fillText(h, cols[i], y);
    });
    y += 8;
    ctx.strokeStyle = "#49653a"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W - 40, y); ctx.stroke();
    y += 30;

    // Rows
    rows.forEach((row, i) => {
      if (y > H - 120) return; // safe zone

      const isStart  = row.stationId === "START";
      const isFinish = row.stationId === "FINISH";
      const overCutoff = row.bufferMin !== null && row.bufferMin < 0 && !!row.cutoffTime;
      const lowBuffer  = row.bufferMin !== null && row.bufferMin >= 0 && row.bufferMin < 15 && !!row.cutoffTime;

      // Row background for warnings
      if (overCutoff) {
        ctx.fillStyle = "rgba(239,68,68,0.15)";
        ctx.fillRect(30, y - 24, W - 60, 36);
      } else if (lowBuffer) {
        ctx.fillStyle = "rgba(251,191,36,0.12)";
        ctx.fillRect(30, y - 24, W - 60, 36);
      } else if (i % 2 === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        ctx.fillRect(30, y - 24, W - 60, 36);
      }

      // Station name
      ctx.fillStyle = isStart || isFinish ? "#a3bd91" : overCutoff ? "#fca5a5" : "#f6f3ec";
      ctx.font = isStart || isFinish ? "bold 26px monospace" : "26px monospace";
      // Truncate long names
      const name = row.stationName.length > 16
        ? row.stationName.substring(0, 14) + "…"
        : row.stationName;
      ctx.fillText(name, cols[0], y);

      // Cumulative km
      ctx.fillStyle = "#a3bd91";
      ctx.font = "26px monospace";
      ctx.fillText(row.cumulativeKm.toFixed(1), cols[1], y);

      // ETA
      ctx.fillStyle = "#f6f3ec";
      ctx.font = "bold 26px monospace";
      ctx.fillText(row.timeOfDay, cols[2], y);

      // Cutoff
      ctx.fillStyle = row.cutoffTime ? "#f97316" : "#3a4f2f";
      ctx.font = row.cutoffTime ? "bold 26px monospace" : "26px monospace";
      ctx.fillText(row.cutoffTime || "—", cols[3], y);

      // Cutoff warning indicator
      if (overCutoff) {
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 22px monospace";
        ctx.fillText("⚠ OVER", W - 140, y);
      }

      y += 38;

      // Separator line
      ctx.strokeStyle = "rgba(73,101,58,0.3)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(40, y - 6); ctx.lineTo(W - 40, y - 6); ctx.stroke();
    });

    // Bottom safe zone info
    const finishRow = rows[rows.length - 1];
    const totalMoving = rows.reduce((s, r) => s + r.timeSpentMin, 0);
    const totalRest   = rows.reduce((s, r) => s + (r.restMin || 0), 0);

    ctx.strokeStyle = "#49653a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(40, H - 110); ctx.lineTo(W - 40, H - 110); ctx.stroke();

    ctx.fillStyle = "#5f814c";
    ctx.font = "24px monospace";
    ctx.fillText(`Moving ${minutesToDuration(totalMoving)}  ·  Rest ${totalRest > 0 ? totalRest + "m" : "—"}  ·  Total ${minutesToDuration(totalMoving + totalRest)}`, 40, H - 78);

    ctx.fillStyle = "#a3bd91";
    ctx.font = "bold 28px monospace";
    ctx.fillText(`Finish: ${finishRow?.timeOfDay ?? "—"}`, 40, H - 44);

    ctx.fillStyle = "#3a4f2f";
    ctx.font = "20px monospace";
    ctx.fillText("SPODGEET · v0.5", W - 220, H - 44);

    // Download
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `spodgeet-${raceName.replace(/\s+/g, "-")}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [rows, raceName, distanceLabel, startTime]);

  return (
    <button onClick={generate} className="btn-secondary text-xs">
      📱 Download wallpaper
    </button>
  );
}
