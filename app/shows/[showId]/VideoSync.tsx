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

// One frame at 30 fps (most phones); at 25 fps each step is slightly short of a frame
const FRAME_SEC = 1 / 30;
// Dragging on the video: how many seconds each pixel moves
const DRAG_SEC_PER_PX = 0.02;
const DRAG_FINE_SEC_PER_PX = 0.002; // while holding Shift or Alt

/**
 * "Find the flash" mode: scrub the video by dragging left/right
 * (or with the slider, buttons and keys) and confirm the show-start frame.
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

  // Keyboard: ←/→ one frame, with Shift one second, Enter confirms, Space play/pause
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
        title="Drag left or right to scrub the video"
      >
        <div className={styles.syncHint}>
          Drag left/right until you reach the <strong>white flash</strong> at the start of the show
          <br />
          <small>Shift = fine movement · ←/→ = one frame · Shift+←/→ = one second</small>
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
          aria-label="Position in the video"
        />
        <div className={styles.syncButtons}>
          <button type="button" onClick={onTogglePlay}>
            {playing ? "❚❚" : "▶"}
          </button>
          <button type="button" onClick={() => onSeek(currentTime - 1)} title="Back 1 second">
            −1 s
          </button>
          <button type="button" onClick={() => onSeek(currentTime - FRAME_SEC)} title="Previous frame">
            −1 fr
          </button>
          <span className={styles.syncTime}>{formatPrecise(currentTime)}</span>
          <button type="button" onClick={() => onSeek(currentTime + FRAME_SEC)} title="Next frame">
            +1 fr
          </button>
          <button type="button" onClick={() => onSeek(currentTime + 1)} title="Forward 1 second">
            +1 s
          </button>
          <span className={styles.syncSpacer} />
          {onCancel && (
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="button" className={styles.confirmButton} onClick={onConfirm}>
            Confirm show start
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
