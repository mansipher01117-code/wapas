"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ReportSheet } from "@/components/ReportSheet";
import { api, fmtDate, type Inspection, type Report, type ShareLink } from "@/lib/api";

function ShareBox({ cid }: { cid: string }) {
  const [link, setLink] = useState<ShareLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const url = link && typeof window !== "undefined" ? `${window.location.origin}/shared/${link.token}` : "";

  async function create() {
    setBusy(true);
    setError("");
    try {
      setLink(await api<ShareLink>(`/api/comparisons/${cid}/share`, { method: "POST" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      await api(`/api/comparisons/${cid}/share/revoke`, { method: "POST" });
      setLink(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!link) {
    return (
      <div className="row">
        <button className="btn" onClick={create} disabled={busy}>
          {busy ? "Making a link…" : "Share link"}
        </button>
        {error ? <span className="error small">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="sheet" style={{ maxWidth: 620 }}>
      <h3 style={{ marginBottom: 10 }}>Read-only link</h3>
      <p className="small">
        Anyone with this link can read this report and print it. They can&apos;t edit anything, sign anything, or see
        your other places.{" "}
        {link.expires_at ? `The link stops working on ${fmtDate(link.expires_at)}.` : "The link doesn't expire."}
      </p>
      <div className="copyfield">
        <input readOnly value={url} aria-label="Shared report link" onFocus={(e) => e.currentTarget.select()} />
        <button
          onClick={() => {
            navigator.clipboard?.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <a className="btn btn--small" href={url} target="_blank" rel="noreferrer">
          Open the shared page
        </a>
        <button className="linkbtn" onClick={revoke} disabled={busy}>
          Stop sharing
        </button>
      </div>
      {error ? <p className="error small" style={{ marginBottom: 0 }}>{error}</p> : null}
    </div>
  );
}

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Report | null>(null);
  const [records, setRecords] = useState<Inspection[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Report>(`/api/comparisons/${id}`)
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

  return (
    <main>
      <div className="wrap no-print stack" style={{ gap: 14, paddingTop: 20 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <Link href={`/compare/${c.id}`} className="back" style={{ margin: 0 }}>
            Back to the verdict
          </Link>
          <button className="btn btn--primary" onClick={() => window.print()}>
            Print or save as PDF
          </button>
        </div>
        <ShareBox cid={c.id} />
      </div>

      <ReportSheet c={c} records={records} />
    </main>
  );
}
