"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import styles from "./timeline.module.css";

/** t = timestamp del click (ms epoch), s = indice della persona che ha cliccato */
export type ClickPoint = { t: number; s: number };

type Props = { clicks: ClickPoint[]; audience: number };

type Bin = { start: number; count: number; people: number };

const BIN_OPTIONS = [1, 2, 5, 10, 30];
const TICK_STEPS = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
const PAD = { top: 16, right: 12, bottom: 24, left: 36 };

export default function ClickTimeline({ clicks, audience }: Props) {
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

  // Dimensioni del grafico (si adatta allo schermo)
  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Libera l'URL del video quando cambia file
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // Aggiorna la testina in modo fluido mentre il video scorre
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

  // Secondo 0 della timeline = primo click, spostato di offsetSec.
  // (Quando avremo il ciak, qui useremo l'istante del lampo salvato sullo show.)
  const firstClick = clicks[0]?.t ?? 0;
  const lastClick = clicks[clicks.length - 1]?.t ?? 0;
  const t0 = firstClick - offsetSec * 1000;
  const durationSec = videoDuration ?? Math.max(binSec, (lastClick - t0) / 1000 + binSec);

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

  // Geometria del grafico
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

  // Interazione: hover mostra i valori, click sposta il video in quel punto
  const secFromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - PAD.left;
    return Math.min(durationSec, Math.max(0, (px / plotW) * durationSec));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    setHoverBin(Math.min(bins.length - 1, Math.floor(secFromPointer(e) / binSec)));
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const sec = secFromPointer(e);
    if (videoRef.current) videoRef.current.currentTime = sec;
    setCurrentTime(sec);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  };

  const hovered = hoverBin !== null ? bins[hoverBin] : null;
  const tooltipLeft = hovered ? x(hovered.start + binSec / 2) : 0;

  return (
    <section className={styles.wrapper}>
      <div className={styles.controls}>
        <label className={styles.control}>
          Video della performance
          <input
            type="file"
            accept="video/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setVideoUrl(URL.createObjectURL(file));
              setCurrentTime(0);
            }}
          />
        </label>
        <label className={styles.control}>
          Intervallo
          <select value={binSec} onChange={(e) => setBinSec(Number(e.target.value))}>
            {BIN_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} s
              </option>
            ))}
          </select>
        </label>
        <label className={styles.control}>
          Primo click al secondo
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
            onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onSeeked={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onClick={togglePlay}
            playsInline
          />
        ) : (
          <div className={styles.placeholder}>Carica il video della performance per vederlo qui</div>
        )}

        {videoUrl && (
          <button type="button" className={styles.playButton} onClick={togglePlay}>
            {playing ? "❚❚ Pausa" : "▶ Play"} · {formatTime(currentTime)} / {formatTime(durationSec)}
          </button>
        )}

        <div
          ref={chartRef}
          className={styles.chart}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHoverBin(null)}
          onPointerDown={onPointerDown}
          role="img"
          aria-label={`Click nel tempo, raggruppati ogni ${binSec} secondi. Massimo ${maxCount} click in un intervallo.`}
        >
          {size.width > 0 && (
            <svg width={size.width} height={size.height} className={styles.svg}>
              {/* griglia orizzontale + etichette asse y */}
              {[0, yMax / 2, yMax].map((v) => (
                <g key={v}>
                  <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} className={styles.grid} />
                  <text x={PAD.left - 6} y={y(v)} className={styles.yLabel}>
                    {v}
                  </text>
                </g>
              ))}

              {/* asse x: tempo */}
              {ticks.map((s) => (
                <text key={s} x={x(s)} y={size.height - 6} className={styles.xLabel}>
                  {formatTime(s)}
                </text>
              ))}

              <path d={areaPath} className={styles.area} />
              <path d={linePath} className={styles.line} />

              {/* testina del video */}
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
              {hovered.count} click · {hovered.people} persone
              {audience > 0 && ` (${Math.round((hovered.people / audience) * 100)}%)`}
            </div>
          )}
        </div>
      </div>

      {outside > 0 && (
        <p className={styles.note}>
          {outside} click cadono fuori dalla durata del video e non sono mostrati.
        </p>
      )}

      <details className={styles.table}>
        <summary>Tabella dati</summary>
        <table>
          <thead>
            <tr>
              <th>Da</th>
              <th>A</th>
              <th>Click</th>
              <th>Persone</th>
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

/** Arrotonda il massimo dell'asse y a un numero "pulito" e pari (per avere la metà intera). */
function niceMax(v: number) {
  if (v <= 2) return 2;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) {
    const candidate = m * pow;
    if (candidate >= v && candidate % 2 === 0) return candidate;
  }
  return Math.ceil(v / 2) * 2;
}
