import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { isUuid } from "@/lib/uuid";

// Number of people who joined the show (polled by the control room)
export async function GET(_req: Request, ctx: RouteContext<"/api/shows/[showId]/audience">) {
  const { showId } = await ctx.params;
  if (!isUuid(showId)) return Response.json({ error: "Invalid show" }, { status: 400 });

  const count = await db.$count(sessions, eq(sessions.showId, showId));
  return Response.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
