"use client";

import { Checkbox, SearchBar } from "@proteus-ui/core";
import { useMemo, useState } from "react";
import { InboxRow } from "@/components/InboxRow";
import type { JobRow } from "@/lib/db/queries";
import { filterJobs } from "@/lib/inbox-filter";
import { SOURCE_IDS, type SourceId } from "@/types/job";

export function InboxFilter({ jobs }: { jobs: JobRow[] }) {
  const [text, setText] = useState("");
  const [sources, setSources] = useState<SourceId[]>([]);

  const filtered = useMemo(
    () => filterJobs(jobs, { text, sources }),
    [jobs, text, sources],
  );

  const sourceCounts = useMemo(() => {
    const counts = Object.fromEntries(SOURCE_IDS.map((id) => [id, 0])) as Record<
      SourceId,
      number
    >;
    for (const job of jobs) counts[job.source] += 1;
    return counts;
  }, [jobs]);

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
              label={`${source} (${sourceCounts[source]})`}
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
