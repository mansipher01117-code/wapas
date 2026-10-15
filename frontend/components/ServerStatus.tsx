"use client";

import { useEffect, useState } from "react";
import { API_BASE, BACKEND_WAKING } from "@/lib/api";

const RETRY_MS = 3000;
const GIVE_UP_MS = 90000;

/**
 * The free backend plan sleeps when idle and takes up to a minute to wake. Mounted once in
 * the layout: any page whose request stalls or fails gets this banner and the health retry.
 */
export function ServerStatus() {
  const [state, setState] = useState<"ok" | "waking" | "down">("ok");

  useEffect(() => {
    let timer: number | undefined;
    let startedAt = 0;

    async function check() {
      try {
        const res = await fetch(`${API_BASE}/api/health`, { cache: "no-store" });
        if (res.ok) {
          startedAt = 0;
          setState("ok");
          return;
        }
      } catch {
        /* still asleep */
      }
      if (Date.now() - startedAt >= GIVE_UP_MS) {
        startedAt = 0;
        setState("down");
        return;
      }
      timer = window.setTimeout(check, RETRY_MS);
    }

    function onTrouble() {
      if (startedAt) return; // already watching
      startedAt = Date.now();
      setState("waking");
      timer = window.setTimeout(check, RETRY_MS);
    }

    window.addEventListener(BACKEND_WAKING, onTrouble);
    return () => {
      window.removeEventListener(BACKEND_WAKING, onTrouble);
      window.clearTimeout(timer);
    };
  }, []);

  if (state === "ok") return null;

  return (
    <div className="toast" role="status" aria-live="polite" style={{ maxWidth: "min(92vw, 520px)", textAlign: "center", lineHeight: 1.35 }}>
      {state === "waking"
        ? "Waking up the server, this can take up to a minute on the free plan. Please wait."
        : "The server is not responding. Please refresh in a minute."}
    </div>
  );
}
