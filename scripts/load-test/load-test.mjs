#!/usr/bin/env node
/**
 * Load test: opens N fake audience phones on a show's audience page, taps the button at random
 * while the show is running, and serves a live dashboard on http://localhost:<port>.
 *
 *   npm run loadtest -- https://<your-app>/s/<show-id> [options]
 *
 * Start and stop the show from the control room as usual: the fake phones react on their own.
 * Run with --help for the options.
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const BUTTON = 'button[aria-label="I perceive life"]';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const HELP = `
Usage: npm run loadtest -- <audience-url> [options]

  <audience-url>       the link under the QR code, e.g. https://app.example.com/s/<show-id>

Options:
  --phones <n>         number of fake phones (default 60)
  --rate <seconds>     average seconds between two taps of the same phone (default 30)
  --peak-every <s>     every ~s seconds most phones tap together within 2 s; 0 = off (default 60)
  --offline <n>        phones that lose the network for 20–30 s during the show (default 0)
  --ramp <ms>          delay between two phones joining (default 500)
  --port <n>           dashboard port (default 4321)
  --chrome <path>      Chrome executable (default: Google Chrome on macOS, or $CHROME_PATH)
`;

function parseArgs(argv) {
  const opts = {
    phones: 60,
    rate: 30,
    peakEvery: 60,
    offline: 0,
    ramp: 500,
    port: 4321,
    chrome: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.log(HELP);
      process.exit(0);
    }
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const value = argv[++i];
    if (!(key in opts) || value === undefined) fail(`Unknown or incomplete option: ${arg}`);
    opts[key] = key === "chrome" ? value : Number(value);
    if (key !== "chrome" && !Number.isFinite(opts[key])) fail(`${arg} must be a number`);
  }
  if (positional.length !== 1) fail("Pass exactly one audience URL.");
  let url;
  try {
    url = new URL(positional[0]);
  } catch {
    fail(`Not a valid URL: ${positional[0]}`);
  }
  const match = url.pathname.match(/\/s\/([0-9a-f-]{36})\/?$/i);
  if (!match) fail("The URL must be an audience link ending in /s/<show-id> (the link under the QR code).");
  return { ...opts, audienceUrl: url.href, base: url.origin, showId: match[1] };
}

function fail(message) {
  console.error(`\n✖ ${message}\n${HELP}`);
  process.exit(1);
}

const opts = parseArgs(process.argv.slice(2));

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** phase: joining → waiting → running → finishing → done */
let phase = "joining";
let show = { startedAt: null, endedAt: null };
let report = null;
let browser = null;

const phones = Array.from({ length: opts.phones }, (_, i) => ({
  i,
  state: "idle", // idle | joining | waiting | active | ended | error
  offline: false,
  offlineUntil: null,
  plannedOffline: null,
  taps: 0,
  confirmed: 0, // taps the server answered with 2xx
  accepted: 0, // taps the server actually saved (inside the show window)
  networkFailures: 0,
  serverErrors: 0,
  rejected: 0,
  activeAt: null,
  nextTapAt: null,
  error: null,
  page: null,
  ctx: null,
}));

const latencies = []; // round trip of each POST /clicks, ms
const tapsPerSecond = []; // last 180 seconds
let tapsThisSecond = 0;
let nextPeakAt = null;

const sum = (f) => phones.reduce((n, p) => n + f(p), 0);
const pending = (p) => Math.max(0, p.taps - p.confirmed);

function stats() {
  return {
    joined: phones.filter((p) => ["waiting", "active", "ended"].includes(p.state)).length,
    active: phones.filter((p) => p.state === "active").length,
    offline: phones.filter((p) => p.offline).length,
    errors: phones.filter((p) => p.state === "error").length,
    taps: sum((p) => p.taps),
    confirmed: sum((p) => p.confirmed),
    pending: sum(pending),
    tapsPerSecond: tapsPerSecond.slice(-120),
    runningFor: show.startedAt ? (show.endedAt ?? Date.now()) - show.startedAt : null,
  };
}

const phoneView = (p) => ({
  i: p.i,
  state: p.state,
  offline: p.offline,
  taps: p.taps,
  pending: pending(p),
  error: p.error,
});

// ---------------------------------------------------------------------------
// Dashboard server (Server-Sent Events)
// ---------------------------------------------------------------------------

const clients = new Set();

function broadcast(type, data) {
  const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(message);
}

const updatePhone = (p) => broadcast("phone", phoneView(p));

