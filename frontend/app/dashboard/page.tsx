"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { api, inr, type Property } from "@/lib/api";
import { caseProgress } from "@/lib/progress";

export default function Dashboard() {
  const [items, setItems] = useState<Property[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Property[]>("/api/properties")
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);

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
            <Link href="/property/new" className="btn btn--primary">
              Add a place
            </Link>
          </div>

          {error ? <p className="error" style={{ marginTop: 24 }}>{error}</p> : null}
          {!items && !error ? <p className="loading">Opening your folders…</p> : null}

          {items ? (
            <div className="folders">
              {items.map((p) => {
                const prog = caseProgress(p);
                return (
                  <Link key={p.id} href={`/property/${p.id}`} className="folder">
                    <span className="folder__tab">{p.city}</span>
                    <div className="folder__addr">{p.address}</div>
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
