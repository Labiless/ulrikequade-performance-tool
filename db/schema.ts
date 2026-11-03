import {
  bigint,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// One performance of the show. Each show has its own QR code (/s/<id>).
export const shows = pgTable("shows", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  isOpen: boolean("is_open").notNull().default(false),
  // Server time at which the show started (end of the countdown) and ended.
  startedAt: timestamp("started_at", { withTimezone: true, precision: 3 }),
  endedAt: timestamp("ended_at", { withTimezone: true, precision: 3 }),
  // Instruction shown on the audience page; null = default text (lib/audience-text.ts)
  audienceText: text("audience_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A joined phone (anonymous). Also tells us how many people were there.
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

// An "I perceive life" click.
// clientTs = time of the click on the phone, already corrected with the server offset.
// serverTs = time the server received the click (for checking only).
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
  (t) => [
    index("clicks_show_ts_idx").on(t.showId, t.clientTs),
    // If a phone re-sends the same click (e.g. response lost on the network), it isn't duplicated
    uniqueIndex("clicks_session_ts_uq").on(t.sessionId, t.clientTs),
  ],
);
