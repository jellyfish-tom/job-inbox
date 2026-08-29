"use client";

import { useState, useTransition } from "react";
import { resetFiltersAction, saveFiltersAction } from "@/app/actions/filters";
import { DEFAULT_FILTERS } from "@/lib/filter-defaults";
import type { Track, TrackFilter } from "@/types/job";

export function FiltersEditor({
  track,
  initial,
}: {
  track: Track;
  initial: TrackFilter;
}) {
  const [config, setConfig] = useState<TrackFilter>(initial);
  const [pending, startTransition] = useTransition();

  function updateGroupLabel(index: number, label: string) {
    setConfig((c) => {
      const requiredGroups = c.requiredGroups.map((g, i) =>
        i === index ? { ...g, label } : g,
      );
      return { ...c, requiredGroups };
    });
  }

  function updateGroupKeywords(index: number, text: string) {
    const keywords = text.split(/[,\n]+/).map((k) => k.trim());
    setConfig((c) => {
      const requiredGroups = c.requiredGroups.map((g, i) =>
        i === index ? { ...g, keywords } : g,
      );
      return { ...c, requiredGroups };
    });
  }

  function addGroup() {
    setConfig((c) => ({
      ...c,
      requiredGroups: [...c.requiredGroups, { label: "New group", keywords: [] }],
    }));
  }

  function removeGroup(index: number) {
    setConfig((c) => ({
      ...c,
      requiredGroups: c.requiredGroups.filter((_, i) => i !== index),
    }));
  }

  function updateExclude(text: string) {
    const exclude = text.split(/[,\n]+/).map((k) => k.trim());
    setConfig((c) => ({ ...c, exclude }));
  }

  return (
    <section className="filters-track">
      <h2>Track {track}</h2>

      <p className="filters-hint">
        A job is kept when it matches at least one keyword in every group and no
        exclude keyword. Keywords are comma-separated, case-insensitive.
      </p>

      {config.requiredGroups.map((group, index) => (
        <div key={index} className="filters-group">
          <input
            aria-label={`Track ${track} group ${index + 1} label`}
            value={group.label}
            onChange={(e) => updateGroupLabel(index, e.target.value)}
          />
          <textarea
            aria-label={`Track ${track} group ${index + 1} keywords`}
            value={group.keywords.join(", ")}
            onChange={(e) => updateGroupKeywords(index, e.target.value)}
          />
          <button type="button" onClick={() => removeGroup(index)}>
            Remove group
          </button>
        </div>
      ))}

      <button type="button" onClick={addGroup}>
        Add group
      </button>

      <label className="filters-exclude">
        Exclude
        <textarea
          aria-label={`Track ${track} exclude`}
          value={config.exclude.join(", ")}
          onChange={(e) => updateExclude(e.target.value)}
        />
      </label>

      <div className="filters-actions">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              void saveFiltersAction(track, config);
            })
          }
        >
          Save
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setConfig(DEFAULT_FILTERS[track]);
            startTransition(() => {
              void resetFiltersAction(track);
            });
          }}
        >
          Reset to defaults
        </button>
      </div>
    </section>
  );
}