function setPhase(next) {
  if (phase === next) return;
  phase = next;
  broadcast("phase", { phase });
  console.log(`→ ${next}`);
}

const FONTS = { "Pano-Bold.woff2": "app/fonts/Pano-Bold.woff2", "Colroy.woff2": "app/fonts/Colroy.woff2" };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(await readFile(path.join(HERE, "dashboard.html")));
    } else if (req.method === "GET" && url.pathname === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
      });
      res.write(
        `event: snapshot\ndata: ${JSON.stringify({
          config: { phones: opts.phones, audienceUrl: opts.audienceUrl, rate: opts.rate, peakEvery: opts.peakEvery },
          phase,
          phones: phones.map(phoneView),
          stats: stats(),
          report,
        })}\n\n`,
      );
      clients.add(res);
      req.on("close", () => clients.delete(res));
    } else if (req.method === "GET" && url.pathname.startsWith("/fonts/") && FONTS[url.pathname.slice(7)]) {
      res.writeHead(200, { "Content-Type": "font/woff2", "Cache-Control": "max-age=3600" });
      res.end(await readFile(path.join(ROOT, FONTS[url.pathname.slice(7)])));
    } else if (req.method === "POST" && url.pathname === "/api/burst") {
      burst();
      res.writeHead(204).end();
    } else if (req.method === "POST" && /^\/api\/offline\/\d+$/.test(url.pathname)) {
      const p = phones[Number(url.pathname.split("/").pop())];
      if (p && phase !== "done") {
        p.plannedOffline = null;
        await setOffline(p, !p.offline, null);
      }
      res.writeHead(204).end();
    } else {
      res.writeHead(404).end("Not found");
    }
  } catch (err) {
    res.writeHead(500).end(String(err));
  }
});

// ---------------------------------------------------------------------------
// Fake phones
// ---------------------------------------------------------------------------

/** Runs inside every phone page: reports button/status changes back to the script. */
const OBSERVER = (selector) => {
  const send = () => {
    const button = document.querySelector(selector);
    if (!button) return;
    const state = { disabled: button.disabled, status: document.querySelector('[role="status"]')?.textContent ?? "" };
    const key = JSON.stringify(state);
    if (key === window.__ltLast) return;
    window.__ltLast = key;
    window.__ltReport(state);
  };
  new MutationObserver(send).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  document.addEventListener("DOMContentLoaded", send);
};

const isClicksPost = (req) => req.method() === "POST" && req.url().includes(`/api/shows/${opts.showId}/clicks`);

function batchSize(req) {
  try {
    return JSON.parse(req.postData() ?? "{}").clicks?.length ?? 0;
  } catch {
    return 0;
  }
}

function onPhoneState(p, { disabled, status }) {
  let state;
  if (/ended/i.test(status)) state = "ended";
  else if (/failed/i.test(status)) state = "error";
  else if (!disabled) state = "active";
  else if (/connecting/i.test(status)) state = "joining";
  else state = "waiting";

  if (state === "error") p.error = status;
  if (state === "active" && p.state !== "active") {
    p.activeAt = Date.now();
    scheduleNextTap(p);
  }
  p.state = state;
  updatePhone(p);
}

async function launchPhone(p) {
  p.state = "joining";
  updatePhone(p);
  try {
    p.ctx = await browser.createBrowserContext(); // own storage = a different person
    const page = (p.page = await p.ctx.newPage());
    await page.setViewport({ width: 360, height: 640 });
    await page.exposeFunction("__ltReport", (s) => onPhoneState(p, s));
    await page.evaluateOnNewDocument(OBSERVER, BUTTON);

    const sentAt = new WeakMap();
    page.on("request", (req) => isClicksPost(req) && sentAt.set(req, Date.now()));
    page.on("response", async (res) => {
      const req = res.request();
      if (!isClicksPost(req)) return;
      const n = batchSize(req);
      if (res.ok()) {
        p.confirmed += n;
        latencies.push(Date.now() - (sentAt.get(req) ?? Date.now()));
        try {
          p.accepted += (await res.json()).accepted ?? 0;
        } catch {}
      } else if (res.status() >= 500) {
        p.serverErrors++;
      } else {
        p.rejected += n;
        p.confirmed += n; // the page drops 4xx batches: they will never be retried
      }
      updatePhone(p);
    });
    page.on("requestfailed", (req) => {
      if (isClicksPost(req)) p.networkFailures++;
    });
    page.on("pageerror", (err) => console.warn(`phone #${p.i + 1}: ${err.message}`));

    await page.goto(opts.audienceUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  } catch (err) {
    p.state = "error";
    p.error = String(err?.message ?? err);
    updatePhone(p);
  }
}

async function setOffline(p, offline, until) {
  if (!p.page) return;
  try {
    await p.page.setOfflineMode(offline);
  } catch {
    return;
  }
  p.offline = offline;
  p.offlineUntil = offline ? until : null;
  updatePhone(p);
}

async function tap(p) {
  if (p.state !== "active" || !p.page) return;
  const ok = await p.page
    .evaluate((selector) => {
      const button = document.querySelector(selector);
      if (!button || button.disabled) return false;
      button.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true }),
      );
      return true;
    }, BUTTON)
    .catch(() => false);
  if (!ok) return;
  p.taps++;
  tapsThisSecond++;
  broadcast("tap", { i: p.i });
  updatePhone(p);
}

