export type ClockSync = {
  /** add to Date.now() to get the server time */
  offset: number;
  /** estimated uncertainty in ms (half of the best round trip) */
  uncertainty: number;
};

/**
 * Estimates the offset between the device clock and the server clock.
 * Sends a few pings and keeps the fastest one, which is the most reliable.
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
