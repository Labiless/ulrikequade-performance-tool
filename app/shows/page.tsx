import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { shows } from "@/db/schema";

async function ShowList() {
  await connection();
  const rows = await db.select().from(shows).orderBy(desc(shows.createdAt));

  if (rows.length === 0) return <p>Nessuno show nel database.</p>;

  return (
    <ul>
      {rows.map((show) => (
        <li key={show.id}>
          <Link href={`/shows/${show.id}`}>{show.name}</Link>{" "}
          <small>({show.createdAt.toLocaleString("it-IT")})</small>
        </li>
      ))}
    </ul>
  );
}

export default function ShowsPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Show</h1>
      <Suspense fallback={<p>Caricamento…</p>}>
        <ShowList />
      </Suspense>
    </main>
  );
}
