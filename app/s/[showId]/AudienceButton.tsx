"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { syncClock, type ClockSync } from "@/lib/clock";
import { useWakeLock } from "@/lib/useWakeLock";
import { joinShow } from "../actions";
import styles from "./audience.module.css";

type Props = {
  showId: string;
  name: string;
  startedAt: number | null;
  endedAt: number | null;
};

const POLL_BEFORE_START_MS = 2000; // before the show: check often, to enable on time
const POLL_DURING_MS = 5000; // during: only needed to know when it ends
const FLUSH_MS = 3000; // how often to retry sending queued clicks
const RESYNC_MS = 5 * 60 * 1000;
const MAX_BATCH = 200;

// --- localStorage, guarded: it may not work in private browsing ---
function load(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

// One join request per show per page load. Without this, React's development mode
// (which runs effects twice) or a fast re-render would register the same phone twice.
const joinRequests = new Map<string, Promise<string | null>>();

function joinOnce(showId: string, existing: string | null) {
  let request = joinRequests.get(showId);
  if (!request) {
    request = joinShow(showId, existing);
    joinRequests.set(showId, request);
    request.catch(() => joinRequests.delete(showId));
  }
  return request;
}

export default function AudienceButton({ showId, name, startedAt: initialStart, endedAt: initialEnd }: Props) {
  const sessionKey = `session:${showId}`;
  const queueKey = `clicks:${showId}`;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState(false);
  const [startedAt, setStartedAt] = useState(initialStart);
  const [endedAt, setEndedAt] = useState(initialEnd);
  const [sync, setSync] = useState<ClockSync | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [pulse, setPulse] = useState(0);

  // Queue of clicks not yet confirmed by the server (timestamps in server time)
  const queue = useRef<number[]>([]);
  const sending = useRef(false);

  // 1. Register the phone (reuses the saved session if there is one)
  useEffect(() => {
    if (initialEnd !== null) return;
    let cancelled = false;
    joinOnce(showId, load(sessionKey))
      .then((id) => {
        if (cancelled || !id) return;
        save(sessionKey, id);
        setSessionId(id);
      })
      .catch(() => !cancelled && setJoinError(true));
    return () => {
      cancelled = true;
    };
  }, [showId, sessionKey, initialEnd]);

  // 2. Sync the clock with the server
  useEffect(() => {
    let cancelled = false;
    const run = () =>
      syncClock()
        .then((s) => !cancelled && setSync(s))
        .catch(() => {});
    run();
    const id = setInterval(run, RESYNC_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // 3. Current server time (used to enable the button exactly at the start)
  useEffect(() => {
    if (!sync) return;
    const tick = () => setNow(Date.now() + sync.offset);
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [sync]);

  // 4. Show status: start and end are set from the control room
  const notStarted = startedAt === null;
  const ended = endedAt !== null;
  useEffect(() => {
    if (ended) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`/api/shows/${showId}/status`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { startedAt: number | null; endedAt: number | null };
        setStartedAt(data.startedAt);
        setEndedAt(data.endedAt);
      } catch {
        // no network: try again on the next round
      }
    };
    const id = setInterval(check, notStarted ? POLL_BEFORE_START_MS : POLL_DURING_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [showId, notStarted, ended]);

  // 5. Send queued clicks
  const persistQueue = useCallback(() => save(queueKey, JSON.stringify(queue.current)), [queueKey]);

  const flush = useCallback(async () => {
    if (sending.current || !sessionId) return;
    sending.current = true;
    try {
      // Send in batches until the queue is empty (usually one round is enough)
      while (queue.current.length > 0) {
        const batch = queue.current.slice(0, MAX_BATCH);
        const res = await fetch(`/api/shows/${showId}/clicks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, clicks: batch }),
        });
        // 5xx = temporary server error: retry later
        if (res.status >= 500) break;
        // 2xx = saved (or dropped because outside the show); 4xx = not retryable
        queue.current = queue.current.slice(batch.length);
        persistQueue();
      }
    } catch {
      // no network: they stay in the queue
    } finally {
      sending.current = false;
    }
  }, [sessionId, showId, persistQueue]);

  // Restore clicks left in the queue (e.g. page closed while offline) and retry periodically
  useEffect(() => {
    try {
      const stored = JSON.parse(load(queueKey) ?? "[]");
      if (Array.isArray(stored)) queue.current = stored.filter((t) => typeof t === "number");
    } catch {}
  }, [queueKey]);

  useEffect(() => {
    if (!sessionId) return;
    flush();
    const id = setInterval(flush, FLUSH_MS);
    // Page closing: one last attempt that the browser completes even after the page is gone
    const onHide = () => {
      if (queue.current.length === 0) return;
      const body = new Blob([JSON.stringify({ sessionId, clicks: queue.current.slice(0, MAX_BATCH) })], {
        type: "application/json",
      });
      navigator.sendBeacon?.(`/api/shows/${showId}/clicks`, body);
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", onHide);
    };
  }, [sessionId, showId, flush]);

  const active =
    !ended && sessionId !== null && sync !== null && startedAt !== null && now !== null && now >= startedAt;

  useWakeLock(!ended);

  const onPress = (e: PointerEvent<HTMLButtonElement>) => {
    if (!active || !sync) return;
    e.preventDefault();
    queue.current.push(Math.round(Date.now() + sync.offset));
    persistQueue();
    navigator.vibrate?.(20);
    setPulse((p) => p + 1);
    flush();
  };

  let message: string;
  if (ended) message = "The performance has ended. Thank you!";
  else if (joinError) message = "Connection failed. Please reload the page.";
  else if (!sessionId || !sync) message = "Connecting…";
  else if (!active) message = "The performance hasn't started yet";
  else message = "Tap the circle whenever you perceive life on stage";

  return (
    <main className={styles.screen}>
      <Image
        src="/brand/uqc-logo-en.png"
        alt="Ulrike Quade Company"
        width={866}
        height={240}
        className={`brand-logo-on-dark ${styles.logo}`}
        priority
      />
      <p className={styles.name}>{name}</p>

      <button
        type="button"
        className={styles.button}
        disabled={!active}
        onPointerDown={onPress}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="I perceive life"
      >
        {pulse > 0 && <span key={pulse} className={styles.pulse} aria-hidden />}
      </button>

      <p className={styles.status} role="status">
        {message}
      </p>
    </main>
  );
}
