"use client";

import { useEffect, useRef, useState } from "react";
import { saveNotesAction } from "@/app/actions/jobs";
import type { JobRow } from "@/lib/db/queries";

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

  return (
    <article className="job-row">
      <header className="job-row-header">
        <a href={job.url} target="_blank" rel="noreferrer">
          {job.title}
        </a>
        <span className="job-meta">
          {job.company} · {job.source} · Track {job.track}
        </span>
        {job.appliedAt ? (
          <time dateTime={job.appliedAt} suppressHydrationWarning>
            Applied {new Date(job.appliedAt).toLocaleString()}
          </time>
        ) : null}
      </header>

      <label className="notes-label">
        Notes
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          rows={3}
        />
      </label>
    </article>
  );
}
