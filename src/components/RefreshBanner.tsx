"use client";

import { Badge, Button, CollapsibleSection, Spinner, type BadgeIntent } from "@proteus-ui/core";
import { useState } from "react";
import { triggerRefresh } from "@/app/actions/refresh";
import type { RefreshRunRow } from "@/lib/db/queries";
import { SOURCE_IDS, type SourceId } from "@/types/job";

function RefreshStat({
  value,
  label,
}: {
  value: number | null;
  label: string;
}) {
  return (
    <span className="refresh-stat">
      <span className="refresh-stat-n">{value ?? "–"}</span> {label}
    </span>
  );
}

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
    <CollapsibleSection
      classNames={{ root: "refresh-banner" }}
      items={[
        {
          id: "sources",
          title: "Sources",
          children: (
            <ul className="refresh-list" aria-label="Refresh status">
              {SOURCE_IDS.map((source) => {
                const run = runBySource.get(source);
                const time = run?.finishedAt ?? run?.startedAt;
                const refreshing = busy.has(source);

                const counts =
                  run && run.status !== "running"
                    ? {
                        fetched: run.fetched,
                        inserted: run.inserted,
                        rejected: run.rejected,
                        skipped: run.skipped,
                      }
                    : null;

                return (
                  <li key={source} className="refresh-row">
                    <span className="refresh-source">{source}</span>
                    {run ? (
                      <Badge intent={statusIntent(run.status)}>{run.status}</Badge>
                    ) : (
                      <Badge>never</Badge>
                    )}
                    {time ? (
                      <time dateTime={time} suppressHydrationWarning>
                        {new Date(time).toLocaleString()}
                      </time>
                    ) : (
                      <span className="refresh-time-placeholder" />
                    )}
                    <RefreshStat value={counts?.fetched ?? null} label="fetched" />
                    <RefreshStat value={counts?.inserted ?? null} label="added" />
                    <RefreshStat value={counts?.rejected ?? null} label="rejected" />
                    <RefreshStat value={counts?.skipped ?? null} label="skipped" />
                    <span className="refresh-actions">
                      {refreshing ? <Spinner size="sm" label="Refreshing" /> : null}
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
                    </span>
                    {run?.status === "failed" && run.error ? (
                      <span className="refresh-error" role="alert">
                        {run.error}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ),
        },
      ]}
    />
  );
}
