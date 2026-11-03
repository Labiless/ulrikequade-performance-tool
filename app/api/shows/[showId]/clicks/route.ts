import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clicks, sessions } from "@/db/schema";
import { getShowStatus } from "@/lib/show-status";
import { isUuid } from "@/lib/uuid";

const MAX_BATCH = 200;
// Tolleranze per piccoli errori di sincronizzazione dell'orologio
const EARLY_MS = 1000;
const LATE_MS = 2000;

/**
 * Riceve i click di un telefono: { sessionId, clicks: [timestamp in ora server, ms] }.
 * I click possono arrivare in ritardo (rete assente): contano il timestamp, non l'ora di arrivo.
 * Vengono salvati solo quelli che cadono tra inizio e fine dello show.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/shows/[showId]/clicks">) {
  const { showId } = await ctx.params;
  if (!isUuid(showId)) return Response.json({ error: "Show non valido" }, { status: 400 });

  let body: { sessionId?: unknown; clicks?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON non valido" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!isUuid(sessionId) || !Array.isArray(body.clicks)) {
    return Response.json({ error: "Dati non validi" }, { status: 400 });
  }

  const [status, [session]] = await Promise.all([
    getShowStatus(showId),
    db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.showId, showId))),
  ]);
  if (!status || !session) return Response.json({ error: "Sessione non valida" }, { status: 403 });
  if (status.startedAt === null) return Response.json({ accepted: 0 });

  const now = Date.now();
  const from = status.startedAt - EARLY_MS;
  const to = Math.min(status.endedAt ?? now, now) + LATE_MS;

  const timestamps = body.clicks
    .slice(0, MAX_BATCH)
    .filter((t): t is number => typeof t === "number" && Number.isFinite(t) && t >= from && t <= to);

  if (timestamps.length > 0) {
    await db
      .insert(clicks)
      .values(timestamps.map((t) => ({ showId, sessionId, clientTs: new Date(t) })))
      .onConflictDoNothing();
  }

  return Response.json({ accepted: timestamps.length });
}
