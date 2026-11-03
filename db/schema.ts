import {
  bigint,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Una replica dello spettacolo. Ogni show ha il suo QR (/s/<id>).
export const shows = pgTable("shows", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  isOpen: boolean("is_open").notNull().default(false),
  // Ora del server in cui lo show è partito (fine del countdown) e terminato.
  startedAt: timestamp("started_at", { withTimezone: true, precision: 3 }),
  endedAt: timestamp("ended_at", { withTimezone: true, precision: 3 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Un telefono connesso (anonimo). Serve anche per sapere quante persone c'erano.
export const sessions = pgTable(
  "sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    showId: uuid("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_show_idx").on(t.showId)],
);

// Un click "percepisco vita".
// clientTs = ora del click sul telefono, già corretta con l'offset dal server.
// serverTs = ora in cui il server ha ricevuto il click (solo per controllo).
export const clicks = pgTable(
  "clicks",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    showId: uuid("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    clientTs: timestamp("client_ts", { withTimezone: true, precision: 3 }).notNull(),
    serverTs: timestamp("server_ts", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [index("clicks_show_ts_idx").on(t.showId, t.clientTs)],
);
