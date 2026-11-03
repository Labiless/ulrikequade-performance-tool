"use server";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { shows } from "@/db/schema";
import { isUuid } from "@/lib/uuid";

export type CreateShowState = { error?: string };

export async function createShow(_prev: CreateShowState, formData: FormData): Promise<CreateShowState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Inserisci un nome per lo show." };
  if (name.length > 200) return { error: "Il nome è troppo lungo." };

  const [show] = await db.insert(shows).values({ name }).returning({ id: shows.id });
  redirect(`/shows/${show.id}/live`);
}

/**
 * Il client manda l'istante (in ora del server) in cui finisce il countdown.
 * Se è troppo lontano da adesso (orologio non sincronizzato) usiamo l'ora del server.
 */
function trustedTime(clientServerTime: number, maxDriftMs: number) {
  const now = Date.now();
  return Number.isFinite(clientServerTime) && Math.abs(clientServerTime - now) <= maxDriftMs
    ? new Date(clientServerTime)
    : new Date(now);
}

export async function startShow(showId: string, startAt: number) {
  if (!isUuid(showId)) throw new Error("Show non valido");
  await db
    .update(shows)
    .set({ startedAt: trustedTime(startAt, 10_000), isOpen: true })
    .where(and(eq(shows.id, showId), isNull(shows.startedAt)));
  refresh();
}

export async function stopShow(showId: string, stopAt: number) {
  if (!isUuid(showId)) throw new Error("Show non valido");
  await db
    .update(shows)
    .set({ endedAt: trustedTime(stopAt, 10_000), isOpen: false })
    .where(and(eq(shows.id, showId), isNotNull(shows.startedAt), isNull(shows.endedAt)));
}
