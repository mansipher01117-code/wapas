"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IssueTag } from "@/components/IssueTag";
import { Missing } from "@/components/Missing";
import { Stamp } from "@/components/Stamp";
import { Topbar } from "@/components/Topbar";
import {
  api,
  CAPTURE_META,
  clock,
  fmtDate,
  isGone,
  ISSUE_TYPES,
  ITEMS,
  label,
  ROOM_PRESETS,
  SEVERITIES,
  signerName,
  uploadFile,
  type CaptureSource,
  type Inspection,
  type Issue,
  type Property,
  type Room,
} from "@/lib/api";

const STEPS = [
  { key: "hashed", text: "Fingerprinted the video (SHA-256)" },
  { key: "frames", text: "Pulling a frame every 2 seconds" },
  { key: "listening", text: "Listening to your voice notes" },
  { key: "inspecting", text: "Inspecting walls, floor and fittings" },
];
const ORDER = ["hashed", "frames", "listening", "inspecting", "done"];

function Processing({ room }: { room: Room }) {
  let cur = ORDER.indexOf(room.step ?? "hashed");
  if (cur < 1) cur = 1;
  return (
    <div className="sheet sheet--flat">
      <h3 style={{ marginBottom: 16 }}>Preparing the {room.name} report</h3>
      <ul className="checklist">
        {STEPS.map((s, i) => {
          const state = i < cur ? "done" : i === cur ? "now" : "todo";
          return (
            <li key={s.key} data-state={state}>
              <span className={`checklist__box checklist__box--${state}`} aria-hidden="true">
                {state === "done" ? "✓" : ""}
              </span>
              <span>
                {s.text}
                <span className="visually-hidden">{state === "done" ? " (done)" : state === "now" ? " (in progress)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {room.sha256 ? (
        <p className="small muted" style={{ marginTop: 16, marginBottom: 0 }}>
          Fingerprint <span className="hash">{room.sha256.slice(0, 24)}…</span>
        </p>
      ) : null}
    </div>
  );
}

function Recorder({
  roomName,
  type,
  onFile,
  upload,
}: {
  roomName: string;
  type: "move_in" | "move_out";
  onFile: (f: File, source: CaptureSource) => void;
  upload: number | null;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  if (upload !== null) {
    return (
      <div className="drop">
        <h3>Uploading {roomName}</h3>
        <div className="bar" role="progressbar" aria-valuenow={upload} aria-valuemin={0} aria-valuemax={100}>
          <div className="bar__fill" style={{ width: `${upload}%` }} />
        </div>
        <span className="num">{upload}%</span>
      </div>
    );
  }

  const pick = (source: CaptureSource) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f, source);
    e.target.value = "";
  };

  return (
    <div
      className={`drop ${over ? "drop--over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f, "file");
      }}
    >
      <span className="drop__icon" aria-hidden="true" />
      <h3>Record the {roomName.toLowerCase()}</h3>
      <div className="tip">
        {type === "move_in" ? (
          <>
            Start at the door and pan slowly round the room. Say what you see, like{" "}
            <q>almirah ka handle toota hai</q> or <q>tile mein crack hai</q>. 30 to 60 seconds is enough.
          </>
        ) : (
          <>Walk the {roomName.toLowerCase()} the same way you did at move-in, so Wapas compares the same spots.</>
        )}
      </div>
      <div className="row" style={{ justifyContent: "center" }}>
        <button className="btn btn--primary" onClick={() => cameraRef.current?.click()}>
          Open camera
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Choose a video
        </button>
      </div>
      <span className="small muted">You can also drop a video file here.</span>
      <input ref={cameraRef} type="file" accept="video/*" capture="environment" hidden onChange={pick("camera")} />
      <input ref={fileRef} type="file" accept="video/*" hidden onChange={pick("file")} />
    </div>
  );
}

function AddIssue({ room, at, onAdded }: { room: Room; at: () => number; onAdded: (i: Issue) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [ts, setTs] = useState(0);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const i = await api<Issue>(`/api/rooms/${room.id}/issues`, {
        method: "POST",
        json: {
          description: String(f.get("description") || "").trim(),
          item: f.get("item"),
          issue_type: f.get("issue_type"),
          severity: f.get("severity"),
          frame_ts: ts,
        },
      });
      onAdded(i);
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!open) {
    return (
      <button
        className="btn btn--small"
        onClick={() => {
          setTs(at());
          setOpen(true);
        }}
      >
        Add something the AI missed
      </button>
    );
  }

  return (
    <form className="sheet sheet--flat form-grid" onSubmit={submit} style={{ gap: 12 }}>
      <h3>Add an issue at {clock(ts)}</h3>
      <p className="small muted" style={{ margin: 0 }}>
        Pause the video where the problem is visible, then add it. The frame at that moment is attached.
      </p>
      <input className="input" name="description" placeholder="Switchboard cover cracked near the bed" required minLength={2} maxLength={160} aria-label="Describe the issue" />
      <div className="form-grid form-grid--2" style={{ gap: 12 }}>
        <select className="select" name="item" defaultValue="wall" aria-label="What">
          {ITEMS.map((x) => (
            <option key={x} value={x}>
              {label(x)}
            </option>
          ))}
        </select>
        <select className="select" name="issue_type" defaultValue="crack" aria-label="Problem">
          {ISSUE_TYPES.map((x) => (
            <option key={x} value={x}>
              {label(x)}
            </option>
          ))}
        </select>
      </div>
      <select className="select" name="severity" defaultValue="minor" aria-label="Severity">
        {SEVERITIES.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      {error ? <p className="error small">{error}</p> : null}
      <div className="row">
        <button className="btn btn--small btn--primary">Add issue</button>
        <button type="button" className="linkbtn" onClick={() => setTs(at())}>
          Use current video time
        </button>
        <button type="button" className="linkbtn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function RoomReport({
  room,
  locked,
  onChanged,
  onRerecord,
}: {
  room: Room;
  locked: boolean;
  onChanged: () => void;
  onRerecord: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [issues, setIssues] = useState<Issue[]>(room.issues);

  useEffect(() => setIssues(room.issues), [room.issues]);

  const seek = (ts: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = ts;
    v.scrollIntoView({ behavior: "smooth", block: "center" });
    v.play().catch(() => undefined);
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      {room.video_url ? (
        <video
          ref={videoRef}
          className="video"
          src={room.video_url}
          poster={room.poster_url ?? undefined}
          controls
          playsInline
          preload="metadata"
        />
      ) : (
        <div className="photo__empty">Sample, no video</div>
      )}
      <div className="spread small">
        <span>
          {room.sha256 ? (
            <>
              {clock(room.duration)} video. Fingerprint <span className="hash">{room.sha256.slice(0, 16)}…</span>
            </>
          ) : (
            "Sample room, nothing was recorded"
          )}
        </span>
        <span className="row" style={{ gap: 8 }}>
          <span className="badge" title={CAPTURE_META[room.capture_source].note}>
            {CAPTURE_META[room.capture_source].badge}
          </span>
          {room.ai_mode === "demo" ? <span className="badge">sample issues</span> : <span className="badge badge--violet">AI checked</span>}
          {!locked ? (
            <button className="linkbtn" onClick={onRerecord}>
              Re-record this room
            </button>
          ) : null}
        </span>
      </div>

      {room.transcript.length ? (
        <details className="sheet sheet--flat" style={{ padding: "12px 16px" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>What you said ({room.transcript.length} lines)</summary>
          <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
            {room.transcript.map((s, i) => (
              <li key={i}>
                <button className="linkbtn num" onClick={() => seek(s.start)}>
                  {clock(s.start)}
                </button>{" "}
                {s.text}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="spread">
        <h3>
          {issues.length === 0
            ? "No issues found in this room"
            : `${issues.length} issue${issues.length > 1 ? "s" : ""} on record`}
        </h3>
        {!locked ? (
          <AddIssue
            room={room}
            at={() => videoRef.current?.currentTime ?? 0}
            onAdded={(i) => {
              setIssues((xs) => [...xs, i].sort((a, b) => a.frame_ts - b.frame_ts));
              onChanged();
            }}
          />
        ) : null}
      </div>

      {issues.length ? (
        <div className="tags">
          {issues.map((i) => (
            <IssueTag
              key={i.id}
              issue={i}
              locked={locked}
              onSeek={seek}
              onChange={(u) => setIssues((xs) => xs.map((x) => (x.id === u.id ? u : x)))}
              onRemove={(id) => {
                setIssues((xs) => xs.filter((x) => x.id !== id));
                onChanged();
              }}
            />
          ))}
        </div>
      ) : (
        <p className="empty">
          The room looks clean. If you spotted something, pause the video on it and add it, so it&apos;s on record.
        </p>
      )}
    </div>
  );
}

function SharePanel({ insp, property, onUpdate }: { insp: Inspection; property?: Property; onUpdate: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const so = insp.signoff;

  const link = typeof window !== "undefined" && so?.token ? `${window.location.origin}/sign/${so.token}` : "";

  async function share() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/inspections/${insp.id}/share`, { method: "POST" });
      onUpdate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function lockSelf() {
    setBusy(true);
    try {
      await api(`/api/inspections/${insp.id}/lock`, { method: "POST" });
      onUpdate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (insp.locked_at) {
    const mutual = insp.lock_type === "mutual";
    return (
      <div className="sheet sheet--violet" id="share">
        <div style={{ display: "grid", justifyItems: "center", padding: "6px 0 14px" }}>
          <Stamp
            main={mutual ? "Agreed" : "Locked"}
            sub={mutual ? signerName(so?.signer_name) : "by tenant"}
            tone="violet"
            seal
            rotate={-10}
          />
        </div>
        <p style={{ marginBottom: 0 }}>
          {mutual
            ? `${signerName(so?.signer_name)} signed the move-in condition on ${fmtDate(insp.locked_at, true)}. This record is now final.`
            : `Locked by you on ${fmtDate(insp.locked_at, true)}. The landlord didn't reply, but the timestamps and fingerprints still hold.`}
        </p>
      </div>
    );
  }

  const ready = insp.status === "ready";
  const phone = (property?.landlord_phone ?? "").replace(/\D/g, "");
  const waPhone = phone.length === 10 ? `91${phone}` : phone;
  const msg = `Namaste ${property?.landlord_name || ""}, this is ${property?.tenant_name || "your tenant"}. Here is the move-in condition report for ${property?.address}. Please check it and tap Agree: ${link}`;

  return (
    <div className="sheet" id="share">
      <h3 style={{ marginBottom: 10 }}>Landlord sign-off</h3>
      {so?.decision === "dispute" ? (
        <div className="error" style={{ marginBottom: 12 }}>
          {signerName(so.signer_name)} disagreed: “{so.note}”. Fix the issues, then send a new link.
        </div>
      ) : null}

      {!ready ? (
        <p className="small" style={{ marginBottom: 0 }}>
          Record at least one room and wait for its report. Then send everything to your landlord in one link.
        </p>
      ) : so?.token && !so.decision ? (
        <div className="share-box">
          <p className="small" style={{ margin: 0 }}>
            Waiting for {property?.landlord_name || "your landlord"}. This page updates the moment they sign.
          </p>
          <div className="copyfield">
            <input readOnly value={link} aria-label="Sign-off link" onFocus={(e) => e.currentTarget.select()} />
            <button
              onClick={() => {
                navigator.clipboard?.writeText(link).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <a className="btn btn--violet btn--block" href={`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">
            Send on WhatsApp
          </a>
          <a className="btn btn--small btn--block" href={link} target="_blank" rel="noreferrer">
            Open the landlord&apos;s page
          </a>
          <button className="linkbtn small" onClick={lockSelf} disabled={busy}>
            Landlord not replying? Lock it yourself
          </button>
        </div>
      ) : (
        <div className="share-box">
          <p className="small" style={{ margin: 0 }}>
            Your landlord sees every room, issue and timestamp, then taps Agree. After that the record can&apos;t be
            edited by anyone.
          </p>
          <button className="btn btn--primary btn--block" onClick={share} disabled={busy}>
            {so?.decision === "dispute" ? "Send a new link" : "Send to landlord"}
          </button>
        </div>
      )}
      {error ? <p className="error small" style={{ marginTop: 12 }}>{error}</p> : null}
    </div>
  );
}

export default function InspectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [insp, setInsp] = useState<Inspection | null>(null);
  const [loadFailed, setLoadFailed] = useState<{ gone: boolean } | null>(null);
  const [moveInNames, setMoveInNames] = useState<string[]>([]);
  const [active, setActive] = useState<string>("");
  const [custom, setCustom] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const [extraNames, setExtraNames] = useState<string[]>([]);
  const [upload, setUpload] = useState<{ name: string; pct: number } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const scrolled = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await api<Inspection>(`/api/inspections/${id}`);
      setInsp(data);
      setLoadFailed(null);
      return data;
    } catch (e) {
      setLoadFailed({ gone: isGone(e) });
      return null;
    }
  }, [id]);

  useEffect(() => {
    load().then(async (data) => {
      if (data?.type === "move_out") {
        const p = await api<Property>(`/api/properties/${data.property_id}`).catch(() => null);
        setMoveInNames(p?.move_in?.room_names ?? []);
      }
    });
  }, [load]);

  // Poll while rooms are processing or a sign-off is pending.
  const needsPoll =
    !!insp &&
    (insp.rooms.some((r) => r.status === "queued" || r.status === "processing") ||
      (!!insp.signoff?.token && !insp.signoff.decision && !insp.locked_at));
  useEffect(() => {
    if (!needsPoll) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [needsPoll, load]);

  useEffect(() => {
    if (insp && !scrolled.current && window.location.hash === "#share") {
      scrolled.current = true;
      setTimeout(() => document.getElementById("share")?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [insp]);

  const names = useMemo(() => {
    if (!insp) return [];
    if (insp.locked_at) return insp.rooms.map((r) => r.name);
    const base = insp.type === "move_out" && moveInNames.length ? moveInNames : ROOM_PRESETS;
    const all = [...base, ...insp.rooms.map((r) => r.name), ...extraNames];
    const seen = new Set<string>();
    return all.filter((n) => {
      const k = n.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [insp, moveInNames, extraNames]);

  useEffect(() => {
    if (!active && names.length) {
      const firstTodo = names.find((n) => !insp?.rooms.some((r) => r.name.toLowerCase() === n.toLowerCase()));
      setActive(firstTodo ?? names[0]);
    }
  }, [names, active, insp]);

  if (!insp) {
    return (
      <>
        <Topbar />
        {loadFailed ? (
          <Missing gone={loadFailed.gone} />
        ) : (
          <main className="wrap">
            <p className="loading">Opening record…</p>
          </main>
        )}
      </>
    );
  }

  const roomFor = (n: string) => insp.rooms.find((r) => r.name.toLowerCase() === n.toLowerCase());
  const room = roomFor(active);
  const locked = !!insp.locked_at;
  const isOut = insp.type === "move_out";
  const p = insp.property;

  async function onFile(f: File, source: CaptureSource) {
    setError("");
    setUpload({ name: active, pct: 0 });
    const form = new FormData();
    form.append("name", active);
    form.append("capture_source", source);
    form.append("file", f);
    try {
      await uploadFile(`/api/inspections/${id}/rooms`, form, (pct) => setUpload({ name: active, pct }));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUpload(null);
    }
  }

  async function retry(r: Room) {
    await api(`/api/rooms/${r.id}/retry`, { method: "POST" }).catch((e) => setError(e.message));
    load();
  }

  async function rerecord(r: Room) {
    await api(`/api/rooms/${r.id}`, { method: "DELETE" }).catch((e) => setError(e.message));
    load();
  }

  async function compare() {
    setBusy(true);
    try {
      const c = await api<{ id: string }>(`/api/properties/${insp!.property_id}/compare`, { method: "POST" });
      router.push(`/compare/${c.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const readyCount = insp.rooms.filter((r) => r.status === "ready").length;

  return (
    <>
      <Topbar />
      <main className="page">
        <div className="wrap">
          <Link href={`/property/${insp.property_id}`} className="back">
            Back to {p?.address ?? "folder"}
          </Link>
          <div className="spread">
            <div>
              <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)" }}>{isOut ? "Move-out record" : "Move-in record"}</h1>
              <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
                {[p?.address, p?.city].filter(Boolean).join(", ")}
              </p>
            </div>
            {locked ? <Stamp main="Final" sub={fmtDate(insp.locked_at)} tone="violet" size="sm" rotate={6} /> : null}
          </div>

          <div className="inspect">
            <section aria-label="Rooms">
              <div className="chips" role="tablist" aria-label="Rooms">
                {names.map((n) => {
                  const r = roomFor(n);
                  const dot = !r ? "" : r.status === "ready" ? "ready" : r.status === "failed" ? "failed" : "busy";
                  return (
                    <button
                      key={n}
                      role="tab"
                      aria-selected={active === n}
                      className={`chip ${active === n ? "chip--on" : ""}`}
                      onClick={() => setActive(n)}
                    >
                      <span className={`chip__dot ${dot ? `chip__dot--${dot}` : ""}`} aria-hidden="true" />
                      {n}
                    </button>
                  );
                })}
                {!locked && !addingCustom ? (
                  <button className="chip chip--add" onClick={() => setAddingCustom(true)}>
                    Another room
                  </button>
                ) : null}
                {addingCustom ? (
                  <form
                    className="row"
                    style={{ gap: 8 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const n = custom.trim();
                      if (n) {
                        setExtraNames((x) => [...x, n]);
                        setActive(n);
                      }
                      setCustom("");
                      setAddingCustom(false);
                    }}
                  >
                    <input
                      className="input"
                      style={{ width: 180, padding: "6px 12px" }}
                      autoFocus
                      value={custom}
                      onChange={(e) => setCustom(e.target.value)}
                      placeholder="Study room"
                      aria-label="Room name"
                    />
                    <button className="btn btn--small">Add</button>
                  </form>
                ) : null}
              </div>

              <div style={{ marginTop: 22 }}>
                {error ? <p className="error" style={{ marginBottom: 16 }}>{error}</p> : null}

                {upload && upload.name === active ? (
                  <Recorder roomName={active} type={insp.type} onFile={onFile} upload={upload.pct} />
                ) : !room ? (
                  locked ? (
                    <p className="empty">This room wasn&apos;t recorded before the record was locked.</p>
                  ) : (
                    <Recorder roomName={active} type={insp.type} onFile={onFile} upload={null} />
                  )
                ) : room.status === "failed" ? (
                  <div className="sheet sheet--flat stack">
                    <h3>The {room.name} report didn&apos;t finish</h3>
                    <p className="error">{room.error}</p>
                    <div className="row">
                      <button className="btn btn--primary btn--small" onClick={() => retry(room)}>
                        Try again
                      </button>
                      <button className="btn btn--small" onClick={() => rerecord(room)}>
                        Record it again
                      </button>
                    </div>
                  </div>
                ) : room.status === "ready" ? (
                  <RoomReport key={room.id} room={room} locked={locked} onChanged={load} onRerecord={() => rerecord(room)} />
                ) : (
                  <Processing room={room} />
                )}
              </div>
            </section>

            <aside className="side">
              <div className="sheet">
                <h3 style={{ marginBottom: 12 }}>This record</h3>
                <div className="receipt__line">
                  <span>Rooms ready</span>
                  <strong>
                    {readyCount} of {insp.rooms.length || 0}
                  </strong>
                </div>
                <div className="receipt__line">
                  <span>Issues noted</span>
                  <strong>{insp.rooms.reduce((n, r) => n + r.issues.length, 0)}</strong>
                </div>
                <div className="receipt__line" style={{ borderBottom: 0 }}>
                  <span>Started</span>
                  <strong>{fmtDate(insp.created_at)}</strong>
                </div>
              </div>

              {isOut ? (
                <div className="sheet">
                  <h3 style={{ marginBottom: 10 }}>Get the verdict</h3>
                  <p className="small">
                    Record every room you recorded at move-in. Wapas then checks each issue against the signed move-in
                    record.
                  </p>
                  <button className="btn btn--primary btn--block" onClick={compare} disabled={insp.status !== "ready" || busy}>
                    {busy ? "Starting…" : "Compare with move-in"}
                  </button>
                </div>
              ) : (
                <SharePanel insp={insp} property={p} onUpdate={load} />
              )}
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