/** Next scattered tap: exponential wait around --rate seconds. */
function scheduleNextTap(p) {
  p.nextTapAt = Date.now() - Math.log(1 - Math.random()) * opts.rate * 1000;
}

/** Most active phones tap 1–3 times within ~2 seconds. */
function burst() {
  if (phase !== "running") return;
  broadcast("burst", {});
  for (const p of phones) {
    if (p.state !== "active" || Math.random() > 0.85) continue;
    const n = 1 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) setTimeout(() => tap(p), Math.random() * 2000 + k * 300);
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function pollShow() {
  try {
    const res = await fetch(`${opts.base}/api/shows/${opts.showId}/status`, { cache: "no-store" });
    if (res.ok) show = await res.json();
  } catch {}
}

function onRunningStarted() {
  setPhase("running");
  nextPeakAt = opts.peakEvery > 0 ? Date.now() + opts.peakEvery * 1000 * (0.7 + Math.random() * 0.6) : null;
  // pick the phones that will lose the network once, 10–120 s into the show
  const candidates = [...phones].sort(() => Math.random() - 0.5).slice(0, opts.offline);
  for (const p of candidates) {
    p.plannedOffline = { at: Date.now() + 10_000 + Math.random() * 110_000, duration: 20_000 + Math.random() * 10_000 };
  }
}

function tick() {
  const now = Date.now();
  if (phase === "running") {
    for (const p of phones) {
      if (p.state === "active" && p.nextTapAt !== null && now >= p.nextTapAt) {
        tap(p);
        scheduleNextTap(p);
      }
      if (p.plannedOffline && !p.offline && now >= p.plannedOffline.at) {
        setOffline(p, true, now + p.plannedOffline.duration);
        p.plannedOffline = null;
      }
      if (p.offline && p.offlineUntil && now >= p.offlineUntil) setOffline(p, false, null);
    }
    if (nextPeakAt && now >= nextPeakAt) {
      burst();
      nextPeakAt = now + opts.peakEvery * 1000 * (0.7 + Math.random() * 0.6);
    }
  }
}

async function finish() {
  setPhase("finishing");
  // bring everyone back online so queued taps get delivered and the end is noticed
  await Promise.all(phones.filter((p) => p.offline).map((p) => setOffline(p, false, null)));
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const settled = phones.every((p) => ["ended", "error", "idle"].includes(p.state) && pending(p) === 0);
    if (settled) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  report = await buildReport();
  broadcast("report", report);
  setPhase("done");
  printReport(report);
  await browser?.close().catch(() => {});
  browser = null;
  console.log(`\nDashboard still available at http://localhost:${opts.port} – press Ctrl+C to exit.`);
}

async function fetchServerCounts() {
  const result = { clicks: null, people: null };
  try {
    const res = await fetch(`${opts.base}/api/shows/${opts.showId}/audience`, { cache: "no-store" });
    if (res.ok) result.people = (await res.json()).count;
  } catch {}
  try {
    // the report page shows "<n> clicks · <m> people joined"
    const res = await fetch(`${opts.base}/shows/${opts.showId}`, { cache: "no-store" });
    const html = (await res.text()).replace(/<!-- -->/g, "");
    const m = html.match(/(\d+) clicks · (\d+) people joined/);
    if (m) result.clicks = Number(m[1]);
  } catch {}
  return result;
}

const pct = (values, q) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};
const avg = (values) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null);

