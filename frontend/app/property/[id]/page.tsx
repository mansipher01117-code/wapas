"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Stamp } from "@/components/Stamp";
import { Topbar } from "@/components/Topbar";
import { api, fmtDate, inr, inrRange, type InspectionSummary, type Property } from "@/lib/api";

function roomsLine(i: InspectionSummary | null) {
  if (!i || i.room_count === 0) return "No rooms recorded yet.";
  const names = (i.room_names ?? []).join(", ");
  return `${i.room_count} room${i.room_count > 1 ? "s" : ""} (${names}), ${i.issue_count} issue${i.issue_count === 1 ? "" : "s"} noted.`;
}

export default function PropertyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [p, setP] = useState<Property | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    api<Property>(`/api/properties/${id}`)
      .then(setP)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  async function start(type: "move_in" | "move_out") {
    setBusy(type);
    setError("");
    try {
      const insp = await api<{ id: string }>(`/api/properties/${id}/inspections`, { method: "POST", json: { type } });
      router.push(`/inspect/${insp.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  }

  async function compare() {
    setBusy("compare");
    setError("");
    try {
      const c = await api<{ id: string }>(`/api/properties/${id}/compare`, { method: "POST" });
      router.push(`/compare/${c.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  }

  async function remove() {
    await api(`/api/properties/${id}`, { method: "DELETE" });
    router.push("/dashboard");
  }

  if (!p) {
    return (
      <>
        <Topbar />
        <main className="wrap">{error ? <p className="error">{error}</p> : <p className="loading">Opening folder…</p>}</main>
      </>
    );
  }

  const mi = p.move_in;
  const mo = p.move_out;
  const moveInReady = mi?.status === "ready";
  const signed = !!mi?.locked_at;
  const moveOutReady = mo?.status === "ready";
  const so = mi?.signoff;

  return (
    <>
      <Topbar />
      <main className="page">
        <div className="wrap wrap--narrow">
          <Link href="/dashboard" className="back">
            Back to my rooms
          </Link>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 50px)" }}>{p.address}</h1>
          <p className="muted" style={{ marginTop: 10 }}>
            {p.city}. Rented by {p.tenant_name} from {p.landlord_name || "the landlord"}.
          </p>

          <dl className="facts">
            <div>
              <dt>Deposit</dt>
              <dd>{inr(p.deposit)}</dd>
            </div>
            <div>
              <dt>Monthly rent</dt>
              <dd>{inr(p.rent)}</dd>
            </div>
            <div>
              <dt>Landlord WhatsApp</dt>
              <dd>{p.landlord_phone || "Not added"}</dd>
            </div>
          </dl>

          {error ? <p className="error" style={{ marginTop: 20 }}>{error}</p> : null}

          <ol className="case" style={{ listStyle: "none", padding: 0 }}>
            <li className="case__step">
              <span className={`case__n ${moveInReady ? "case__n--done" : ""}`}>1</span>
              <div className="sheet">
                <div className="sheet__head">
                  <h3>Move-in record</h3>
                  {mi ? <span className="badge">{fmtDate(mi.created_at)}</span> : null}
                </div>
                <p>{roomsLine(mi)}</p>
                {mi ? (
                  <Link className="btn btn--small" href={`/inspect/${mi.id}`}>
                    {signed ? "View move-in record" : "Open move-in record"}
                  </Link>
                ) : (
                  <button className="btn btn--primary btn--small" onClick={() => start("move_in")} disabled={!!busy}>
                    Start recording
                  </button>
                )}
              </div>
            </li>

            <li className={`case__step ${!moveInReady ? "case__step--locked" : ""}`}>
              <span className={`case__n ${signed ? "case__n--done" : ""}`}>2</span>
              <div className="sheet">
                <div className="sheet__head">
                  <h3>Landlord sign-off</h3>
                  {signed && mi?.lock_type === "mutual" ? (
                    <Stamp main="Agreed" sub={so?.signer_name ?? undefined} tone="violet" size="sm" rotate={-6} />
                  ) : null}
                  {signed && mi?.lock_type === "tenant_only" ? (
                    <Stamp main="Locked" sub="by tenant" tone="violet" size="sm" rotate={-6} />
                  ) : null}
                </div>
                {signed ? (
                  <p>
                    {mi?.lock_type === "mutual"
                      ? `${so?.signer_name} agreed to the move-in condition on ${fmtDate(mi?.locked_at, true)}. The record can no longer be edited.`
                      : `You locked this record on ${fmtDate(mi?.locked_at, true)} without the landlord's reply. The timestamps still stand.`}
                  </p>
                ) : so?.decision === "dispute" ? (
                  <>
                    <p>
                      <b>{so.signer_name}</b> disagreed: “{so.note}”
                    </p>
                    <Link className="btn btn--small btn--primary" href={`/inspect/${mi?.id}`}>
                      Fix the record and resend
                    </Link>
                  </>
                ) : so ? (
                  <>
                    <p>Sent. Waiting for {p.landlord_name || "your landlord"} to open the link.</p>
                    <Link className="btn btn--small" href={`/inspect/${mi?.id}`}>
                      Resend or lock it yourself
                    </Link>
                  </>
                ) : (
                  <>
                    <p>Your landlord confirms the condition on a link. After that, nobody can change the record.</p>
                    {moveInReady ? (
                      <Link className="btn btn--small btn--primary" href={`/inspect/${mi?.id}#share`}>
                        Send for sign-off
                      </Link>
                    ) : null}
                  </>
                )}
              </div>
            </li>

            <li className={`case__step ${!moveInReady ? "case__step--locked" : ""}`}>
              <span className={`case__n ${moveOutReady ? "case__n--done" : ""}`}>3</span>
              <div className="sheet">
                <div className="sheet__head">
                  <h3>Move-out record</h3>
                  {mo ? <span className="badge">{fmtDate(mo.created_at)}</span> : null}
                </div>
                <p>
                  {mo
                    ? roomsLine(mo)
                    : "When you leave, record the same rooms again. Wapas compares them against the move-in record."}
                </p>
                {mo ? (
                  <Link className="btn btn--small" href={`/inspect/${mo.id}`}>
                    Open move-out record
                  </Link>
                ) : moveInReady ? (
                  <button className="btn btn--small" onClick={() => start("move_out")} disabled={!!busy}>
                    {busy === "move_out" ? "Starting…" : "Start move-out"}
                  </button>
                ) : null}
              </div>
            </li>

            <li className={`case__step ${!moveOutReady ? "case__step--locked" : ""}`}>
              <span className={`case__n ${p.comparison?.status === "ready" ? "case__n--done" : ""}`}>4</span>
              <div className="sheet">
                <div className="sheet__head">
                  <h3>Verdict</h3>
                </div>
                {p.comparison?.status === "ready" ? (
                  <p>
                    Fair deduction: <b className="num">{inrRange(p.comparison.fair_min, p.comparison.fair_max)}</b> out
                    of your {inr(p.deposit)} deposit.
                  </p>
                ) : (
                  <p>AI checks every move-out issue against the move-in record and prices only the new damage.</p>
                )}
                <div className="row">
                  {p.comparison ? (
                    <Link className="btn btn--small btn--primary" href={`/compare/${p.comparison.id}`}>
                      Open verdict
                    </Link>
                  ) : null}
                  {moveOutReady ? (
                    <button className="btn btn--small" onClick={compare} disabled={!!busy}>
                      {busy === "compare" ? "Starting…" : p.comparison ? "Compare again" : "Compare move-in and move-out"}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          </ol>

          <div style={{ marginTop: 48 }} className="small">
            {confirmDelete ? (
              <span className="row">
                Delete this place, its videos and reports?
                <button className="btn btn--small" onClick={remove}>
                  Yes, delete everything
                </button>
                <button className="linkbtn" onClick={() => setConfirmDelete(false)}>
                  Keep it
                </button>
              </span>
            ) : (
              <button className="linkbtn muted" onClick={() => setConfirmDelete(true)}>
                Delete this place
              </button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
