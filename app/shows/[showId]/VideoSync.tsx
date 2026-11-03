"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import styles from "./timeline.module.css";

type Props = {
  currentTime: number;
  duration: number;
  playing: boolean;
  onSeek: (sec: number) => void;
  onTogglePlay: () => void;
  onConfirm: () => void;
  onCancel?: () => void;
};

// Un fotogramma a 30 fps (la maggior parte dei telefoni); a 25 fps si salta poco più
const FRAME_SEC = 1 / 30;
// Trascinando sul video: quanti secondi si spostano per ogni pixel
const DRAG_SEC_PER_PX = 0.02;
const DRAG_FINE_SEC_PER_PX = 0.002; // tenendo premuto Shift o Alt

/**
 * Modalità "trova il lampo": si scorre il video trascinando a destra/sinistra
 * (o con slider, frecce e tasti) e si conferma il fotogramma di inizio show.
 */
export default function VideoSync({
  currentTime,
  duration,
  playing,
  onSeek,
  onTogglePlay,
  onConfirm,
  onCancel,
}: Props) {
  const drag = useRef<{ x: number; time: number } | null>(null);

  // Tastiera: ←/→ un fotogramma, con Shift un secondo, Invio conferma, Spazio play/pausa
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== "range") return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 1 : FRAME_SEC;
        onSeek(currentTime + (e.key === "ArrowRight" ? step : -step));
      } else if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      } else if (e.key === " ") {
        e.preventDefault();
        onTogglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentTime, onSeek, onConfirm, onTogglePlay]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, time: currentTime };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const perPx = e.shiftKey || e.altKey ? DRAG_FINE_SEC_PER_PX : DRAG_SEC_PER_PX;
    onSeek(drag.current.time + (e.clientX - drag.current.x) * perPx);
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <>
      <div
        className={styles.dragLayer}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        title="Trascina a destra o sinistra per scorrere il video"
      >
        <div className={styles.syncHint}>
          Trascina a destra/sinistra fino al <strong>lampo bianco</strong> di inizio show
          <br />
          <small>Shift = movimento fine · ←/→ = un fotogramma · Shift+←/→ = un secondo</small>
        </div>
      </div>

      <div className={styles.syncBar}>
        <input
          type="range"
          className={styles.syncSlider}
          min={0}
          max={duration || 0}
          step={0.001}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Posizione nel video"
        />
        <div className={styles.syncButtons}>
          <button type="button" onClick={onTogglePlay}>
            {playing ? "❚❚" : "▶"}
          </button>
          <button type="button" onClick={() => onSeek(currentTime - 1)} title="Indietro di 1 secondo">
            −1 s
          </button>
          <button type="button" onClick={() => onSeek(currentTime - FRAME_SEC)} title="Fotogramma precedente">
            −1 fr
          </button>
          <span className={styles.syncTime}>{formatPrecise(currentTime)}</span>
          <button type="button" onClick={() => onSeek(currentTime + FRAME_SEC)} title="Fotogramma successivo">
            +1 fr
          </button>
          <button type="button" onClick={() => onSeek(currentTime + 1)} title="Avanti di 1 secondo">
            +1 s
          </button>
          <span className={styles.syncSpacer} />
          {onCancel && (
            <button type="button" onClick={onCancel}>
              Annulla
            </button>
          )}
          <button type="button" className={styles.confirmButton} onClick={onConfirm}>
            Conferma inizio show
          </button>
        </div>
      </div>
    </>
  );
}

function formatPrecise(totalSec: number) {
  const s = Math.max(0, totalSec);
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3).padStart(6, "0");
  return `${m}:${sec}`;
}
