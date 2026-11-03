import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shows } from "@/db/schema";

export type ShowStatus = { startedAt: number | null; endedAt: number | null };

export async function getShowStatus(showId: string): Promise<ShowStatus | null> {
  const [show] = await db
    .select({ startedAt: shows.startedAt, endedAt: shows.endedAt })
    .from(shows)
    .where(eq(shows.id, showId));
  if (!show) return null;
  return { startedAt: show.startedAt?.getTime() ?? null, endedAt: show.endedAt?.getTime() ?? null };
}
