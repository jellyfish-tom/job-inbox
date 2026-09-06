"use client";

import {
  Badge,
  Button,
  CollapsibleSection,
  Spinner,
  Text,
  type BadgeIntent,
} from "@proteus-ui/core";
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
    <Text.Span className="refresh-stat">
      <Text.Span className="refresh-stat-n">{value ?? "–"}</Text.Span>
      <Text.Span>{` ${label}`}</Text.Span>
    </Text.Span>
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
    <CollapsibleSection classNames={{ root: "refresh-banner" }}>
      <CollapsibleSection.Item id="sources">
        <CollapsibleSection.Title>
          <Text.Span>Sources</Text.Span>
        </CollapsibleSection.Title>
        <CollapsibleSection.Panel>
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
                  <Text.Span className="refresh-source">{source}</Text.Span>
                  {run ? (
                    <Badge intent={statusIntent(run.status)}>
                      <Text.Span>{run.status}</Text.Span>
                    </Badge>
                  ) : (
                    <Badge>
                      <Text.Span>never</Text.Span>
                    </Badge>
                  )}
                  {time ? (
                    <Text.Time dateTime={time} suppressHydrationWarning>
                      {new Date(time).toLocaleString()}
                    </Text.Time>
                  ) : (
                    <Text.Span className="refresh-time-placeholder" />
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
                      <Text.Span>Refresh</Text.Span>
                    </Button>
                  </span>
                  {run?.status === "failed" && run.error ? (
                    <Text.Span className="refresh-error" role="alert">
                      {run.error}
                    </Text.Span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CollapsibleSection.Panel>
      </CollapsibleSection.Item>
    </CollapsibleSection>
  );
}
