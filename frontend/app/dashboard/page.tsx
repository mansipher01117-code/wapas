"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { api, inr, type Property, type SampleCase } from "@/lib/api";
import { caseProgress } from "@/lib/progress";

export default function Dashboard() {
  const router = useRouter();
  const [items, setItems] = useState<Property[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Property[]>("/api/properties")
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);

  async function loadSample() {
    setBusy(true);
    setError("");
    try {
      const s = await api<SampleCase>("/api/demo/sample", { method: "POST" });
      router.push(`/compare/${s.comparison_id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <Topbar />
      <main className="page">
        <div className="wrap">
          <div className="spread">
            <div>
              <h1 style={{ fontSize: "clamp(36px, 5vw, 56px)" }}>My rooms</h1>
              <p className="muted" style={{ marginTop: 10 }}>
                One folder per place you rent. Each holds the move-in record, the landlord&apos;s sign-off and the
                move-out verdict.
              </p>
            </div>
            <div className="row">
              {items?.length ? (
                <button className="linkbtn" onClick={loadSample} disabled={busy}>
                  {busy ? "Loading sample…" : "Load sample inspection"}
                </button>
              ) : null}
              <Link href="/property/new" className="btn btn--primary">
                Add a place
              </Link>
            </div>
          </div>

          {error ? <p className="error" style={{ marginTop: 24 }}>{error}</p> : null}
          {!items && !error ? <p className="loading">Opening your folders…</p> : null}

          {items && items.length === 0 ? (
            <div className="sheet" style={{ marginTop: 24, maxWidth: 620 }}>
              <h3 style={{ marginBottom: 10 }}>No folders yet</h3>
              <p className="small">
                Add the place you rent, or load a sample case to see how the move-out verdict and the evidence report
                read. Sample data is marked everywhere and never counts as evidence.
              </p>
              <button className="btn btn--primary btn--block" onClick={loadSample} disabled={busy}>
                {busy ? "Loading sample…" : "Load sample inspection"}
              </button>
            </div>
          ) : null}

          {items ? (
            <div className="folders">
              {items.map((p) => {
                const prog = caseProgress(p);
                return (
                  <Link key={p.id} href={`/property/${p.id}`} className="folder">
                    <span className="folder__tab">{p.city}</span>
                    <div className="folder__addr">{p.address}</div>
                    {p.is_sample ? <span className="badge">Sample data</span> : null}
                    <div className="row small" style={{ gap: 18 }}>
                      <span>
                        Deposit <b className="num">{inr(p.deposit)}</b>
                      </span>
                      <span>
                        Rent <b className="num">{inr(p.rent)}</b>
                      </span>
                    </div>
                    <div className="progress" aria-label={`${prog.stepsDone} of 4 steps done`}>
                      {prog.done.map((d, i) => (
                        <span key={i} className={`progress__seg ${d ? "progress__seg--done" : ""}`} />
                      ))}
                    </div>
                    <div className="progress__labels" aria-hidden="true">
                      <span>Move-in</span>
                      <span>Signed</span>
                      <span>Move-out</span>
                      <span>Verdict</span>
                    </div>
                    <p style={{ margin: "14px 0 0", fontWeight: 600 }}>{prog.next}</p>
                  </Link>
                );
              })}
              <Link href="/property/new" className="folder folder--new">
                <span className="folder__tab">New</span>
                <span>
                  Moving into a new place?
                  <br />
                  <u>Add it here</u>
                </span>
              </Link>
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
