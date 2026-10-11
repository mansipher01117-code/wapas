"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Topbar } from "@/components/Topbar";
import { api, type Property } from "@/lib/api";

export default function NewProperty() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const p = await api<Property>("/api/properties", {
        method: "POST",
        json: {
          tenant_name: String(f.get("tenant_name") || "").trim(),
          address: String(f.get("address") || "").trim(),
          city: String(f.get("city") || "").trim(),
          rent: Number(f.get("rent") || 0),
          deposit: Number(f.get("deposit") || 0),
          landlord_name: String(f.get("landlord_name") || "").trim(),
          landlord_phone: String(f.get("landlord_phone") || "").trim(),
        },
      });
      const insp = await api<{ id: string }>(`/api/properties/${p.id}/inspections`, {
        method: "POST",
        json: { type: "move_in" },
      });
      router.push(`/inspect/${insp.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <Topbar />
      <main className="page">
        <div className="wrap wrap--narrow">
          <Link href="/dashboard" className="back">
            Back to my rooms
          </Link>
          <h1 style={{ fontSize: "clamp(34px, 5vw, 52px)" }}>Add the place you&apos;re renting</h1>
          <p className="lede muted" style={{ marginTop: 12 }}>
            These details go on the report your landlord signs. Next, you&apos;ll record each room.
          </p>

          <form className="sheet form-grid" style={{ marginTop: 28 }} onSubmit={submit}>
            <div className="field">
              <label className="field__label" htmlFor="tenant_name">
                Your name
              </label>
              <input className="input" id="tenant_name" name="tenant_name" required autoComplete="name" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="address">
                Room and address
              </label>
              <input
                className="input"
                id="address"
                name="address"
                required
                minLength={3}
                placeholder="Room 204, Shanti PG, Crossings Republik"
              />
            </div>
            <div className="form-grid form-grid--2">
              <div className="field">
                <label className="field__label" htmlFor="city">
                  City
                </label>
                <input className="input" id="city" name="city" required placeholder="Ghaziabad" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="rent">
                  Monthly rent (₹)
                </label>
                <input className="input" id="rent" name="rent" type="number" min={0} inputMode="numeric" required />
              </div>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="deposit">
                Security deposit (₹)
              </label>
              <input className="input" id="deposit" name="deposit" type="number" min={0} inputMode="numeric" required />
            </div>
            <hr className="rule rule--dashed" style={{ margin: "4px 0" }} />
            <div className="form-grid form-grid--2">
              <div className="field">
                <label className="field__label" htmlFor="landlord_name">
                  Landlord or PG owner
                </label>
                <input className="input" id="landlord_name" name="landlord_name" required />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="landlord_phone">
                  Their WhatsApp number
                </label>
                <input
                  className="input"
                  id="landlord_phone"
                  name="landlord_phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="98765 43210"
                />
                <span className="field__hint">We open WhatsApp with the sign-off link. Nothing is sent without you.</span>
              </div>
            </div>
            {error ? <p className="error">{error}</p> : null}
            <div>
              <button className="btn btn--primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save and record rooms"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
