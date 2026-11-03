import { connection } from "next/server";

// Returns the server time: clients use it to work out
// how far off their own clock is (see lib/clock.ts).
export async function GET() {
  await connection();
  return Response.json({ now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
