import { getShowStatus } from "@/lib/show-status";
import { isUuid } from "@/lib/uuid";

// Show start/end: audience phones read this to enable/disable the button
export async function GET(_req: Request, ctx: RouteContext<"/api/shows/[showId]/status">) {
  const { showId } = await ctx.params;
  if (!isUuid(showId)) return Response.json({ error: "Invalid show" }, { status: 400 });

  const status = await getShowStatus(showId);
  if (!status) return Response.json({ error: "Show not found" }, { status: 404 });
  return Response.json(status, { headers: { "Cache-Control": "no-store" } });
}
