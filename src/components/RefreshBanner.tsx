"use client";

import { Badge, Button, Section, Spinner, type BadgeIntent } from "@proteus-ui/core";
import { useState } from "react";
import { triggerRefresh } from "@/app/actions/refresh";
import type { RefreshRunRow } from "@/lib/db/queries";
import { SOURCE_IDS, type SourceId } from "@/types/job";

function statusIntent(status: RefreshRunRow["status"]): BadgeIntent {
  switch (status) {
    case "ok":
      return "primary";
    case "running":
      return "primary";
    case "failed":
      return "danger";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function RefreshBanner({ runs }: { runs: RefreshRunRow[] }) {
  const runBySource = new Map(runs.map((run) => [run.source, run]));
  const [busy, setBusy] = useState<ReadonlySet<SourceId>>(() => new Set());

  return (
    <Section className="refresh-banner" title="Sources" aria-label="Refresh status">
      <ul className="refresh-list">
        {SOURCE_IDS.map((source) => {
          const run = runBySource.get(source);
          const time = run?.finishedAt ?? run?.startedAt;
          const refreshing = busy.has(source);

          return (
            <li key={source} className="refresh-row">
              <span className="refresh-source">{source}</span>
              {run ? (
                <>
                  <Badge intent={statusIntent(run.status)}>{run.status}</Badge>
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
                <Badge>never</Badge>
              )}
              <Button
                type="button"
                size="sm"
                disabled={refreshing}
                onClick={async () => {
                  setBusy((s) => new Set(s).add(source));
                  try {
                    await triggerRefresh(source);
                  } finally {
                    setBusy((s) => {
                      const next = new Set(s);
                      next.delete(source);
                      return next;
                    });
                  }
                }}
              >
                Refresh
              </Button>
              {refreshing ? <Spinner size="sm" label="Refreshing" /> : null}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
