import { getShowStatus } from "@/lib/show-status";
import { isUuid } from "@/lib/uuid";

// Inizio/fine dello show: i telefoni del pubblico lo leggono per attivare/disattivare il bottone
export async function GET(_req: Request, ctx: RouteContext<"/api/shows/[showId]/status">) {
  const { showId } = await ctx.params;
  if (!isUuid(showId)) return Response.json({ error: "Show non valido" }, { status: 400 });

  const status = await getShowStatus(showId);
  if (!status) return Response.json({ error: "Show non trovato" }, { status: 404 });
  return Response.json(status, { headers: { "Cache-Control": "no-store" } });
}
