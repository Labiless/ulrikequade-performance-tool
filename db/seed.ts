// Fills the database with test data: 1 show, 20 people, random clicks
// spread over 10 minutes, with a few "peaks" of perceived life.
// Usage: npm run db:seed
import { db } from "./index";
import { clicks, sessions, shows } from "./schema";

const PEOPLE = 20;
const DURATION_MS = 10 * 60 * 1000;
const PEAKS_MS = [90_000, 260_000, 420_000, 540_000];

async function main() {
  const start = Date.now() - DURATION_MS;

  const [show] = await db
    .insert(shows)
    .values({ name: "Test show", isOpen: true })
    .returning();

  const people = await db
    .insert(sessions)
    .values(Array.from({ length: PEOPLE }, () => ({ showId: show.id, userAgent: "seed" })))
    .returning();

  const rows: (typeof clicks.$inferInsert)[] = [];
  for (const person of people) {
    // a few scattered clicks
    for (let i = 0; i < 3; i++) {
      rows.push({
        showId: show.id,
        sessionId: person.id,
        clientTs: new Date(start + Math.random() * DURATION_MS),
      });
    }
    // clicks near the peaks (not everyone clicks at every peak)
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

  console.log(`Created show "${show.name}" (${show.id}): ${people.length} sessions, ${rows.length} clicks`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
