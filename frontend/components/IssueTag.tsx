"use client";

import { useState } from "react";
import { api, clock, ISSUE_TYPES, ITEMS, label, SEVERITIES, SOURCE_META, type Issue } from "@/lib/api";

export function IssueTag({
  issue,
  locked,
  onSeek,
  onChange,
  onRemove,
}: {
  issue: Issue;
  locked: boolean;
  onSeek?: (ts: number) => void;
  onChange?: (i: Issue) => void;
  onRemove?: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const updated = await api<Issue>(`/api/issues/${issue.id}`, {
        method: "PATCH",
        json: {
          description: String(f.get("description") || "").trim(),
          item: f.get("item"),
          issue_type: f.get("issue_type"),
          severity: f.get("severity"),
        },
      });
      onChange?.(updated);
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/api/issues/${issue.id}`, { method: "DELETE" });
      onRemove?.(issue.id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  // Older rows can carry no source at all, so an unknown value simply shows no badge.
  const sourceLabel = issue.source ? SOURCE_META[issue.source] : undefined;

  return (
    <article className={`tag ${editing ? "tag--editing" : ""}`}>
      {issue.frame_url ? (
        <button
          type="button"
          className="tag__frame"
          onClick={() => onSeek?.(issue.frame_ts)}
          aria-label={`Play the video from ${clock(issue.frame_ts)}`}
        >
          <img src={issue.frame_url} alt={issue.description} loading="lazy" />
          <span className="tag__time">{clock(issue.frame_ts)}</span>
        </button>
      ) : null}

      {editing ? (
        <form className="form-grid" style={{ gap: 10 }} onSubmit={save}>
          <input className="input" name="description" defaultValue={issue.description} required minLength={2} maxLength={160} aria-label="Description" />
          <div className="form-grid form-grid--2" style={{ gap: 10 }}>
            <select className="select" name="item" defaultValue={issue.item} aria-label="What">
              {ITEMS.map((x) => (
                <option key={x} value={x}>
                  {label(x)}
                </option>
              ))}
            </select>
            <select className="select" name="issue_type" defaultValue={issue.issue_type} aria-label="Problem">
              {ISSUE_TYPES.map((x) => (
                <option key={x} value={x}>
                  {label(x)}
                </option>
              ))}
            </select>
          </div>
          <select className="select" name="severity" defaultValue={issue.severity} aria-label="Severity">
            {SEVERITIES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          {error ? <p className="error small">{error}</p> : null}
          <div className="row">
            <button className="btn btn--small btn--primary" disabled={busy}>
              Save
            </button>
            <button type="button" className="linkbtn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="row" style={{ gap: 8 }}>
            <span className={`badge badge--${issue.severity}`}>{issue.severity}</span>
            <span className="badge">
              {label(issue.item)}, {label(issue.issue_type)}
            </span>
            {issue.user_edited ? <span className="badge badge--violet">edited by you</span> : null}
          </div>
          <div className="tag__title">{issue.description}</div>
          {sourceLabel || issue.voice_quote ? (
            <div className="row tag__source">
              {sourceLabel ? <span className="badge">{sourceLabel}</span> : null}
              {issue.voice_quote ? <span className="tag__quote">“{issue.voice_quote}”</span> : null}
            </div>
          ) : null}
          {error ? <p className="error small">{error}</p> : null}
          {!locked ? (
            <div className="tag__actions">
              <button className="linkbtn" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button className="linkbtn" onClick={remove} disabled={busy}>
                Remove
              </button>
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
