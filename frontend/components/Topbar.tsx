"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Health } from "@/lib/api";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Wapas home">
      <span className="brand__seal" aria-hidden="true">
        W
      </span>
      Wapas
    </Link>
  );
}

export function Topbar({ landing = false }: { landing?: boolean }) {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    api<Health>("/api/health").then(setHealth).catch(() => setHealth(null));
  }, []);

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar__inner">
          <Brand />
          <nav className="nav" aria-label="Main">
            {landing ? (
              <>
                <a className="nav__link--hide-sm" href="#how">
                  How it works
                </a>
                <a className="nav__link--hide-sm" href="#pricing">
                  Pricing
                </a>
              </>
            ) : null}
            <Link className="nav__link--hide-sm" href="/verify">
              Verify a video
            </Link>
            <Link href="/dashboard" className="btn btn--small btn--primary">
              {landing ? "Open Wapas" : "My rooms"}
            </Link>
          </nav>
        </div>
      </header>
      {!landing && health && !health.ai_live ? (
        <div className="demo-strip">
          <div className="wrap">
            Demo AI mode: issues are sample data. Add GEMINI_API_KEY to backend/.env for real analysis.
          </div>
        </div>
      ) : null}
    </>
  );
}
