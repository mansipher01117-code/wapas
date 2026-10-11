"use client";

import { useRef, useState } from "react";
import { Stamp } from "@/components/Stamp";
import { Topbar } from "@/components/Topbar";
import { api, fmtDate, uploadFile, type VerifyResult } from "@/lib/api";

export default function VerifyPage() {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function checkFile(f: File) {
    setError("");
    setResult(null);
    setBusy(0);
    const form = new FormData();
    form.append("file", f);
    try {
      setResult(await uploadFile<VerifyResult>("/api/verify", form, setBusy));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function checkHash(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      setResult(await api<VerifyResult>(`/api/verify/${hash.trim().toLowerCase()}`));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <Topbar />
      <main className="page">
        <div className="wrap wrap--narrow">
          <h1 style={{ fontSize: "clamp(34px, 5vw, 56px)" }}>Check a video hasn&apos;t been edited</h1>
          <p className="lede muted" style={{ marginTop: 12 }}>
            Wapas fingerprints every room video the moment it&apos;s uploaded. Drop the original file here. If even one
            frame changed, the fingerprint won&apos;t match.
          </p>

          <div
            className={`drop ${over ? "drop--over" : ""}`}
            style={{ marginTop: 28 }}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) checkFile(f);
            }}
          >
            {busy !== null ? (
              <>
                <h3>Checking fingerprint</h3>
                <div className="bar">
                  <div className="bar__fill" style={{ width: `${busy}%` }} />
                </div>
              </>
            ) : (
              <>
                <h3>Drop the room video</h3>
                <button className="btn btn--primary" onClick={() => fileRef.current?.click()}>
                  Choose a video
                </button>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) checkFile(f);
                e.target.value = "";
              }}
            />
          </div>

          <form className="row" style={{ marginTop: 18 }} onSubmit={checkHash}>
            <input
              className="input"
              style={{ flex: "1 1 320px" }}
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              placeholder="Or paste a SHA-256 fingerprint from a report"
              aria-label="SHA-256 fingerprint"
              pattern="[0-9a-fA-F]{64}"
              title="64 characters, 0-9 and a-f"
              required
            />
            <button className="btn">Check fingerprint</button>
          </form>

          {error ? <p className="error" style={{ marginTop: 20 }}>{error}</p> : null}

          {result ? (
            <div className="sheet" style={{ marginTop: 32 }}>
              <div className="spread" style={{ alignItems: "center" }}>
                <div style={{ maxWidth: 440 }}>
                  {result.match ? (
                    <>
                      <h2 style={{ fontSize: 28 }}>This is the original video</h2>
                      <p style={{ marginTop: 12 }}>
                        {result.room}, {result.inspection_type === "move_in" ? "move-in" : "move-out"} record for{" "}
                        {result.address}, {result.city}. Uploaded {fmtDate(result.uploaded_at, true)}.
                      </p>
                      <p style={{ marginBottom: 0 }}>
                        {result.lock_type === "mutual" && result.signoff
                          ? `Signed by ${result.signoff.signer_name} on ${fmtDate(result.locked_at, true)}.`
                          : result.lock_type === "tenant_only"
                            ? `Locked by the tenant on ${fmtDate(result.locked_at, true)}.`
                            : "Not signed by the landlord yet."}
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 style={{ fontSize: 28 }}>No record matches this video</h2>
                      <p style={{ marginTop: 12, marginBottom: 0 }}>
                        Either it was edited, re-encoded (for example, sent over WhatsApp), or it was never uploaded to
                        Wapas. Ask for the original file from the phone that recorded it.
                      </p>
                    </>
                  )}
                </div>
                <Stamp
                  main={result.match ? "Match" : "No match"}
                  sub={result.match ? "untampered" : "not on record"}
                  tone={result.match ? "safe" : "liable"}
                  rotate={-9}
                  size="lg"
                  slam
                />
              </div>
              <p className="small muted" style={{ marginTop: 18, marginBottom: 0 }}>
                Fingerprint <span className="hash">{result.sha256}</span>
              </p>
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
