// Typed helpers for the Wapas FastAPI backend (proxied through Next.js at /api).

export type Severity = "minor" | "moderate" | "major";
export type Verdict = "pre_existing" | "worsened" | "new" | "fixed";
export type InspectionType = "move_in" | "move_out";

export interface Issue {
  id: string;
  room_id: string;
  item: string;
  issue_type: string;
  severity: Severity;
  description: string;
  frame_ts: number;
  source: "vision" | "voice" | "both" | "tenant";
  voice_quote: string;
  confidence: number;
  user_edited: boolean;
  frame_url: string | null;
}

export type CaptureSource = "camera" | "file";

export interface Room {
  id: string;
  name: string;
  status: "queued" | "processing" | "ready" | "failed";
  step: string | null;
  error: string | null;
  ai_mode: "live" | "demo" | null;
  duration: number;
  sha256: string | null;
  video_bytes: number;
  capture_source: CaptureSource;
  created_at: string;
  video_url: string | null;
  poster_url: string | null;
  frames: { ts: number; url: string }[];
  transcript: { start: number; end: number; text: string }[];
  issues: Issue[];
}

export interface Signoff {
  token?: string;
  signer_name: string | null;
  decision: "agree" | "dispute" | null;
  note: string | null;
  signed_at: string | null;
  created_at?: string;
}

export interface InspectionSummary {
  id: string;
  property_id: string;
  type: InspectionType;
  locked_at: string | null;
  lock_type: "mutual" | "tenant_only" | null;
  created_at: string;
  status: "empty" | "processing" | "attention" | "ready";
  room_count: number;
  issue_count: number;
  signoff: Signoff | null;
  room_names?: string[];
}

export interface Inspection extends InspectionSummary {
  rooms: Room[];
  property?: Property;
}

export interface Property {
  id: string;
  tenant_name: string;
  address: string;
  city: string;
  rent: number;
  deposit: number;
  landlord_name: string;
  landlord_phone: string;
  is_sample: boolean;
  created_at: string;
  move_in: InspectionSummary | null;
  move_out: InspectionSummary | null;
  comparison: { id: string; status: string; fair_min: number; fair_max: number; created_at: string } | null;
}

export interface CompareItem {
  id: string;
  room_name: string;
  verdict: Verdict;
  reason: string;
  cost_min: number;
  cost_max: number;
  move_in: Issue | null;
  move_out: Issue | null;
  move_in_ref_frame: string | null;
}

export interface Comparison {
  id: string;
  property_id: string;
  status: "queued" | "processing" | "ready" | "failed";
  error: string | null;
  ai_mode: "live" | "demo" | null;
  fair_min: number;
  fair_max: number;
  created_at: string;
  items: CompareItem[];
  counts: Record<Verdict, number>;
  rate_card_note: string;
  property: Property;
  move_in: { id: string; locked_at: string | null; lock_type: string | null; signoff: Signoff | null; created_at: string };
}

/** One evidence report: a comparison plus the ids of the two records behind it. */
export interface Report extends Comparison {
  move_in_id: string;
  move_out_id: string;
}

/** What POST /api/comparisons/{id}/share returns. */
export interface ShareLink {
  token: string;
  expires_at: string | null;
  created_at: string;
}

/** GET /api/shared/{token}: the same report, read-only, with the records it lists. */
export interface SharedReport extends Report {
  records: Inspection[];
  share: { created_at: string; expires_at: string | null };
}

/** What POST /api/demo/sample returns. */
export interface SampleCase {
  property_id: string;
  move_in_id: string;
  move_out_id: string;
  comparison_id: string;
  created: boolean;
}

export interface Health {
  ok: boolean;
  ai_live: boolean;
  whisper: boolean;
  model: string;
}

export interface VerifyResult {
  match: boolean;
  sha256: string;
  room?: string;
  inspection_type?: InspectionType;
  uploaded_at?: string;
  city?: string;
  address?: string;
  locked_at?: string | null;
  lock_type?: string | null;
  signoff?: Signoff | null;
}

/** Thrown by api(): keeps the status so a page can tell "record gone" from "server asleep". */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const isGone = (e: unknown) => e instanceof ApiError && e.status === 404;

