import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clicks, sessions, shows } from "@/db/schema";
import { isUuid } from "@/lib/uuid";
import BrandHeader from "@/app/BrandHeader";
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

  // Only numbers go to the client: time in ms + a compact index for the person.
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
      <h1 style={{ margin: "0 0 4px", fontSize: 32 }}>{show.name}</h1>
      <p style={{ margin: "0 0 20px", color: "var(--text-secondary)" }}>
        {points.length} clicks · {audience} people joined
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
    <main style={{ padding: "0 16px 48px", maxWidth: 1400, margin: "0 auto" }}>
      <BrandHeader />
      <p style={{ margin: "0 0 12px" }}>
        <Link href="/">← All shows</Link>
      </p>
      <Suspense fallback={<p>Loading…</p>}>
        <ShowView params={props.params} />
      </Suspense>
    </main>
  );
}
