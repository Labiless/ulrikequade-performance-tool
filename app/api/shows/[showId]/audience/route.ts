import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { isUuid } from "@/lib/uuid";

// Numero di persone che si sono connesse allo show (usato dalla regia in polling)
export async function GET(_req: Request, ctx: RouteContext<"/api/shows/[showId]/audience">) {
  const { showId } = await ctx.params;
  if (!isUuid(showId)) return Response.json({ error: "Show non valido" }, { status: 400 });

  const count = await db.$count(sessions, eq(sessions.showId, showId));
  return Response.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
