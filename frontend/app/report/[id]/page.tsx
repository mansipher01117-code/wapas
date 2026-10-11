"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Stamp } from "@/components/Stamp";
import { api, clock, fmtDate, inr, inrRange, label, VERDICT_META, type Comparison, type Inspection } from "@/lib/api";

type Full = Comparison & { move_in_id: string; move_out_id: string };

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Full | null>(null);
  const [records, setRecords] = useState<Inspection[]>([]);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    api<Full>(`/api/comparisons/${id}`)
      .then(async (data) => {
        setC(data);
        const ins = await Promise.all([
          api<Inspection>(`/api/inspections/${data.move_in_id}`),
          api<Inspection>(`/api/inspections/${data.move_out_id}`),
        ]);
        setRecords(ins);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (!c) {
    return <main className="wrap">{error ? <p className="error">{error}</p> : <p className="loading">Preparing report…</p>}</main>;
  }

  const p = c.property;
  const so = c.move_in.signoff;
  const [mi, mo] = records;

  return (
    <main>
      <div className="wrap no-print row" style={{ justifyContent: "space-between", paddingTop: 20 }}>
        <Link href={`/compare/${c.id}`} className="back" style={{ margin: 0 }}>
          Back to the verdict
        </Link>
        <button className="btn btn--primary" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>

      <article className="report">
        <div className="report__band guilloche spread" style={{ alignItems: "center" }}>
          <div>
            <div className="brand" style={{ fontSize: 20 }}>
              <span className="brand__seal" aria-hidden="true">
                W
              </span>
              Wapas
            </div>
            <h1 style={{ fontSize: 34, marginTop: 14 }}>Deposit evidence report</h1>
            <p style={{ margin: "8px 0 0" }}>
              Report {c.id}, generated {fmtDate(new Date().toISOString(), true)}
            </p>
          </div>
          {c.move_in.lock_type === "mutual" ? (
            <Stamp main="Signed" sub={`move-in, ${so?.signer_name ?? ""}`} tone="violet" rotate={-8} />
          ) : null}
        </div>

        <div className="report__body">
          <table>
            <tbody>
              <tr>
                <th>Property</th>
                <td>
                  {p.address}, {p.city}
                </td>
                <th>Deposit</th>
                <td>{inr(p.deposit)}</td>
              </tr>
              <tr>
                <th>Tenant</th>
                <td>{p.tenant_name}</td>
                <th>Landlord</th>
                <td>
                  {p.landlord_name} {p.landlord_phone ? `(${p.landlord_phone})` : ""}
                </td>
              </tr>
              <tr>
                <th>Move-in record</th>
                <td>
                  {fmtDate(c.move_in.created_at, true)}
                  <br />
                  {c.move_in.lock_type === "mutual"
                    ? `Agreed by ${so?.signer_name} on ${fmtDate(c.move_in.locked_at, true)}`
                    : c.move_in.lock_type === "tenant_only"
                      ? `Locked by tenant on ${fmtDate(c.move_in.locked_at, true)}`
                      : "Not signed"}
                </td>
                <th>Move-out record</th>
                <td>{mo ? fmtDate(mo.created_at, true) : ""}</td>
              </tr>
            </tbody>
          </table>

          <h2>Summary</h2>
          <table>
            <tbody>
              <tr>
                <th>Pre-existing</th>
                <td>{c.counts.pre_existing}</td>
                <th>Worsened</th>
                <td>{c.counts.worsened}</td>
                <th>New damage</th>
                <td>{c.counts.new}</td>
                <th>Fixed</th>
                <td>{c.counts.fixed}</td>
              </tr>
              <tr>
                <th colSpan={2}>Fair deduction</th>
                <td colSpan={2}>
                  <b>{inrRange(c.fair_min, c.fair_max)}</b>
                </td>
                <th colSpan={2}>Deposit to return</th>
                <td colSpan={2}>
                  <b>{inrRange(Math.max(0, p.deposit - c.fair_max), Math.max(0, p.deposit - c.fair_min))}</b>
                </td>
              </tr>
            </tbody>
          </table>

          <h2>Findings</h2>
          <table>
            <thead>
              <tr>
                <th>Room</th>
                <th>Issue</th>
                <th>Move-in</th>
                <th>Move-out</th>
                <th>Verdict</th>
                <th>Fair cost</th>
              </tr>
            </thead>
            <tbody>
              {c.items.map((it) => {
                const subj = it.move_out ?? it.move_in;
                return (
                  <tr key={it.id}>
                    <td>{it.room_name}</td>
                    <td>
                      {subj?.description}
                      <br />
                      <span className="muted">
                        {subj ? `${label(subj.item)}, ${label(subj.issue_type)}` : ""}. {it.reason}
                      </span>
                    </td>
                    <td>
                      {it.move_in?.frame_url ? (
                        <>
                          <img className="report__thumb" src={it.move_in.frame_url} alt="Move-in frame" />
                          <span className="small">at {clock(it.move_in.frame_ts)}</span>
                        </>
                      ) : (
                        <span className="muted">Not recorded</span>
                      )}
                    </td>
                    <td>
                      {it.move_out?.frame_url ? (
                        <>
                          <img className="report__thumb" src={it.move_out.frame_url} alt="Move-out frame" />
                          <span className="small">at {clock(it.move_out.frame_ts)}</span>
                        </>
                      ) : (
                        <span className="muted">Not visible</span>
                      )}
                    </td>
                    <td>
                      <b>{VERDICT_META[it.verdict].stamp}</b>
                    </td>
                    <td>{it.cost_max ? inrRange(it.cost_min, it.cost_max) : "₹0"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h2>Video fingerprints</h2>
          <p className="small">
            Each video was fingerprinted with SHA-256 the moment it was uploaded. Anyone can check that a video is
            unedited at {origin}/verify.
          </p>
          <table>
            <thead>
              <tr>
                <th>Record</th>
                <th>Room</th>
                <th>Uploaded</th>
                <th>SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {[mi, mo].filter(Boolean).flatMap((rec) =>
                rec!.rooms.map((r) => (
                  <tr key={r.id}>
                    <td>{rec!.type === "move_in" ? "Move-in" : "Move-out"}</td>
                    <td>{r.name}</td>
                    <td>{fmtDate(r.created_at, true)}</td>
                    <td className="hash" style={{ fontSize: 13 }}>
                      {r.sha256}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>

          <p className="small muted" style={{ marginTop: 22 }}>
            Repair costs: {c.rate_card_note}. Issues were detected by AI from the videos and reviewed by the tenant.
            Wapas organises evidence and is not legal advice.
          </p>
        </div>
      </article>
    </main>
  );
}
