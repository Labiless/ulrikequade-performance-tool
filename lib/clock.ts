export type ClockSync = {
  /** da sommare a Date.now() per ottenere l'ora del server */
  offset: number;
  /** incertezza stimata in ms (metà del ping migliore) */
  uncertainty: number;
};

/**
 * Stima lo sfasamento tra l'orologio del dispositivo e quello del server.
 * Fa alcuni ping e tiene quello più veloce, che è il più affidabile.
 */
export async function syncClock(samples = 6): Promise<ClockSync> {
  let best: { rtt: number; offset: number } | null = null;
  for (let i = 0; i < samples; i++) {
    const sent = Date.now();
    const res = await fetch("/api/time", { cache: "no-store" });
    const { now } = (await res.json()) as { now: number };
    const received = Date.now();
    const rtt = received - sent;
    const offset = now + rtt / 2 - received;
    if (!best || rtt < best.rtt) best = { rtt, offset };
  }
  return { offset: best!.offset, uncertainty: best!.rtt / 2 };
}
