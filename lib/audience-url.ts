import { headers } from "next/headers";
import QRCode from "qrcode";

/**
 * URL pubblico della pagina del pubblico per uno show.
 * Usa APP_URL se impostata (es. in produzione), altrimenti l'host con cui
 * è stata aperta la regia: aprendo la regia da http://<ip-del-mac>:3000
 * anche il QR punterà a quell'indirizzo, raggiungibile dai telefoni in rete.
 */
export async function audienceUrl(showId: string) {
  let base = process.env.APP_URL;
  if (!base) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    base = `${proto}://${host}`;
  }
  return `${base.replace(/\/$/, "")}/s/${showId}`;
}

export function qrSvg(url: string) {
  return QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
}
