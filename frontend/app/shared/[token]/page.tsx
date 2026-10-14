"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ReportSheet } from "@/components/ReportSheet";
import { api, fmtDate, type SharedReport } from "@/lib/api";

export default function SharedReportPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<SharedReport>(`/api/shared/${token}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token]);

  if (!data) {
    const gone = error.toLowerCase().includes("expired");
    return (
      <main className="wrap" style={{ paddingTop: 40 }}>
        {!error ? (
          <p className="loading">Opening the shared report…</p>
        ) : gone ? (
          <div className="sheet" style={{ maxWidth: 560 }}>
            <h3 style={{ marginBottom: 10 }}>This link is invalid or has expired</h3>
            <p className="small" style={{ marginBottom: 0 }}>
              Shared reports stop working once the tenant stops sharing them, or 30 days after they were made. Ask for
              a fresh link.
            </p>
          </div>
        ) : (
          <p className="error">{error}</p>
        )}
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
