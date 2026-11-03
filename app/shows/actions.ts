"use server";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { shows } from "@/db/schema";
import { AUDIENCE_TEXT_MAX } from "@/lib/audience-text";
import { isUuid } from "@/lib/uuid";

export type CreateShowState = { error?: string };

export async function createShow(_prev: CreateShowState, formData: FormData): Promise<CreateShowState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Please enter a name for the show." };
  if (name.length > 200) return { error: "The name is too long." };

  const [show] = await db.insert(shows).values({ name }).returning({ id: shows.id });
  redirect(`/shows/${show.id}/live`);
}

/**
 * The client sends the moment (in server time) at which the countdown ends.
 * If it's too far from now (clock not in sync) we use the server time instead.
 */
function trustedTime(clientServerTime: number, maxDriftMs: number) {
  const now = Date.now();
  return Number.isFinite(clientServerTime) && Math.abs(clientServerTime - now) <= maxDriftMs
    ? new Date(clientServerTime)
    : new Date(now);
}

export async function startShow(showId: string, startAt: number) {
  if (!isUuid(showId)) throw new Error("Invalid show");
  await db
    .update(shows)
    .set({ startedAt: trustedTime(startAt, 10_000), isOpen: true })
    .where(and(eq(shows.id, showId), isNull(shows.startedAt)));
  refresh();
}

export async function stopShow(showId: string, stopAt: number) {
  if (!isUuid(showId)) throw new Error("Invalid show");
  await db
    .update(shows)
    .set({ endedAt: trustedTime(stopAt, 10_000), isOpen: false })
    .where(and(eq(shows.id, showId), isNotNull(shows.startedAt), isNull(shows.endedAt)));
}

/** Sets the instruction shown on the audience page. Empty text = back to the default. */
export async function updateAudienceText(showId: string, text: string) {
  if (!isUuid(showId)) throw new Error("Invalid show");
  const value = text.trim().slice(0, AUDIENCE_TEXT_MAX) || null;
  await db.update(shows).set({ audienceText: value }).where(eq(shows.id, showId));
  return value;
}
