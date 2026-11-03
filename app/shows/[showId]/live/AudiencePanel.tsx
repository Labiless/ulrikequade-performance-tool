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

/** QR + link for the audience and number of people joined (refreshed every 3 s). */
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
        // no network: try again on the next round
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
      window.prompt("Copy the link:", url);
    }
  };

  return (
    <aside className={styles.aside}>
      <div className={styles.audience}>
        <span className={styles.audienceCount}>{count}</span>
        <span className={styles.label}>{count === 1 ? "person joined" : "people joined"}</span>
      </div>

      <a
        href={`/shows/${showId}/qr`}
        target="_blank"
        rel="noopener"
        className={styles.qr}
        title="Open the QR code full size"
        aria-label="Open the QR code full size in a new tab"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />

      <div className={styles.linkRow}>
        <input className={styles.linkInput} value={url} readOnly onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className={styles.ghost} onClick={copy}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </aside>
  );
}
