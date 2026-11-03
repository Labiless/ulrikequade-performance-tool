"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import styles from "./timeline.module.css";
import VideoSync from "./VideoSync";

/** t = click timestamp (ms epoch), s = index of the person who clicked */
export type ClickPoint = { t: number; s: number };

type Props = {
  showId: string;
  clicks: ClickPoint[];
  audience: number;
  /** show start/end (server time, ms). null if the show was not started from the control room */
  startedAt: number | null;
  endedAt: number | null;
};

type Bin = { start: number; count: number; people: number };

const BIN_OPTIONS = [1, 2, 5, 10, 30];
const TICK_STEPS = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
const PAD = { top: 16, right: 12, bottom: 24, left: 36 };

export default function ClickTimeline({ showId, clicks, audience, startedAt, endedAt }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [binSec, setBinSec] = useState(2);
  const [offsetSec, setOffsetSec] = useState(0);
  const [hoverBin, setHoverBin] = useState<number | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Sync mode: look for the show-start flash in the video
  const [syncing, setSyncing] = useState(false);
  const [videoKey, setVideoKey] = useState<string | null>(null);
  const pendingSeek = useRef<number | null>(null);
  const savedOffset = useRef<number | null>(null);
  // true if this video has already been synced (a new search can be cancelled)
  const [hasSync, setHasSync] = useState(false);

  // Chart size (adapts to the screen)
  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Release the video URL when the file changes
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // Move the playhead smoothly while the video plays
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // Seek the video; if it's still seeking the previous frame, queue the latest request
  const seekTo = useCallback((sec: number) => {
    const v = videoRef.current;
    if (!v) return;
    const t = Math.min(Math.max(0, sec), v.duration || 0);
    setCurrentTime(t);
    if (v.seeking) pendingSeek.current = t;
    else v.currentTime = t;
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }, []);

  const syncStorageKey = videoKey ? `videoSync:${showId}:${videoKey}` : null;

  const onVideoFile = (file: File) => {
    const key = `${file.name}:${file.size}`;
    let saved: number | null = null;
    try {
      const raw = localStorage.getItem(`videoSync:${showId}:${key}`);
      if (raw !== null && Number.isFinite(Number(raw))) saved = Number(raw);
    } catch {}
    savedOffset.current = saved;
    setVideoKey(key);
    setVideoUrl(URL.createObjectURL(file));
    setVideoDuration(null);
    setCurrentTime(0);
    if (saved !== null) setOffsetSec(saved);
    // Video already synced on this computer before: skip the flash search
    setHasSync(saved !== null);
    setSyncing(saved === null);
  };

  const confirmSync = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    const t = Math.round(v.currentTime * 1000) / 1000;
    setOffsetSec(t);
    setHasSync(true);
    setSyncing(false);
    if (syncStorageKey) {
      try {
        localStorage.setItem(syncStorageKey, String(t));
      } catch {}
    }
  }, [syncStorageKey]);

  // Reference = show start (the white flash from the control room), or the first click
  // if the show was not started from the control room. offsetSec = the video second at which
  // the reference happens: second 0 of the timeline matches second 0 of the video.
  const reference = startedAt ?? clicks[0]?.t ?? 0;
  const end = endedAt ?? clicks[clicks.length - 1]?.t ?? reference;
  const t0 = reference - offsetSec * 1000;
  const durationSec = videoDuration ?? Math.max(binSec, (end - t0) / 1000 + binSec);

  const { bins, maxCount, outside } = useMemo(() => {
    const binMs = binSec * 1000;
    const n = Math.max(1, Math.ceil(durationSec / binSec));
    const counts = new Array<number>(n).fill(0);
    const people = Array.from({ length: n }, () => new Set<number>());
    let outside = 0;
    for (const c of clicks) {
      const i = Math.floor((c.t - t0) / binMs);
      if (i < 0 || i >= n) {
        outside++;
        continue;
      }
      counts[i]++;
      people[i].add(c.s);
    }
    const bins: Bin[] = counts.map((count, i) => ({
      start: i * binSec,
      count,
      people: people[i].size,
    }));
    return { bins, maxCount: Math.max(1, ...counts), outside };
  }, [clicks, t0, binSec, durationSec]);

  // Chart geometry
  const plotW = Math.max(0, size.width - PAD.left - PAD.right);
  const plotH = Math.max(0, size.height - PAD.top - PAD.bottom);
  const yMax = niceMax(maxCount);
  const x = (sec: number) => PAD.left + (sec / durationSec) * plotW;
  const y = (count: number) => PAD.top + plotH - (count / yMax) * plotH;

  const linePath = useMemo(() => {
    if (plotW <= 0) return "";
    return bins
      .map((b, i) => `${i === 0 ? "M" : "L"}${x(b.start + binSec / 2).toFixed(1)},${y(b.count).toFixed(1)}`)
      .join("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bins, plotW, plotH, yMax, durationSec, binSec]);

  const areaPath =
    linePath && bins.length
      ? `${linePath}L${x(bins[bins.length - 1].start + binSec / 2).toFixed(1)},${y(0)}L${x(binSec / 2).toFixed(1)},${y(0)}Z`
      : "";

  const tickStep = TICK_STEPS.find((s) => (s / durationSec) * plotW >= 70) ?? 3600;
  const ticks: number[] = [];
  for (let s = 0; s <= durationSec; s += tickStep) ticks.push(s);

  // Interaction: hover shows the values, click seeks the video to that point
  const secFromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - PAD.left;
    return Math.min(durationSec, Math.max(0, (px / plotW) * durationSec));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    setHoverBin(Math.min(bins.length - 1, Math.floor(secFromPointer(e) / binSec)));
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    seekTo(secFromPointer(e));
  };

  const hovered = hoverBin !== null ? bins[hoverBin] : null;
  const tooltipLeft = hovered ? x(hovered.start + binSec / 2) : 0;

  return (
    <section className={styles.wrapper}>
      <div className={styles.controls}>
        <label className={styles.control}>
          Performance video
          <input
            type="file"
            accept="video/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onVideoFile(file);
            }}
          />
        </label>
        {videoUrl && !syncing && (
          <button type="button" className={styles.secondaryButton} onClick={() => setSyncing(true)}>
            Re-sync video
          </button>
        )}
        <label className={styles.control}>
          Interval
          <select value={binSec} onChange={(e) => setBinSec(Number(e.target.value))}>
            {BIN_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} s
              </option>
            ))}
          </select>
        </label>
        <label className={styles.control}>
          {startedAt !== null ? "Show start at video second" : "First click at video second"}
          <input
            type="number"
            step={0.04}
            value={offsetSec}
            onChange={(e) => setOffsetSec(Number(e.target.value) || 0)}
          />
        </label>
      </div>

      <div className={styles.stage}>
        {videoUrl ? (
          <video
            ref={videoRef}
            className={styles.video}
            src={videoUrl}
            onLoadedMetadata={(e) => {
              setVideoDuration(e.currentTarget.duration);
              // Video already synced: start from the beginning of the show
              if (savedOffset.current !== null) seekTo(savedOffset.current);
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onSeeked={(e) => {
              if (pendingSeek.current !== null) {
                e.currentTarget.currentTime = pendingSeek.current;
                pendingSeek.current = null;
              } else if (!syncing) {
                setCurrentTime(e.currentTarget.currentTime);
              }
            }}
            onClick={togglePlay}
            playsInline
          />
        ) : (
          <div className={styles.placeholder}>Load the performance video to watch it here</div>
        )}

        {videoUrl && syncing && (
          <VideoSync
            currentTime={currentTime}
            duration={videoDuration ?? 0}
            playing={playing}
            onSeek={seekTo}
            onTogglePlay={togglePlay}
            onConfirm={confirmSync}
            onCancel={hasSync ? () => setSyncing(false) : undefined}
          />
        )}

        {videoUrl && !syncing && (
          <button type="button" className={styles.playButton} onClick={togglePlay}>
            {playing ? "❚❚ Pause" : "▶ Play"} · {formatTime(currentTime)} / {formatTime(durationSec)}
          </button>
        )}

        <div
          ref={chartRef}
          className={`${styles.chart} ${syncing ? styles.hidden : ""}`}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHoverBin(null)}
          onPointerDown={onPointerDown}
          role="img"
          aria-label={`Clicks over time, grouped every ${binSec} seconds. At most ${maxCount} clicks in one interval.`}
        >
          {size.width > 0 && (
            <svg width={size.width} height={size.height} className={styles.svg}>
              {/* horizontal grid + y-axis labels */}
              {[0, yMax / 2, yMax].map((v) => (
                <g key={v}>
                  <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} className={styles.grid} />
                  <text x={PAD.left - 6} y={y(v)} className={styles.yLabel}>
                    {v}
                  </text>
                </g>
              ))}

              {/* x axis: time */}
              {ticks.map((s) => (
                <text key={s} x={x(s)} y={size.height - 6} className={styles.xLabel}>
                  {formatTime(s)}
                </text>
              ))}

              <path d={areaPath} className={styles.area} />
              <path d={linePath} className={styles.line} />

              {/* video playhead */}
              {videoUrl && (
                <line
                  x1={x(currentTime)}
                  x2={x(currentTime)}
                  y1={PAD.top}
                  y2={PAD.top + plotH}
                  className={styles.playhead}
                />
              )}

              {/* crosshair */}
              {hovered && (
                <>
                  <line
                    x1={tooltipLeft}
                    x2={tooltipLeft}
                    y1={PAD.top}
                    y2={PAD.top + plotH}
                    className={styles.crosshair}
                  />
                  <circle cx={tooltipLeft} cy={y(hovered.count)} r={4} className={styles.dot} />
                </>
              )}
            </svg>
          )}

          {hovered && (
            <div
              className={styles.tooltip}
              style={{
                left: Math.min(Math.max(tooltipLeft, 80), size.width - 80),
                top: Math.max(0, y(hovered.count) - 8),
              }}
            >
              <strong>
                {formatTime(hovered.start)}–{formatTime(hovered.start + binSec)}
              </strong>
              <br />
              {hovered.count} clicks · {hovered.people} people
              {audience > 0 && ` (${Math.round((hovered.people / audience) * 100)}%)`}
            </div>
          )}
        </div>
      </div>

      {outside > 0 && (
        <p className={styles.note}>
          {outside} clicks fall outside the video&apos;s duration and are not shown.
        </p>
      )}

      <details className={styles.table}>
        <summary>Data table</summary>
        <table>
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Clicks</th>
              <th>People</th>
            </tr>
          </thead>
          <tbody>
            {bins
              .filter((b) => b.count > 0)
              .map((b) => (
                <tr key={b.start}>
                  <td>{formatTime(b.start)}</td>
                  <td>{formatTime(b.start + binSec)}</td>
                  <td>{b.count}</td>
                  <td>{b.people}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function formatTime(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Rounds the y-axis maximum to a "clean" even number (so the midpoint is a whole number). */
function niceMax(v: number) {
  if (v <= 2) return 2;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) {
    const candidate = m * pow;
    if (candidate >= v && candidate % 2 === 0) return candidate;
  }
  return Math.ceil(v / 2) * 2;
}
