import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { shows } from "@/db/schema";
import NewShowButton from "./shows/NewShowButton";
import styles from "./shows/shows.module.css";

function status(show: typeof shows.$inferSelect) {
  if (show.endedAt) return "Ended";
  if (show.startedAt) return "Running";
  return "Not started";
}

async function ShowList() {
  await connection();
  const rows = await db.select().from(shows).orderBy(desc(shows.createdAt));

  if (rows.length === 0) return <p>No shows yet.</p>;

  return (
    <ul className={styles.list}>
      {rows.map((show) => (
        <li key={show.id} className={styles.item}>
          <div>
            <strong>{show.name}</strong>
            <div className={styles.meta}>
              {status(show)} · created {show.createdAt.toLocaleString("en-GB")}
            </div>
          </div>
          <div className={styles.links}>
            <Link href={`/shows/${show.id}/live`}>Control room</Link>
            <Link href={`/shows/${show.id}`}>Click timeline</Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Home page = list of shows
export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.titleRow}>
        <h1>Shows</h1>
        <NewShowButton />
      </div>
      <Suspense fallback={<p>Loading…</p>}>
        <ShowList />
      </Suspense>
    </main>
  );
}
