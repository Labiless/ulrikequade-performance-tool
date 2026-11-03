import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { shows } from "@/db/schema";
import NewShowButton from "./NewShowButton";
import styles from "./shows.module.css";

function status(show: typeof shows.$inferSelect) {
  if (show.endedAt) return "Concluso";
  if (show.startedAt) return "In corso";
  return "Da iniziare";
}

async function ShowList() {
  await connection();
  const rows = await db.select().from(shows).orderBy(desc(shows.createdAt));

  if (rows.length === 0) return <p>Nessuno show nel database.</p>;

  return (
    <ul className={styles.list}>
      {rows.map((show) => (
        <li key={show.id} className={styles.item}>
          <div>
            <strong>{show.name}</strong>
            <div className={styles.meta}>
              {status(show)} · creato il {show.createdAt.toLocaleString("it-IT")}
            </div>
          </div>
          <div className={styles.links}>
            <Link href={`/shows/${show.id}/live`}>Regia</Link>
            <Link href={`/shows/${show.id}`}>Timeline click</Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function ShowsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.titleRow}>
        <h1>Show</h1>
        <NewShowButton />
      </div>
      <Suspense fallback={<p>Caricamento…</p>}>
        <ShowList />
      </Suspense>
    </main>
  );
}
