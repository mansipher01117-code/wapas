"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LoadSampleButton, Missing } from "@/components/Missing";
import { ReportSheet } from "@/components/ReportSheet";
import { api, fmtDate, isGone, type SharedReport } from "@/lib/api";

export default function SharedReportPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedReport | null>(null);
  const [loadFailed, setLoadFailed] = useState<{ gone: boolean } | null>(null);

  useEffect(() => {
    api<SharedReport>(`/api/shared/${token}`)
      .then(setData)
      .catch((e) => setLoadFailed({ gone: isGone(e) }));
  }, [token]);

  if (!data) {
    if (!loadFailed) {
      return (
        <main className="wrap">
          <p className="loading">Opening the shared report…</p>
        </main>
      );
    }
    if (!loadFailed.gone) {
      return <Missing gone={false} sample={false} />;
    }
    return (
      <main className="wrap" style={{ paddingTop: 40 }}>
        <div className="sheet" style={{ maxWidth: 560 }}>
          <h3 style={{ marginBottom: 10 }}>This link is invalid or has expired</h3>
          <p className="small">
            Shared reports stop working once the tenant stops sharing them, 30 days after they were made, or if the
            demo server restarts and clears its data. Ask for a fresh link.
          </p>
          <div className="row">
            <LoadSampleButton className="btn btn--primary btn--small" />
            <Link href="/dashboard" className="btn btn--small">
              Go to Wapas
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="wrap no-print row" style={{ justifyContent: "space-between", paddingTop: 20 }}>
        <span className="small muted">
          Shared on {fmtDate(data.share.created_at)}
          {data.share.expires_at ? `, readable until ${fmtDate(data.share.expires_at)}` : ""}
        </span>
        <button className="btn btn--primary" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>

      <ReportSheet c={data} records={data.records} shared />
    </main>
  );
}
