import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clicks, sessions, shows } from "@/db/schema";
import { isUuid } from "@/lib/uuid";
import ClickTimeline, { type ClickPoint } from "./ClickTimeline";

async function ShowView({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  if (!isUuid(showId)) notFound();

  const [show] = await db.select().from(shows).where(eq(shows.id, showId));
  if (!show) notFound();

  const [rows, audience] = await Promise.all([
    db
      .select({ ts: clicks.clientTs, sessionId: clicks.sessionId })
      .from(clicks)
      .where(eq(clicks.showId, showId))
      .orderBy(asc(clicks.clientTs)),
    db.$count(sessions, eq(sessions.showId, showId)),
  ]);

  // Al client passiamo solo numeri: tempo in ms + indice compatto della persona.
  const sessionIndex = new Map<string, number>();
  const points: ClickPoint[] = rows.map((r) => {
    let s = sessionIndex.get(r.sessionId);
    if (s === undefined) {
      s = sessionIndex.size;
      sessionIndex.set(r.sessionId, s);
    }
    return { t: r.ts.getTime(), s };
  });

  return (
    <>
      <h1>{show.name}</h1>
      <p>
        {points.length} click · {audience} persone connesse
      </p>
      <ClickTimeline
        showId={show.id}
        clicks={points}
        audience={audience}
        startedAt={show.startedAt?.getTime() ?? null}
        endedAt={show.endedAt?.getTime() ?? null}
      />
    </>
  );
}

export default function ShowPage(props: PageProps<"/shows/[showId]">) {
  return (
    <main style={{ padding: "16px 16px 48px", maxWidth: 1400, margin: "0 auto" }}>
      <p>
        <Link href="/shows">← Tutti gli show</Link>
      </p>
      <Suspense fallback={<p>Caricamento…</p>}>
        <ShowView params={props.params} />
      </Suspense>
    </main>
  );
}
