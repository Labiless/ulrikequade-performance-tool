import { notFound } from "next/navigation";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shows } from "@/db/schema";
import { isUuid } from "@/lib/uuid";
import LiveControl from "./LiveControl";

async function Live({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  if (!isUuid(showId)) notFound();

  const [show] = await db.select().from(shows).where(eq(shows.id, showId));
  if (!show) notFound();

  return (
    <LiveControl
      showId={show.id}
      name={show.name}
      startedAt={show.startedAt?.getTime() ?? null}
      endedAt={show.endedAt?.getTime() ?? null}
    />
  );
}

export default function LivePage(props: PageProps<"/shows/[showId]/live">) {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Caricamento…</p>}>
      <Live params={props.params} />
    </Suspense>
  );
}
