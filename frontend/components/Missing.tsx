"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, type SampleCase } from "@/lib/api";

/** Loads the sample case and opens its verdict. Used on the dashboard and on every dead end. */
export function LoadSampleButton({ className = "btn btn--primary" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function load() {
    setBusy(true);
    setFailed(false);
    try {
      const s = await api<SampleCase>("/api/demo/sample", { method: "POST" });
      router.push(`/compare/${s.comparison_id}`);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <>
      <button className={className} onClick={load} disabled={busy}>
        {busy ? "Loading sample…" : "Load sample inspection"}
      </button>
      {failed ? (
        <p className="error small" style={{ marginBottom: 0 }}>
          The sample didn&apos;t load. The server may still be waking up: try again in a few seconds.
        </p>
      ) : null}
    </>
  );
}

/**
 * Friendly dead end for a page with nothing to show: either the record is gone (the free
 * plan wipes its data on restart) or the server can't be reached right now.
 */
export function Missing({ gone, title, sample = true }: { gone: boolean; title?: string; sample?: boolean }) {
  return (
    <main className="wrap" style={{ paddingTop: 40 }}>
      <div className="sheet" style={{ maxWidth: 560 }}>
        <h3 style={{ marginBottom: 10 }}>{title ?? (gone ? "Not on the server any more" : "Can't reach the server")}</h3>
        <p className="small">
          {!gone
            ? "The free server may still be waking up. Give it a few seconds, then try again."
            : sample
              ? "This record is no longer on the server. Load the sample inspection to see a demo."
              : "This record is no longer on the server. The demo server clears its data when it restarts."}
        </p>
        <div className="row">
          {gone && sample ? <LoadSampleButton className="btn btn--primary btn--small" /> : null}
          {!gone ? (
            <button className="btn btn--primary btn--small" onClick={() => window.location.reload()}>
              Try again
            </button>
          ) : null}
          <Link href="/dashboard" className="btn btn--small">
            Back to my rooms
          </Link>
        </div>
      </div>
    </main>
  );
}
