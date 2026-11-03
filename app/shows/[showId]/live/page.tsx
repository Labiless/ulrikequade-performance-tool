import { notFound } from "next/navigation";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, shows } from "@/db/schema";
import { audienceUrl, qrSvg } from "@/lib/audience-url";
import { isUuid } from "@/lib/uuid";
import LiveControl from "./LiveControl";

async function Live({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  if (!isUuid(showId)) notFound();

  const [show] = await db.select().from(shows).where(eq(shows.id, showId));
  if (!show) notFound();

  const url = await audienceUrl(show.id);
  const [svg, audience] = await Promise.all([
    qrSvg(url),
    db.$count(sessions, eq(sessions.showId, show.id)),
  ]);

  return (
    <LiveControl
      showId={show.id}
      name={show.name}
      startedAt={show.startedAt?.getTime() ?? null}
      endedAt={show.endedAt?.getTime() ?? null}
      audienceUrl={url}
      qrSvg={svg}
      initialAudience={audience}
    />
  );
}

export default function LivePage(props: PageProps<"/shows/[showId]/live">) {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading…</p>}>
      <Live params={props.params} />
    </Suspense>
  );
}
