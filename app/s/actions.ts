"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { sessions, shows } from "@/db/schema";
import { isUuid } from "@/lib/uuid";

/**
 * Registra un telefono del pubblico. Se il telefono ha già una sessione
 * valida per questo show (salvata nel browser), la riusa invece di crearne una nuova.
 */
export async function joinShow(showId: string, existingSessionId: string | null) {
  if (!isUuid(showId)) throw new Error("Show non valido");

  if (existingSessionId && isUuid(existingSessionId)) {
    const [existing] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.id, existingSessionId), eq(sessions.showId, showId)));
    if (existing) return existing.id;
  }

  const [show] = await db.select({ endedAt: shows.endedAt }).from(shows).where(eq(shows.id, showId));
  if (!show) throw new Error("Show non trovato");
  if (show.endedAt) return null;

  const userAgent = (await headers()).get("user-agent")?.slice(0, 500) ?? null;
  const [session] = await db.insert(sessions).values({ showId, userAgent }).returning({ id: sessions.id });
  return session.id;
}