// The free backend plan sleeps when idle. A request that fails, or drags on past 4s,
// means it is probably waking up: ServerStatus listens for this and shows the banner.
export const BACKEND_WAKING = "wapas:backend-waking";
const SLOW_MS = 4000;

function waking(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(BACKEND_WAKING));
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const d = body?.detail;
    if (Array.isArray(d)) return d.map((x: { msg: string }) => x.msg).join(", ");
    if (typeof d === "string") return d;
  } catch {
    /* not JSON */
  }
  if (res.status >= 500) return "The Wapas server isn't responding. Check that the backend is running on port 8000.";
  return `Request failed (${res.status})`;
}

// Locally this is empty and Next.js proxies /api to FastAPI.
// In production set NEXT_PUBLIC_API_URL to the backend URL so big video uploads go straight to it.
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const slow = typeof window !== "undefined" ? window.setTimeout(waking, SLOW_MS) : undefined;
  try {
    const res = await fetch(API_BASE + path, {
      ...rest,
      headers: json !== undefined ? { "content-type": "application/json" } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: "no-store",
    });
    if (!res.ok) {
      if (res.status >= 500) waking();
      throw new ApiError(await errorMessage(res), res.status);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof TypeError) {
      waking(); // never reached the server at all
      throw new ApiError("The Wapas server isn't responding. Check that the backend is running on port 8000.", 0);
    }
    throw e;
  } finally {
    clearTimeout(slow);
  }
}

/** Upload with progress (fetch can't report upload progress). */
export function uploadFile<T>(path: string, form: FormData, onProgress?: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", API_BASE + path);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T);
      else {
        const d = (body as { detail?: unknown })?.detail;
        reject(new Error(typeof d === "string" ? d : `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => {
      waking();
      reject(new Error("Upload failed. Check your connection and that the backend is running."));
    };
    xhr.send(form);
  });
}

// ---------- formatting ----------
export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export const inrRange = (lo: number, hi: number) =>
  lo === hi ? inr(lo) : `${inr(lo)}–${Math.round(hi).toLocaleString("en-IN")}`;

export function fmtDate(iso?: string | null, withTime = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const label = (s: string) => s.replace(/_/g, " ");

/** A signer's name, or a plain stand-in, so a missing name never reads as "null". */
export const signerName = (n?: string | null) => (n && n.trim()) || "the landlord";

export const ITEMS = ["wall", "floor", "ceiling", "door", "window", "tile", "tap", "switchboard", "furniture", "appliance", "fixture", "other"];
export const ISSUE_TYPES = ["crack", "stain", "seepage", "broken", "missing", "scratch", "dirty", "not_working", "paint_peel", "other"];
export const SEVERITIES: Severity[] = ["minor", "moderate", "major"];

// Shown under every settlement figure, so the wording is identical everywhere.
export const SETTLEMENT_NOTE =
  "Normal wear and tear (light scuffs, faded paint) is not charged. Wapas organises evidence and is not legal advice.";

export const SOURCE_META: Record<Issue["source"], string> = {
  vision: "Camera",
  voice: "Voice",
  both: "Voice + Camera",
  tenant: "Added by you",
};

export const CAPTURE_META: Record<CaptureSource, { badge: string; note: string }> = {
  camera: { badge: "Recorded live", note: "Shot in the Wapas camera on this device, not picked from the gallery." },
  file: { badge: "Uploaded file", note: "Picked from the device, so it could have been shot or edited earlier." },
};

export const ROOM_PRESETS = ["Bedroom", "Bathroom", "Kitchen", "Hall", "Balcony"];

export const VERDICT_META: Record<Verdict, { stamp: string; hinglish: string; tone: string; plain: string }> = {
  pre_existing: { stamp: "Pre-existing", hinglish: "pehle se tha", tone: "safe", plain: "Already there at move-in. Tenant pays nothing." },
  worsened: { stamp: "Worsened", hinglish: "aur bigda", tone: "worse", plain: "Was there at move-in but got worse. Tenant pays part." },
  new: { stamp: "New damage", hinglish: "naya hai", tone: "liable", plain: "Not in the move-in record. Fair to deduct." },
  fixed: { stamp: "Fixed", hinglish: "theek ho gaya", tone: "fixed", plain: "Was at move-in, gone at move-out." },
};
