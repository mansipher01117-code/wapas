"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Missing } from "@/components/Missing";
import { Stamp } from "@/components/Stamp";
import { Topbar } from "@/components/Topbar";
import { api, clock, fmtDate, inr, inrRange, isGone, label, SETTLEMENT_NOTE, signerName, VERDICT_META, type CompareItem, type Comparison } from "@/lib/api";

const TILT = [-8, 6, -5, 9, -11, 4, -7, 8];

function Photo({ src, side, ts, empty }: { src: string | null; side: string; ts?: number; empty: string }) {
  return (
    <figure className="photo">
      {src ? <img className="photo__img" src={src} alt={`${side} frame`} /> : <div className="photo__empty">{empty}</div>}
      <figcaption>
        <span>{side}</span>
        {ts !== undefined ? <span className="muted num">{clock(ts)}</span> : null}
      </figcaption>
    </figure>
  );
}

function VerdictCard({ item, index }: { item: CompareItem; index: number }) {
  const meta = VERDICT_META[item.verdict];
  const subject = item.move_out ?? item.move_in;
  const leftSrc = item.move_in?.frame_url ?? item.move_in_ref_frame;
  const free = item.cost_max === 0;

  return (
    <article className={`verdict verdict--${item.verdict}`}>
      <div className="verdict__head">
        <div>
          <div className="verdict__room">{item.room_name}</div>
          <h3>{subject?.description ?? "Issue"}</h3>
        </div>
        <span className={`verdict__cost ${free ? "verdict__cost--zero" : ""}`}>
          {free ? "₹0" : inrRange(item.cost_min, item.cost_max)}
        </span>
      </div>

      <div className="pair">
        <Photo
          src={leftSrc}
          side={item.move_in ? "Move-in" : "Move-in, same spot"}
          ts={item.move_in?.frame_ts}
          empty="Nothing recorded here at move-in"
        />
        <Photo
          src={item.move_out?.frame_url ?? null}
          side="Move-out"
          ts={item.move_out?.frame_ts}
          empty="Not visible at move-out"
        />
        <div className="pair__stamp">
          <Stamp main={meta.stamp} sub={meta.hinglish} tone={meta.tone} rotate={TILT[index % TILT.length]} slam delay={0.35 + index * 0.32} />
        </div>
      </div>

      <div className="verdict__foot">
        <span className="small">
          <b>{item.reason || meta.plain}</b>{" "}
          {subject ? (
            <span className="muted">
              ({label(subject.item)}, {label(subject.issue_type)}, {item.move_out?.severity ?? subject.severity})
            </span>
          ) : null}
        </span>
      </div>
    </article>
  );
}

