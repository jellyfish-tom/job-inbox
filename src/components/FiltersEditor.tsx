"use client";

import { Badge, Button, Section, Spinner, Textarea, TextInput } from "@proteus-ui/core";
import { useState, useTransition } from "react";
import { resetFiltersAction, saveFiltersAction } from "@/app/actions/filters";
import { DEFAULT_FILTERS } from "@/lib/filter-defaults";
import type { Track, TrackFilter } from "@/types/job";

type EditorGroup = { id: string; label: string; keywords: string[] };

function toEditorGroups(groups: TrackFilter["requiredGroups"]): EditorGroup[] {
  return groups.map((g) => ({ id: crypto.randomUUID(), ...g }));
}

export function FiltersEditor({
  track,
  initial,
}: {
  track: Track;
  initial: TrackFilter;
}) {
  const [groups, setGroups] = useState<EditorGroup[]>(() =>
    toEditorGroups(initial.requiredGroups),
  );
  const [exclude, setExclude] = useState<string[]>(initial.exclude);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();

  function updateGroupLabel(id: string, label: string) {
    setStatus("idle");
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, label } : g)));
  }

  function updateGroupKeywords(id: string, text: string) {
    setStatus("idle");
    const keywords = text.split(/[,\n]+/).map((k) => k.trim());
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, keywords } : g)));
  }

  function addGroup() {
    setStatus("idle");
    setGroups((gs) => [
      ...gs,
      { id: crypto.randomUUID(), label: "New group", keywords: [] },
    ]);
  }

  function removeGroup(id: string) {
    setStatus("idle");
    setGroups((gs) => gs.filter((g) => g.id !== id));
  }

  function updateExclude(text: string) {
    setStatus("idle");
    setExclude(text.split(/[,\n]+/).map((k) => k.trim()));
  }

  function buildTrackFilter(): TrackFilter {
    return {
      requiredGroups: groups.map(({ label, keywords }) => ({ label, keywords })),
      exclude,
    };
  }

  return (
    <Section className="filters-track" title={`Track ${track}`}>
      <p className="filters-hint">
        A job is kept when it matches at least one keyword in every group and no
        exclude keyword. Keywords are comma- or newline-separated, case-insensitive.
      </p>

      {groups.map((group, index) => (
        <div key={group.id} className="filters-group">
          <TextInput
            aria-label={`Track ${track} group ${index + 1} label`}
            value={group.label}
            onValueChange={(label) => updateGroupLabel(group.id, label)}
          />
          <Textarea
            aria-label={`Track ${track} group ${index + 1} keywords`}
            value={group.keywords.join(", ")}
            onValueChange={(text) => updateGroupKeywords(group.id, text)}
          />
          <Button
            type="button"
            intent="danger"
            size="sm"
            onClick={() => removeGroup(group.id)}
          >
            Remove group
          </Button>
        </div>
      ))}

      <Button type="button" onClick={addGroup}>
        Add group
      </Button>

      <label className="filters-exclude">
        Exclude
        <Textarea
          aria-label={`Track ${track} exclude`}
          value={exclude.join(", ")}
          onValueChange={updateExclude}
        />
      </label>

      <div className="filters-actions">
        <Button
          type="button"
          intent="primary"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              saveFiltersAction(track, buildTrackFilter())
                .then(() => setStatus("saved"))
                .catch(() => setStatus("error"));
            })
          }
        >
          Save
        </Button>
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            const defaults = DEFAULT_FILTERS[track];
            setGroups(toEditorGroups(defaults.requiredGroups));
            setExclude(defaults.exclude);
            startTransition(() => {
              resetFiltersAction(track)
                .then(() => setStatus("saved"))
                .catch(() => setStatus("error"));
            });
          }}
        >
          Reset to defaults
        </Button>
        {pending ? <Spinner size="sm" label="Saving" /> : null}
        {status === "saved" && (
          <Badge intent="primary" role="status">
            Saved.
          </Badge>
        )}
        {status === "error" && (
          <Badge intent="danger" role="status">
            Save failed — try again.
          </Badge>
        )}
      </div>
    </Section>
  );
}
