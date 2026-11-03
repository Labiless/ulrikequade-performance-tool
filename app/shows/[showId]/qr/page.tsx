import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shows } from "@/db/schema";
import { audienceUrl, qrSvg } from "@/lib/audience-url";
import { isUuid } from "@/lib/uuid";
import styles from "./qr.module.css";

async function BigQr({ params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  if (!isUuid(showId)) notFound();

  const [show] = await db.select({ name: shows.name }).from(shows).where(eq(shows.id, showId));
  if (!show) notFound();

  const url = await audienceUrl(showId);
  const svg = await qrSvg(url);

  return (
    <main className={styles.screen}>
      <Image
        src="/brand/uqc-logo-en.png"
        alt="Ulrike Quade Company"
        width={866}
        height={240}
        className={styles.logo}
        priority
      />
      <div className={styles.qr} dangerouslySetInnerHTML={{ __html: svg }} />
      <p className={styles.name}>{show.name}</p>
      <p className={styles.url}>{url}</p>
    </main>
  );
}

export default function QrPage(props: PageProps<"/shows/[showId]/qr">) {
  return (
    <Suspense fallback={null}>
      <BigQr params={props.params} />
    </Suspense>
  );
}