export default function ComparePage() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Comparison | null>(null);
  const [loadFailed, setLoadFailed] = useState<{ gone: boolean } | null>(null);

  const load = useCallback(() => {
    api<Comparison>(`/api/comparisons/${id}`)
      .then((data) => {
        setC(data);
        setLoadFailed(null);
      })
      .catch((e) => setLoadFailed({ gone: isGone(e) }));
  }, [id]);

  useEffect(load, [load]);

  const pending = c && (c.status === "queued" || c.status === "processing");
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [pending, load]);

  if (!c) {
    return (
      <>
        <Topbar />
        {loadFailed ? (
          <Missing gone={loadFailed.gone} />
        ) : (
          <main className="wrap">
            <p className="loading">Opening verdict…</p>
          </main>
        )}
      </>
    );
  }

  const p = c.property;
  const so = c.move_in.signoff;
  const backLo = Math.max(0, p.deposit - c.fair_max);
  const backHi = Math.max(0, p.deposit - c.fair_min);
  const sum = (v: CompareItem["verdict"]) =>
    c.items.filter((i) => i.verdict === v).reduce((a, i) => [a[0] + i.cost_min, a[1] + i.cost_max], [0, 0]);
  const [newLo, newHi] = sum("new");
  const [worseLo, worseHi] = sum("worsened");

  const reportUrl = typeof window !== "undefined" ? `${window.location.origin}/report/${c.id}` : "";
  const phone = (p.landlord_phone ?? "").replace(/\D/g, "");
  const waPhone = phone.length === 10 ? `91${phone}` : phone;
  const waMsg = `Namaste ${p.landlord_name}, this is ${p.tenant_name}. I compared the move-out condition of ${p.address} with the move-in record you signed. Fair deduction: ${inrRange(c.fair_min, c.fair_max)}. Full evidence report: ${reportUrl}`;

  return (
    <>
      <Topbar />
      <main className="page">
        <div className="wrap">
          <Link href={`/property/${c.property_id}`} className="back">
            Back to {p.address}
          </Link>
          <h1 style={{ fontSize: "clamp(34px, 5.5vw, 60px)" }}>The verdict</h1>
          <p className="muted" style={{ marginTop: 10 }}>
            {p.address}, {p.city}. Move-out checked against the move-in record of {fmtDate(c.move_in.created_at)}.
          </p>
          {p.is_sample ? (
            <p style={{ marginTop: 10 }}>
              <span className="badge">Sample data</span>
            </p>
          ) : null}

          {c.status === "failed" ? (
            <div className="sheet" style={{ marginTop: 24, maxWidth: 620 }}>
              <h3 style={{ marginBottom: 10 }}>The comparison didn&apos;t finish</h3>
              <p className="small">
                Nothing was lost: both records are still on file. Open the folder and run the comparison again.
              </p>
              <Link href={`/property/${c.property_id}`} className="btn btn--small btn--primary">
                Back to the folder
              </Link>
            </div>
          ) : null}

          {pending ? (
            <div className="sheet" style={{ marginTop: 28, maxWidth: 640 }}>
              <h3 style={{ marginBottom: 14 }}>Comparing room by room</h3>
              <ul className="checklist">
                <li data-state="done">
                  <span className="checklist__box checklist__box--done">✓</span>Loaded the signed move-in record
                </li>
                <li data-state="now">
                  <span className="checklist__box checklist__box--now" />
                  Matching every move-out issue to what was there before
                </li>
                <li data-state="todo">
                  <span className="checklist__box" />
                  Pricing only the new damage from local repair rates
                </li>
              </ul>
            </div>
          ) : null}

          {c.status === "ready" ? (
            <div className="settle">
              <aside className="receipt" aria-label="Settlement slip">
                <h3 style={{ marginBottom: 12 }}>Settlement slip</h3>
                <div className="receipt__line">
                  <span>Security deposit</span>
                  <strong>{inr(p.deposit)}</strong>
                </div>
                <div className="receipt__line">
                  <span>Pre-existing ({c.counts.pre_existing})</span>
                  <strong>₹0</strong>
                </div>
                {c.counts.fixed ? (
                  <div className="receipt__line">
                    <span>Fixed ({c.counts.fixed})</span>
                    <strong>₹0</strong>
                  </div>
                ) : null}
                <div className="receipt__line">
                  <span>Worsened ({c.counts.worsened})</span>
                  <strong>{inrRange(worseLo, worseHi)}</strong>
                </div>
                <div className="receipt__line">
                  <span>New damage ({c.counts.new})</span>
                  <strong>{inrRange(newLo, newHi)}</strong>
                </div>
                <div className="receipt__total">
                  <span className="small">You should get back</span>
                  <span className="num">{inrRange(backLo, backHi)}</span>
                </div>
                <p className="small muted" style={{ marginTop: 14 }}>
                  {SETTLEMENT_NOTE}
                </p>
                <p className="small">
                  {c.move_in.lock_type === "mutual" && so
                    ? `Move-in record signed by ${signerName(so.signer_name)} on ${fmtDate(c.move_in.locked_at)}.`
                    : c.move_in.lock_type === "tenant_only"
                      ? `Move-in record locked by the tenant on ${fmtDate(c.move_in.locked_at)}.`
                      : "The move-in record was never signed, so the landlord may question it."}
                </p>
                <p className="small muted">{c.rate_card_note}.</p>
                <div className="stack" style={{ gap: 10 }}>
                  <Link href={`/report/${c.id}`} className="btn btn--primary btn--block">
                    Open evidence report
                  </Link>
                  <a className="btn btn--block" href={`https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noreferrer">
                    Send to landlord on WhatsApp
                  </a>
                </div>
              </aside>

              <section className="verdicts" aria-label="Findings">
                {c.items.length === 0 ? (
                  <p className="empty">No issues in either record. Your full deposit should come back.</p>
                ) : (
                  c.items.map((it, i) => <VerdictCard key={it.id} item={it} index={i} />)
                )}
              </section>
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
