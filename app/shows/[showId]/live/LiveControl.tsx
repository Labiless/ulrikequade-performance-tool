"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { syncClock, type ClockSync } from "@/lib/clock";
import { startShow, stopShow } from "../../actions";
import styles from "./live.module.css";

type Props = {
  showId: string;
  name: string;
  startedAt: number | null;
  endedAt: number | null;
};

const COUNTDOWN_MS = 3000;
const FLASH_MS = 300;
const RESYNC_MS = 5 * 60 * 1000;

export default function LiveControl({ showId, name, startedAt, endedAt: savedEnd }: Props) {
  const router = useRouter();
  const [sync, setSync] = useState<ClockSync | null>(null);
  const [now, setNow] = useState<number | null>(null);
  // Istante di partenza deciso localmente: serve per il countdown prima che il server risponda
  const [plannedStart, setPlannedStart] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Istante di stop deciso localmente: blocca subito il cronometro, senza aspettare il server
  const [localEnd, setLocalEnd] = useState<number | null>(null);
  const endedAt = savedEnd ?? localEnd;
  const [pending, startTransition] = useTransition();

  // Sincronizza l'orologio col server all'apertura e poi ogni 5 minuti
  useEffect(() => {
    let cancelled = false;
    const run = () =>
      syncClock()
        .then((s) => !cancelled && setSync(s))
        .catch(() => !cancelled && setError("Impossibile sincronizzare l'orologio col server."));
    run();
    const id = setInterval(run, RESYNC_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Orologio: ora del server, aggiornata a ogni frame
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

  // Tiene lo schermo acceso (questo dispositivo fa anche da ciak per la videocamera)
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = () =>
      navigator.wakeLock
        ?.request("screen")
        .then((l) => (lock = l))
        .catch(() => {});
    request();
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

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
        setError("Errore nell'avvio dello show. Riprova.");
      }
    });
  };

  const onStop = () => {
    if (now === null) return;
    if (!window.confirm("Fermare lo show? Non si potrà riavviare.")) return;
    const at = now;
    setLocalEnd(at);
    setError(null);
    startTransition(async () => {
      try {
        await stopShow(showId, at);
        router.push(`/shows/${showId}`);
      } catch {
        setLocalEnd(null);
        setError("Errore nello stop dello show. Riprova.");
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
        <Link href="/shows" className={styles.back}>
          ← Show
        </Link>
        <span className={styles.name}>{name}</span>
        <button type="button" className={styles.ghost} onClick={toggleFullscreen}>
          Schermo intero
        </button>
      </header>

      <section className={styles.center}>
        {phase === "idle" && (
          <button
            type="button"
            className={styles.startButton}
            onClick={onStart}
            disabled={!sync || pending}
          >
            {sync ? "Start" : "Sincronizzo…"}
          </button>
        )}

        {phase === "countdown" && now !== null && start !== null && (
          <div className={styles.countdown}>{Math.ceil((start - now) / 1000)}</div>
        )}

        {(phase === "running" || phase === "ended") && now !== null && start !== null && (
          <>
            <div className={styles.label}>Durata show</div>
            <div className={styles.stopwatch}>{formatDuration((endedAt ?? now) - start)}</div>
          </>
        )}

        {phase === "ended" && (
          <p className={styles.ended}>
            Show concluso · <Link href={`/shows/${showId}`}>vai alla timeline dei click</Link>
          </p>
        )}

        {error && <p className={styles.error}>{error}</p>}
      </section>

      <footer className={styles.footer}>
        <div>
          <div className={styles.label}>Ora server</div>
          <div className={styles.clock}>{now !== null ? formatClock(now) : "--:--:--.-"}</div>
          {sync && <div className={styles.sync}>sincronizzato ±{Math.round(sync.uncertainty)} ms</div>}
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
