"use client";

import { useEffect } from "react";

/** Tiene lo schermo acceso finché `enabled` è true (dove il browser lo supporta). */
export function useWakeLock(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let lock: WakeLockSentinel | null = null;
    const request = () =>
      navigator.wakeLock
        ?.request("screen")
        .then((l) => (lock = l))
        .catch(() => {});
    request();
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [enabled]);
}
