"use client";

import { Checkbox, SearchBar } from "@proteus-ui/core";
import { useMemo, useState } from "react";
import { InboxRow } from "@/components/InboxRow";
import type { JobRow } from "@/lib/db/queries";
import { filterJobs } from "@/lib/inbox-filter";
import { SOURCE_IDS, type SourceId, type Track } from "@/types/job";

const TRACKS: Track[] = ["A", "B"];

export function InboxFilter({ jobs }: { jobs: JobRow[] }) {
  const [text, setText] = useState("");
  const [sources, setSources] = useState<SourceId[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);

  const filtered = useMemo(
    () => filterJobs(jobs, { text, sources, tracks }),
    [jobs, text, sources, tracks],
  );

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

  return (
    <>
      <div className="inbox-filter">
        <SearchBar
          placeholder="Search title, company, skills"
          aria-label="Search inbox"
          value={text}
          onValueChange={setText}
        />
        <div className="inbox-filter-toggles" aria-label="Source filters">
          {SOURCE_IDS.map((source) => (
            <Checkbox
              key={source}
              checked={sources.includes(source)}
              onCheckedChange={() => setSources((s) => toggle(s, source))}
              label={source}
            />
          ))}
        </div>
        <div className="inbox-filter-toggles" aria-label="Track filters">
          {TRACKS.map((track) => (
            <Checkbox
              key={track}
              checked={tracks.includes(track)}
              onCheckedChange={() => setTracks((t) => toggle(t, track))}
              label={`Track ${track}`}
            />
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="empty-state">No jobs match.</p>
      ) : (
        <ul className="job-list">
          {filtered.map((job) => (
            <li key={job.id}>
              <InboxRow job={job} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
