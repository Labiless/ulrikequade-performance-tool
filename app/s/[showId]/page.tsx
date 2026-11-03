import { notFound } from "next/navigation";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shows } from "@/db/schema";
import { isUuid } from "@/lib/uuid";
import AudienceJoin from "./AudienceJoin";

async function Audience({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  if (!isUuid(showId)) notFound();

  const [show] = await db
    .select({ id: shows.id, name: shows.name, endedAt: shows.endedAt })
    .from(shows)
    .where(eq(shows.id, showId));
  if (!show) notFound();

  return <AudienceJoin showId={show.id} name={show.name} ended={show.endedAt !== null} />;
}

export default function AudiencePage(props: PageProps<"/s/[showId]">) {
  return (
    <Suspense fallback={null}>
      <Audience params={props.params} />
    </Suspense>
  );
}
