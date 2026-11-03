import { connection } from "next/server";

// Restituisce l'ora del server: i client la usano per calcolare
// di quanto è sfasato il loro orologio (vedi lib/clock.ts).
export async function GET() {
  await connection();
  return Response.json({ now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
