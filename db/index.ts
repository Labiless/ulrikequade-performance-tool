import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL non impostata");

// In locale il driver Neon parla con il proxy HTTP di docker-compose (porta 4444)
// invece che con i server Neon.
if (new URL(url).hostname === "db.localtest.me") {
  neonConfig.fetchEndpoint = (host) => `http://${host}:4444/sql`;
}

export const db = drizzle(neon(url), { schema });
