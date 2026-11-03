// Popola il database con dati di prova: 1 show, 20 persone, click casuali
// distribuiti su 10 minuti, con qualche "picco" di vita percepita.
// Uso: npm run db:seed
import { db } from "./index";
import { clicks, sessions, shows } from "./schema";

const PEOPLE = 20;
const DURATION_MS = 10 * 60 * 1000;
const PEAKS_MS = [90_000, 260_000, 420_000, 540_000];

async function main() {
  const start = Date.now() - DURATION_MS;

  const [show] = await db
    .insert(shows)
    .values({ name: "Show di prova", isOpen: true })
    .returning();

  const people = await db
    .insert(sessions)
    .values(Array.from({ length: PEOPLE }, () => ({ showId: show.id, userAgent: "seed" })))
    .returning();

  const rows: (typeof clicks.$inferInsert)[] = [];
  for (const person of people) {
    // qualche click sparso
    for (let i = 0; i < 3; i++) {
      rows.push({
        showId: show.id,
        sessionId: person.id,
        clientTs: new Date(start + Math.random() * DURATION_MS),
      });
    }
    // click vicino ai picchi (non tutti cliccano a ogni picco)
    for (const peak of PEAKS_MS) {
      if (Math.random() < 0.7) {
        rows.push({
          showId: show.id,
          sessionId: person.id,
          clientTs: new Date(start + peak + (Math.random() - 0.5) * 6000),
        });
      }
    }
  }
  await db.insert(clicks).values(rows);

  console.log(`Creato show "${show.name}" (${show.id}): ${people.length} sessioni, ${rows.length} click`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
