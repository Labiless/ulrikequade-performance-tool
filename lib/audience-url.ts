import { networkInterfaces } from "node:os";
import { headers } from "next/headers";
import QRCode from "qrcode";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/** First IPv4 address of this computer on the local network (e.g. 192.168.1.20), if any. */
function lanIp() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const a of addresses ?? []) {
      if (a.family === "IPv4" && !a.internal) return a.address;
    }
  }
  return null;
}

/**
 * Public URL of the audience page for a show.
 * - If APP_URL is set (e.g. in production), use it.
 * - Otherwise use the host the control room was opened with; if it's localhost,
 *   replace it with this computer's network IP, so the QR also works
 *   from phones on the same Wi-Fi.
 */
export async function audienceUrl(showId: string) {
  let base = process.env.APP_URL;
  if (!base) {
    const h = await headers();
    let host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";

    const [hostname, port] = host.startsWith("[")
      ? [host.slice(0, host.indexOf("]") + 1), host.slice(host.indexOf("]") + 2)]
      : host.split(":");
    const isLocal = LOCAL_HOSTNAMES.has(hostname);
    if (isLocal) {
      const ip = lanIp();
      if (ip) host = port ? `${ip}:${port}` : ip;
    }

    const plainHttp = isLocal || IPV4_RE.test(hostname) || hostname.endsWith(".local");
    const proto = h.get("x-forwarded-proto") ?? (plainHttp ? "http" : "https");
    base = `${proto}://${host}`;
  }
  return `${base.replace(/\/$/, "")}/s/${showId}`;
}

export function qrSvg(url: string) {
  return QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
}