async function buildReport() {
  const server = await fetchServerCounts();
  const s = stats();
  const joined = phones.filter((p) => p.activeAt !== null || ["waiting", "ended"].includes(p.state)).length;
  const accepted = sum((p) => p.accepted);
  const activation = phones
    .filter((p) => p.activeAt !== null && show.startedAt !== null)
    .map((p) => p.activeAt - show.startedAt);

  const checks = [
    { label: "All phones joined", ok: joined === opts.phones, detail: `${joined} / ${opts.phones}` },
    {
      label: "People counted by the server",
      ok: server.people === null ? null : server.people >= joined,
      detail: server.people === null ? "not available" : `${server.people} (fake phones: ${joined})`,
    },
    { label: "Every tap confirmed by the server", ok: s.pending === 0, detail: `${s.confirmed} / ${s.taps}` },
    {
      label: "Clicks saved in the database",
      ok: server.clicks === null ? null : server.clicks >= accepted,
      detail:
        server.clicks === null
          ? "not available (report page not readable)"
          : `${server.clicks} in the DB · ${accepted} accepted for the fake phones`,
    },
    { label: "No server errors (5xx)", ok: sum((p) => p.serverErrors) === 0, detail: String(sum((p) => p.serverErrors)) },
  ];

  return {
    checks,
    numbers: [
      ["Fake phones", opts.phones],
      ["Taps made", s.taps],
      ["Taps confirmed (2xx)", s.confirmed],
      ["Taps accepted (inside the show)", accepted],
      ["Taps rejected (4xx)", sum((p) => p.rejected)],
      ["Failed requests (network/offline, retried)", sum((p) => p.networkFailures)],
      ["Click request round trip – avg / p95 / max", `${avg(latencies) ?? "–"} / ${pct(latencies, 0.95) ?? "–"} / ${latencies.length ? Math.max(...latencies) : "–"} ms`],
      ["Button enabled after start – min / avg / max", activation.length ? `${Math.min(...activation)} / ${avg(activation)} / ${Math.max(...activation)} ms` : "–"],
      ["Show duration", show.startedAt && show.endedAt ? `${Math.round((show.endedAt - show.startedAt) / 1000)} s` : "–"],
    ],
    phonesWithErrors: phones.filter((p) => p.state === "error").map((p) => ({ i: p.i, error: p.error })),
  };
}

function printReport(r) {
  console.log("\n=== Load test report ===");
  for (const c of r.checks) console.log(`${c.ok === null ? "?" : c.ok ? "✓" : "✗"} ${c.label}: ${c.detail}`);
  for (const [label, value] of r.numbers) console.log(`  ${label}: ${value}`);
  for (const e of r.phonesWithErrors) console.log(`  phone #${e.i + 1}: ${e.error}`);
}

async function main() {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, resolve);
  });
  console.log(`Dashboard: http://localhost:${opts.port}`);
  console.log(`Show:      ${opts.audienceUrl}`);

  await pollShow();
  if (show.endedAt) fail("This show has already ended. Create a new show and pass its link.");

  browser = await puppeteer.launch({
    executablePath: opts.chrome,
    headless: true,
    protocolTimeout: 120_000,
    args: [
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--mute-audio",
    ],
  });

  // tick: taps, offline windows, peaks · every second: stats + show status
  setInterval(tick, 100);
  setInterval(async () => {
    tapsPerSecond.push(tapsThisSecond);
    tapsThisSecond = 0;
    if (tapsPerSecond.length > 180) tapsPerSecond.shift();
    broadcast("stats", stats());
  }, 1000);
  setInterval(async () => {
    if (phase === "finishing" || phase === "done") return;
    await pollShow();
    if (show.startedAt && phase !== "running" && Date.now() >= show.startedAt) onRunningStarted();
    if (show.endedAt && phase === "running") finish();
  }, 2000);

  // phones join one after another, like an audience coming in
  console.log(`Opening ${opts.phones} phones…`);
  await Promise.all(
    phones.map(
      (p) =>
        new Promise((resolve) =>
          setTimeout(() => launchPhone(p).then(resolve), p.i * opts.ramp),
        ),
    ),
  );
  if (phase === "joining") setPhase("waiting");
  console.log("All phones opened. Press Start in the control room.");
}

async function shutdown() {
  console.log("\nClosing…");
  await browser?.close().catch(() => {});
  server.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch(async (err) => {
  console.error(err);
  await browser?.close().catch(() => {});
  process.exit(1);
});
