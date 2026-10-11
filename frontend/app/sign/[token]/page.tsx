"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Brand } from "@/components/Topbar";
import { IssueTag } from "@/components/IssueTag";
import { Stamp } from "@/components/Stamp";
import { api, clock, fmtDate, inr, type Inspection, type Signoff } from "@/lib/api";

interface SignView {
  signoff: Signoff;
  inspection: Inspection;
  property: { tenant_name: string; address: string; city: string; rent: number; deposit: number; landlord_name: string };
}

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SignView | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [disputing, setDisputing] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [justSigned, setJustSigned] = useState(false);

  const load = useCallback(() => {
    api<SignView>(`/api/sign/${token}`)
      .then((d) => {
        setData(d);
        setName((n) => n || d.property.landlord_name || "");
      })
      .catch((e) => setError(e.message));
  }, [token]);

  useEffect(load, [load]);

  async function submit(decision: "agree" | "dispute") {
    setBusy(true);
    setError("");
    try {
      const d = await api<SignView>(`/api/sign/${token}`, {
        method: "POST",
        json: { signer_name: name.trim(), decision, note: decision === "dispute" ? note.trim() : "" },
      });
      setData(d);
      setJustSigned(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <main className="wrap">
        {error ? <p className="error" style={{ marginTop: 40 }}>{error}</p> : <p className="loading">Opening the report…</p>}
      </main>
    );
  }

  const { property: p, inspection: insp, signoff: s } = data;
  const total = insp.rooms.reduce((n, r) => n + r.issues.length, 0);

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar__inner">
          <Brand />
          <span className="small muted">Move-in condition report</span>
        </div>
      </header>
      <main className="page">
        <div className="wrap wrap--narrow">
          <article className="doc">
            <div className="doc__band guilloche">
              <h1 style={{ fontSize: "clamp(30px, 5vw, 46px)" }}>Move-in condition report</h1>
              <p style={{ margin: "12px 0 0", fontWeight: 500 }}>
                {p.address}, {p.city}
              </p>
            </div>
            <div className="doc__body">
              <dl className="facts" style={{ marginTop: 0 }}>
                <div>
                  <dt>Tenant</dt>
                  <dd>{p.tenant_name}</dd>
                </div>
                <div>
                  <dt>Deposit</dt>
                  <dd>{inr(p.deposit)}</dd>
                </div>
                <div>
                  <dt>Recorded</dt>
                  <dd>{fmtDate(insp.created_at)}</dd>
                </div>
              </dl>

              <p className="lede" style={{ marginTop: 24 }}>
                {p.landlord_name ? `${p.landlord_name} ji, ` : ""}
                {p.tenant_name} recorded {insp.rooms.length} room{insp.rooms.length > 1 ? "s" : ""} on move-in day and
                found {total} issue{total === 1 ? "" : "s"}. Please check them. If you agree, this becomes the starting
                condition for the deposit when they move out.
              </p>

              {insp.rooms.map((r) => (
                <section key={r.id} style={{ marginTop: 36 }}>
                  <div className="spread" style={{ marginBottom: 12 }}>
                    <h2 style={{ fontSize: 28 }}>{r.name}</h2>
                    <span className="small muted">
                      {clock(r.duration)} video, recorded {fmtDate(r.created_at, true)}
                    </span>
                  </div>
                  <video className="video" src={r.video_url ?? undefined} poster={r.poster_url ?? undefined} controls playsInline preload="metadata" />
                  {r.issues.length ? (
                    <div className="tags" style={{ marginTop: 18 }}>
                      {r.issues.map((i) => (
                        <IssueTag key={i.id} issue={i} locked />
                      ))}
                    </div>
                  ) : (
                    <p className="empty" style={{ marginTop: 18 }}>No issues noted in this room.</p>
                  )}
                </section>
              ))}

              <hr className="rule" style={{ margin: "40px 0 28px" }} />

              {s.decision ? (
                <div className="sign-result">
                  {s.decision === "agree" ? (
                    <>
                      <Stamp main="Agreed" sub={s.signer_name ?? ""} tone="violet" seal rotate={-10} slam={justSigned} size="lg" />
                      <p className="lede" style={{ margin: 0 }}>
                        Signed by {s.signer_name} on {fmtDate(s.signed_at, true)}. {p.tenant_name} sees it on their Wapas page,
                        and this record can no longer be changed.
                      </p>
                    </>
                  ) : (
                    <>
                      <Stamp main="Disputed" sub={s.signer_name ?? ""} tone="liable" rotate={-6} slam={justSigned} />
                      <p className="lede" style={{ margin: 0 }}>
                        Your note was sent to {p.tenant_name}: “{s.note}”. They can fix the record and send a new link.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="form-grid">
                  <h2 style={{ fontSize: 28 }}>Sign the move-in condition</h2>
                  <div className="field">
                    <label className="field__label" htmlFor="signer">
                      Your full name
                    </label>
                    <input className="input" id="signer" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
                  </div>
                  <div aria-hidden="true" className="signature">
                    {name}
                  </div>
                  {disputing ? (
                    <div className="field">
                      <label className="field__label" htmlFor="note">
                        What do you disagree with?
                      </label>
                      <textarea
                        className="textarea"
                        id="note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="The bathroom tile crack was fixed before move-in."
                      />
                    </div>
                  ) : null}
                  {error ? <p className="error">{error}</p> : null}
                  <div className="row">
                    {disputing ? (
                      <>
                        <button className="btn btn--primary" onClick={() => submit("dispute")} disabled={busy || name.trim().length < 2 || !note.trim()}>
                          Send dispute
                        </button>
                        <button className="linkbtn" onClick={() => setDisputing(false)}>
                          Back
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn--violet" onClick={() => submit("agree")} disabled={busy || name.trim().length < 2}>
                          {busy ? "Signing…" : "Agree and sign"}
                        </button>
                        <button className="btn" onClick={() => setDisputing(true)}>
                          Raise a dispute
                        </button>
                      </>
                    )}
                  </div>
                  <p className="small muted" style={{ margin: 0 }}>
                    Signing records your name, the time and this device. Wapas organises evidence and isn&apos;t legal
                    advice.
                  </p>
                </div>
              )}
            </div>
          </article>
        </div>
      </main>
    </>
  );
}
