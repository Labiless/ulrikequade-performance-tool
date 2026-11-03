import { notFound } from "next/navigation";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shows } from "@/db/schema";
import { isUuid } from "@/lib/uuid";
import AudienceButton from "./AudienceButton";

async function Audience({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  if (!isUuid(showId)) notFound();

  const [show] = await db
    .select({ id: shows.id, name: shows.name, startedAt: shows.startedAt, endedAt: shows.endedAt })
    .from(shows)
    .where(eq(shows.id, showId));
  if (!show) notFound();

  return (
    <AudienceButton
      showId={show.id}
      name={show.name}
      startedAt={show.startedAt?.getTime() ?? null}
      endedAt={show.endedAt?.getTime() ?? null}
    />
  );
}

export default function AudiencePage(props: PageProps<"/s/[showId]">) {
  return (
    <Suspense fallback={null}>
      <Audience params={props.params} />
    </Suspense>
  );
}
