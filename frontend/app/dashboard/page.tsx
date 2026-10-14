"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LoadSampleButton } from "@/components/Missing";
import { Topbar } from "@/components/Topbar";
import { api, inr, type Property } from "@/lib/api";
import { caseProgress } from "@/lib/progress";

export default function Dashboard() {
  const [items, setItems] = useState<Property[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    api<Property[]>("/api/properties")
      .then(setItems)
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

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
              {items?.length ? <LoadSampleButton className="linkbtn" /> : null}
              <Link href="/property/new" className="btn btn--primary">
                Add a place
              </Link>
            </div>
          </div>

          <p className="small muted" style={{ marginTop: 6 }}>
            Demo version: data may reset when the server restarts.
          </p>

          {!items && !failed ? <p className="loading">Opening your folders…</p> : null}

          {failed ? (
            <div className="sheet" style={{ marginTop: 24, maxWidth: 620 }}>
              <h3 style={{ marginBottom: 10 }}>Can&apos;t reach the server</h3>
              <p className="small">
                Your folders live on the server, and the free plan takes up to a minute to wake up. Give it a few
                seconds, then try again.
              </p>
              <div className="row">
                <button className="btn btn--primary btn--small" onClick={load}>
                  Try again
                </button>
                <LoadSampleButton className="btn btn--small" />
              </div>
            </div>
          ) : null}

          {items && items.length === 0 ? (
            <div className="sheet" style={{ marginTop: 24, maxWidth: 620 }}>
              <h3 style={{ marginBottom: 10 }}>No folders yet</h3>
              <p className="small">
                Add the place you rent, or load a sample case to see how the move-out verdict and the evidence report
                read. Sample data is marked everywhere and never counts as evidence.
              </p>
              <LoadSampleButton className="btn btn--primary btn--block" />
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
