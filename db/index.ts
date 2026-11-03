import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// Locally the Neon driver talks to the docker-compose HTTP proxy (port 4444)
// instead of Neon's servers.
if (new URL(url).hostname === "db.localtest.me") {
  neonConfig.fetchEndpoint = (host) => `http://${host}:4444/sql`;
}

export const db = drizzle(neon(url), { schema });
