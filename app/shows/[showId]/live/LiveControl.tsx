"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { syncClock, type ClockSync } from "@/lib/clock";
import Digits from "@/lib/Digits";
import { useWakeLock } from "@/lib/useWakeLock";
import { startShow, stopShow } from "../../actions";
import AudiencePanel from "./AudiencePanel";
import styles from "./live.module.css";

type Props = {
  showId: string;
  name: string;
  startedAt: number | null;
  endedAt: number | null;
  audienceUrl: string;
  qrSvg: string;
  initialAudience: number;
};

const COUNTDOWN_MS = 3000;
const FLASH_MS = 300;
const RESYNC_MS = 5 * 60 * 1000;

export default function LiveControl({
  showId,
  name,
  startedAt,
  endedAt: savedEnd,
  audienceUrl,
  qrSvg,
  initialAudience,
}: Props) {
  const router = useRouter();
  const [sync, setSync] = useState<ClockSync | null>(null);
  const [now, setNow] = useState<number | null>(null);
  // Start moment decided locally: drives the countdown before the server responds
  const [plannedStart, setPlannedStart] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Stop moment decided locally: freezes the stopwatch at once, without waiting for the server
  const [localEnd, setLocalEnd] = useState<number | null>(null);
  const endedAt = savedEnd ?? localEnd;
  const [pending, startTransition] = useTransition();

  // Sync the clock with the server on open and then every 5 minutes
  useEffect(() => {
    let cancelled = false;
    const run = () =>
      syncClock()
        .then((s) => !cancelled && setSync(s))
        .catch(() => !cancelled && setError("Couldn't sync the clock with the server."));
    run();
    const id = setInterval(run, RESYNC_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Clock: server time, updated every frame
  useEffect(() => {
    if (!sync) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now() + sync.offset);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sync]);

  // Keeps the screen on (this device also serves as the clapperboard for the camera)
  useWakeLock();

  const start = startedAt ?? plannedStart;
  const phase =
    endedAt !== null
      ? "ended"
      : start === null
        ? "idle"
        : now !== null && now < start
          ? "countdown"
          : "running";

  const onStart = () => {
    if (!sync || now === null) return;
    const at = now + COUNTDOWN_MS;
    setPlannedStart(at);
    setError(null);
    startTransition(async () => {
      try {
        await startShow(showId, at);
      } catch {
        setPlannedStart(null);
        setError("Error starting the show. Please try again.");
      }
    });
  };

  const onStop = () => {
    if (now === null) return;
    if (!window.confirm("Stop the show? It can't be restarted.")) return;
    const at = now;
    setLocalEnd(at);
    setError(null);
    startTransition(async () => {
      try {
        await stopShow(showId, at);
        router.push(`/shows/${showId}`);
      } catch {
        setLocalEnd(null);
        setError("Error stopping the show. Please try again.");
      }
    });
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const flash = phase === "running" && now !== null && start !== null && now - start < FLASH_MS;

  return (
    <main className={`${styles.screen} ${flash ? styles.flash : ""}`}>
      <header className={styles.header}>
        <Link href="/" aria-label="All shows">
          <Image
            src="/brand/uqc-logo-en.png"
            alt="Ulrike Quade Company"
            width={866}
            height={240}
            className={`brand-logo-on-dark ${styles.logo}`}
          />
        </Link>
        <span className={styles.name}>{name}</span>
        <Link href="/" className={styles.back}>
          All shows
        </Link>
        <button type="button" className={styles.ghost} onClick={toggleFullscreen}>
          Full screen
        </button>
      </header>

      <div className={styles.body}>
        <section className={styles.center}>
          {phase === "idle" && (
            <button
              type="button"
              className={styles.startButton}
              onClick={onStart}
              disabled={!sync || pending}
            >
              {sync ? "Start" : "Syncing…"}
            </button>
          )}

          {phase === "countdown" && now !== null && start !== null && (
            <div className={styles.countdown}>{Math.ceil((start - now) / 1000)}</div>
          )}

          {(phase === "running" || phase === "ended") && now !== null && start !== null && (
            <>
              <div className={styles.label}>Show duration</div>
              <div className={styles.stopwatch}>
                <Digits value={formatDuration((endedAt ?? now) - start)} />
              </div>
            </>
          )}

          {phase === "ended" && (
            <p className={styles.ended}>
              Show ended · <Link href={`/shows/${showId}`}>go to the click timeline</Link>
            </p>
          )}

          {error && <p className={styles.error}>{error}</p>}
        </section>

        {phase !== "ended" && (
          <AudiencePanel showId={showId} url={audienceUrl} qrSvg={qrSvg} initialCount={initialAudience} />
        )}
      </div>

      <footer className={styles.footer}>
        <div>
          <div className={styles.label}>Server time</div>
          <div className={styles.clock}>
            {now !== null ? <Digits value={formatClock(now)} /> : <span className={styles.sync}>Syncing…</span>}
          </div>
          {sync && <div className={styles.sync}>synced ±{Math.round(sync.uncertainty)} ms</div>}
        </div>

        {phase === "running" && (
          <button type="button" className={styles.stopButton} onClick={onStop} disabled={pending}>
            Stop
          </button>
        )}
      </footer>
    </main>
  );
}

function pad(n: number, len = 2) {
  return String(n).padStart(len, "0");
}

function formatClock(ms: number) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${Math.floor(d.getMilliseconds() / 100)}`;
}

function formatDuration(ms: number) {
  const total = Math.max(0, ms);
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const tenths = Math.floor((total % 1000) / 100);
  return `${h}:${pad(m)}:${pad(s)}.${tenths}`;
}
