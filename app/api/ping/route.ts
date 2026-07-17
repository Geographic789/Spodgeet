import { headers } from "next/headers";
export const dynamic = "force-dynamic";

export async function GET() {
  headers();
  return Response.json({ ok: true, ts: Date.now(), service: "Spodgeet" });
}
