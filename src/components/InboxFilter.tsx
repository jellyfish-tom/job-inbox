"use client";

import { Button, Checkbox, SearchBar, Spinner, useConfirmation } from "@proteus-ui/core";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { rejectJobsAction } from "@/app/actions/jobs";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { InboxRow } from "@/components/InboxRow";
import { pushToast } from "@/components/Toasts";
import { OFFER_EXIT_MS } from "@/hooks/use-offer-exit";
import type { JobRow } from "@/lib/db/queries";
import { errorMessage } from "@/lib/errors";
import { filterJobs } from "@/lib/inbox-filter";
import { SOURCE_IDS, type SourceId } from "@/types/job";

const dismissedInboxIds = new Set<string>();
const exitingInboxIds = new Set<string>();

export function InboxFilter({ jobs }: { jobs: JobRow[] }) {
  const router = useRouter();
  const confirm = useConfirmation();
  const [text, setText] = useState("");
  const [sources, setSources] = useState<SourceId[]>(() => [...SOURCE_IDS]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [exiting, setExiting] = useState<ReadonlySet<string>>(
    () => new Set(exitingInboxIds),
  );
  const [hidden, setHidden] = useState<ReadonlySet<string>>(
    () => new Set(dismissedInboxIds),
  );
  const [rejecting, setRejecting] = useState(false);

  const filtered = useMemo(
    () => filterJobs(jobs, { text, sources }),
    [jobs, text, sources],
  );
  const visible = useMemo(
    () =>
      filtered.filter(
        (job) => !hidden.has(job.id) && !dismissedInboxIds.has(job.id),
      ),
    [filtered, hidden],
  );

  useEffect(() => {
    const live = new Set(jobs.map((job) => job.id));
    for (const id of [...dismissedInboxIds]) {
      if (!live.has(id)) dismissedInboxIds.delete(id);
    }
    for (const id of [...exitingInboxIds]) {
      if (!live.has(id)) exitingInboxIds.delete(id);
    }
    setHidden((current) => {
      if (current.size === 0) return current;
      const next = new Set([...current].filter((id) => live.has(id)));
      return next.size === current.size ? current : next;
    });
    setExiting((current) => {
      if (current.size === 0) return current;
      const next = new Set([...current].filter((id) => live.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [jobs]);

  const sourceCounts = useMemo(() => {
    const counts = Object.fromEntries(SOURCE_IDS.map((id) => [id, 0])) as Record<
      SourceId,
      number
    >;
    for (const job of jobs) counts[job.source] += 1;
    return counts;
  }, [jobs]);

  const selectedVisible = useMemo(
    () => visible.filter((job) => selected.has(job.id)),
    [visible, selected],
  );
  const allVisibleSelected =
    visible.length > 0 && selectedVisible.length === visible.length;
  const someVisibleSelected =
    selectedVisible.length > 0 && !allVisibleSelected;

  function setJobSelected(id: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllVisible(on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const job of visible) {
        if (on) next.add(job.id);
        else next.delete(job.id);
      }
      return next;
    });
  }

  function rejectSelected() {
    const ids = selectedVisible.map((job) => job.id);
    if (ids.length === 0 || rejecting) return;
    void confirm.ask().then(async (ok) => {
      if (!ok) return;
      setRejecting(true);
      try {
        await rejectJobsAction(ids);
        for (const id of ids) exitingInboxIds.add(id);
        setExiting(new Set(ids));
        pushToast(
          "ok",
          ids.length === 1
            ? `Rejected ${selectedVisible[0].title}`
            : `Rejected ${ids.length} offers`,
        );
        const wait = window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches
          ? 0
          : OFFER_EXIT_MS;
        window.setTimeout(() => {
          setSelected((current) => {
            const next = new Set(current);
            for (const id of ids) next.delete(id);
            return next;
          });
          for (const id of ids) {
            dismissedInboxIds.add(id);
            exitingInboxIds.delete(id);
          }
          setHidden((current) => {
            const next = new Set(current);
            for (const id of ids) next.add(id);
            return next;
          });
          setRejecting(false);
          router.refresh();
        }, wait);
      } catch (err) {
        setRejecting(false);
        pushToast("error", `Could not reject offers: ${errorMessage(err)}`);
      }
    });
  }

  const rejectCount = selectedVisible.length;

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
              onCheckedChange={(on) =>
                setSources((s) =>
                  on
                    ? s.includes(source)
                      ? s
                      : [...s, source]
                    : s.filter((v) => v !== source),
                )
              }
              label={`${source} (${sourceCounts[source]})`}
            />
          ))}
        </div>
        {visible.length > 0 ? (
          <div className="inbox-select-bar">
            <Checkbox
              checked={allVisibleSelected}
              indeterminate={someVisibleSelected}
              onCheckedChange={toggleAllVisible}
              disabled={rejecting || confirm.open}
              label={
                allVisibleSelected
                  ? `All ${visible.length} selected`
                  : rejectCount > 0
                    ? `${rejectCount} selected`
                    : "Select all"
              }
            />
            <Button
              type="button"
              intent="danger"
              size="sm"
              disabled={rejectCount === 0 || rejecting}
              onClick={rejectSelected}
            >
              {rejecting ? <Spinner size="sm" /> : "Reject"}
            </Button>
          </div>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="empty-state">No jobs match.</p>
      ) : (
        <ul className="job-list">
          {visible.map((job) => (
            <InboxRow
              key={job.id}
              job={job}
              selected={selected.has(job.id)}
              onSelectedChange={(on) => setJobSelected(job.id, on)}
              exiting={exiting.has(job.id)}
              selectDisabled={rejecting || confirm.open}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirm.open}
        title={
          rejectCount === 1 ? "Reject this offer?" : `Reject ${rejectCount} offers?`
        }
        confirmLabel="Reject"
        onConfirm={confirm.confirm}
        onCancel={confirm.cancel}
      >
        {rejectCount === 1
          ? selectedVisible[0]?.title
          : `${rejectCount} selected`}
      </ConfirmDialog>
    </>
  );
}
