import { networkInterfaces } from "node:os";
import { headers } from "next/headers";
import QRCode from "qrcode";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Primo indirizzo IPv4 del computer nella rete locale (es. 192.168.1.20), se c'è. */
function lanIp() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const a of addresses ?? []) {
      if (a.family === "IPv4" && !a.internal) return a.address;
    }
  }
  return null;
}

/**
 * URL pubblico della pagina del pubblico per uno show.
 * - Se c'è APP_URL (es. in produzione) usa quella.
 * - Altrimenti usa l'host con cui è stata aperta la regia; se è localhost,
 *   lo sostituisce con l'IP del computer in rete, così il QR funziona
 *   anche dai telefoni connessi allo stesso Wi-Fi.
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
