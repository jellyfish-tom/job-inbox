"use client";

import { Card, IconButton, Spinner, Textarea } from "@proteus-ui/core";
import { useEffect, useRef, useState } from "react";
import { rejectJobAction, saveNotesAction } from "@/app/actions/jobs";
import { useOfferExit } from "@/hooks/use-offer-exit";
import type { JobRow } from "@/lib/db/queries";

const trashIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export function AppliedRow({ job }: { job: JobRow }) {
  const [notes, setNotes] = useState(job.notes);
  const notesRef = useRef(job.notes);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dirtyRef.current) {
      setNotes(job.notes);
      notesRef.current = job.notes;
    }
  }, [job.notes]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (dirtyRef.current) {
        dirtyRef.current = false;
        void saveNotesAction(job.id, notesRef.current);
      }
    };
  }, [job.id]);

  const { phase, which, minWidth, run } = useOfferExit();
  const busy = phase !== "idle";
  const [notesOpen, setNotesOpen] = useState(job.notes.trim().length > 0);

  function handleNotesChange(value: string) {
    setNotes(value);
    notesRef.current = value;
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      dirtyRef.current = false;
      void saveNotesAction(job.id, notesRef.current);
    }, 500);
  }

  if (phase === "gone") return null;

  return (
    <li className={`offer-exit${phase === "exiting" ? " offer-exit--out" : ""}`}>
      <div className="offer-exit-inner">
        <Card
          title={
            <div className="applied-heading">
              <a href={job.url} target="_blank" rel="noreferrer">
                {job.title}
              </a>
              <span className="job-meta">
                {job.company} · {job.source}
              </span>
              {job.appliedAt ? (
                <time dateTime={job.appliedAt} suppressHydrationWarning>
                  Applied {new Date(job.appliedAt).toLocaleString()}
                </time>
              ) : null}
              <IconButton
                type="button"
                intent="danger"
                size="sm"
                disabled={busy}
                icon={which === "delete" ? <Spinner size="sm" /> : trashIcon}
                aria-label="Remove"
                style={
                  which === "delete" && minWidth != null
                    ? { minWidth }
                    : undefined
                }
                onClick={(event) => {
                  void run(
                    "delete",
                    event.currentTarget,
                    () => rejectJobAction(job.id),
                    `Removed ${job.title}`,
                    `Could not remove ${job.title}`,
                  );
                }}
              />
            </div>
          }
        >
          <details
            className="notes-details"
            open={notesOpen}
            onToggle={(event) => setNotesOpen(event.currentTarget.open)}
          >
            <summary>Notes</summary>
            <Textarea
              value={notes}
              onValueChange={handleNotesChange}
              rows={3}
              aria-label="Notes"
            />
          </details>
        </Card>
      </div>
    </li>
  );
}
