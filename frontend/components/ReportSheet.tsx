"use client";

import { useEffect, useState } from "react";
import { Stamp } from "@/components/Stamp";
import {
  CAPTURE_META,
  clock,
  fmtDate,
  inr,
  inrRange,
  label,
  SETTLEMENT_NOTE,
  signerName,
  VERDICT_META,
  type Inspection,
  type Report,
} from "@/lib/api";

/** The printable evidence report. Shared by /report/[id] and the read-only /shared/[token] page. */
export function ReportSheet({ c, records, shared = false }: { c: Report; records: Inspection[]; shared?: boolean }) {
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const p = c.property;
  const so = c.move_in.signoff;
  const [mi, mo] = records;

  return (
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
          {shared ? (
            <p style={{ margin: "10px 0 0" }}>
              <span className="badge">Shared report, read only</span>
            </p>
          ) : null}
          {p.is_sample ? (
            <p style={{ margin: "10px 0 0" }}>
              <span className="badge">Sample data</span> This is a sample report, not real evidence.
            </p>
          ) : null}
        </div>
        {c.move_in.lock_type === "mutual" ? (
          <Stamp main="Signed" sub={`move-in, ${signerName(so?.signer_name)}`} tone="violet" rotate={-8} />
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
                  ? `Agreed by ${signerName(so?.signer_name)} on ${fmtDate(c.move_in.locked_at, true)}`
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
        <p className="small muted">{SETTLEMENT_NOTE}</p>

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
          Each video was fingerprinted with SHA-256 the moment it was uploaded. Anyone can check at {origin}/verify
          that a copy of a video is byte-for-byte the file listed here. “Recorded live” means the video came straight
          from the camera in the app rather than the device gallery; it is not proof that the footage is unedited.
        </p>
        <table>
          <thead>
            <tr>
              <th>Record</th>
              <th>Room</th>
              <th>How it was captured</th>
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
                  <td>{CAPTURE_META[r.capture_source].badge}</td>
                  <td>{fmtDate(r.created_at, true)}</td>
                  <td className="hash" style={{ fontSize: 13 }}>
                    {r.sha256 ?? <span className="muted">Sample, no video</span>}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>

        <p className="small muted" style={{ marginTop: 22 }}>
          Repair costs: {c.rate_card_note}. Issues were detected by AI from the videos and reviewed by the tenant.
        </p>
      </div>
    </article>
  );
}
