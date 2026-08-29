"use client";

import { triggerRefresh } from "@/app/actions/refresh";
import type { RefreshRunRow } from "@/lib/db/queries";
import { SOURCE_IDS } from "@/types/job";

export function RefreshBanner({ runs }: { runs: RefreshRunRow[] }) {
  const runBySource = new Map(runs.map((run) => [run.source, run]));

  return (
    <section className="refresh-banner" aria-label="Refresh status">
      <h2>Sources</h2>
      <ul className="refresh-list">
        {SOURCE_IDS.map((source) => {
          const run = runBySource.get(source);
          const time = run?.finishedAt ?? run?.startedAt;

          return (
            <li key={source} className="refresh-row">
              <span className="refresh-source">{source}</span>
              {run ? (
                <>
                  <span className={`refresh-status refresh-status-${run.status}`}>
                    {run.status}
                  </span>
                  {time ? (
                    <time dateTime={time} suppressHydrationWarning>
                      {new Date(time).toLocaleString()}
                    </time>
                  ) : null}
                  {run.status === "failed" && run.error ? (
                    <span className="refresh-error" role="alert">
                      {run.error}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="refresh-status">never</span>
              )}
              <button
                type="button"
                onClick={async () => {
                  await triggerRefresh(source);
                }}
              >
                Refresh
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
