"use client";

import { useEffect, useState } from "react";
import { joinShow } from "../actions";
import styles from "./audience.module.css";

type Props = { showId: string; name: string; ended: boolean };

type Status = "joining" | "joined" | "ended" | "error";

const storageKey = (showId: string) => `session:${showId}`;

function readSession(showId: string) {
  try {
    return localStorage.getItem(storageKey(showId));
  } catch {
    return null;
  }
}

function saveSession(showId: string, sessionId: string) {
  try {
    localStorage.setItem(storageKey(showId), sessionId);
  } catch {
    // navigazione privata: la sessione vale solo finché la pagina resta aperta
  }
}

export default function AudienceJoin({ showId, name, ended }: Props) {
  const [status, setStatus] = useState<Status>(ended ? "ended" : "joining");

  useEffect(() => {
    if (ended) return;
    let cancelled = false;
    joinShow(showId, readSession(showId))
      .then((sessionId) => {
        if (cancelled) return;
        if (!sessionId) return setStatus("ended");
        saveSession(showId, sessionId);
        setStatus("joined");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [showId, ended]);

  return (
    <main className={styles.screen}>
      <p className={styles.name}>{name}</p>
      <p className={styles.status}>
        {status === "joining" && "Connessione…"}
        {status === "joined" && "Sei connesso"}
        {status === "ended" && "Lo spettacolo è concluso. Grazie!"}
        {status === "error" && "Connessione non riuscita. Ricarica la pagina."}
      </p>
    </main>
  );
}
