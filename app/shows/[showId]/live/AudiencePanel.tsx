"use client";

import { useEffect, useState } from "react";
import styles from "./live.module.css";

type Props = {
  showId: string;
  url: string;
  qrSvg: string;
  initialCount: number;
};

const POLL_MS = 3000;

/** QR + link per il pubblico e numero di persone connesse (aggiornato ogni 3 s). */
export default function AudiencePanel({ showId, url, qrSvg, initialCount }: Props) {
  const [count, setCount] = useState(initialCount);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/shows/${showId}/audience`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { count: number };
        if (!cancelled) setCount(data.count);
      } catch {
        // rete assente: riproviamo al giro successivo
      }
    };
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [showId]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copia il link:", url);
    }
  };

  return (
    <aside className={styles.aside}>
      <div className={styles.audience}>
        <span className={styles.audienceCount}>{count}</span>
        <span className={styles.label}>{count === 1 ? "persona connessa" : "persone connesse"}</span>
      </div>

      <a
        href={`/shows/${showId}/qr`}
        target="_blank"
        rel="noopener"
        className={styles.qr}
        title="Apri il QR in grande"
        aria-label="Apri il QR code in grande in una nuova scheda"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />

      <div className={styles.linkRow}>
        <input className={styles.linkInput} value={url} readOnly onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className={styles.ghost} onClick={copy}>
          {copied ? "Copiato ✓" : "Copia"}
        </button>
      </div>
    </aside>
  );
}
