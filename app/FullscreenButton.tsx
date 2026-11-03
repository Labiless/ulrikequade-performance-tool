"use client";

import { useSyncExternalStore } from "react";
import styles from "./fullscreen-button.module.css";

// Safari (iPad / older macOS) still uses the webkit-prefixed API.
type WebkitDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const doc = () => document as WebkitDocument;
const isSupported = () => Boolean(doc().fullscreenEnabled ?? doc().webkitFullscreenEnabled);
const isFullscreen = () => Boolean(doc().fullscreenElement ?? doc().webkitFullscreenElement);

function subscribe(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  document.addEventListener("webkitfullscreenchange", onChange);
  return () => {
    document.removeEventListener("fullscreenchange", onChange);
    document.removeEventListener("webkitfullscreenchange", onChange);
  };
}

/**
 * Small button in the bottom-right corner of every page that toggles full screen.
 * Hidden where the browser doesn't allow it (e.g. Safari on iPhone).
 */
export default function FullscreenButton() {
  const supported = useSyncExternalStore(subscribe, isSupported, () => false);
  const active = useSyncExternalStore(subscribe, isFullscreen, () => false);

  if (!supported) return null;

  const toggle = async () => {
    try {
      if (isFullscreen()) {
        await (document.exitFullscreen?.() ?? doc().webkitExitFullscreen?.());
      } else {
        const root = document.documentElement as WebkitElement;
        await (root.requestFullscreen?.() ?? root.webkitRequestFullscreen?.());
      }
    } catch {
      // the browser refused (e.g. not triggered by a user gesture): nothing to do
    }
  };

  const label = active ? "Exit full screen" : "Full screen";

  return (
    <button type="button" className={styles.button} onClick={toggle} title={label} aria-label={label}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        {active ? (
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        ) : (
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        )}
      </svg>
    </button>
  );
}
