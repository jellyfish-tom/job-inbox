"use client";

import {
  Badge,
  Button,
  Checkbox,
  CollapsibleSection,
  Spinner,
  Textarea,
  TextInput,
} from "@proteus-ui/core";
import { useState, useTransition } from "react";
import { resetFiltersAction, saveFiltersAction } from "@/app/actions/filters";
import { DEFAULT_SOURCE_FILTERS } from "@/lib/filter-defaults";
import type { SourceCapabilities, SourceField, SourceFilter, SourceId } from "@/types/job";

function fieldHint(kind: SourceField["kind"]): string {
  if (kind === "fetch") return "sent to API";
  if (kind === "match") return "checked after fetch";
  return "API and match";
}

export function FiltersEditor({
  source,
  capabilities,
  initial,
}: {
  source: SourceId;
  capabilities: SourceCapabilities;
  initial: SourceFilter;
}) {
  const [values, setValues] = useState<Record<string, string[]>>(() => ({
    ...initial.values,
  }));
  const [exclude, setExclude] = useState<string[]>(initial.exclude);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();

  function setField(id: string, tokens: string[]) {
    setStatus("idle");
    setValues((current) => ({ ...current, [id]: tokens }));
  }

  function buildFilter(): SourceFilter {
    return { values, exclude };
  }

  function applyDefaults() {
    const defaults = DEFAULT_SOURCE_FILTERS[source];
    setValues({ ...defaults.values });
    setExclude(defaults.exclude);
  }

  const body = (
    <>
      <p className="filters-hint">
        Fetch fields go to the board. Match fields keep a listing when a
        configured token hits that field. Empty field = no constraint. Missing
        or “any” values pass. Exclude is title, description, and tags only.
      </p>

      {capabilities.fields.map((field) => {
        const tokens = values[field.id] ?? [];
        if (field.valueType === "enum" && field.enumValues) {
          return (
            <div key={field.id} className="filters-group">
              <span>
                {field.label}{" "}
                <span className="filters-hint">({fieldHint(field.kind)})</span>
              </span>
              <div className="inbox-filter-toggles">
                {field.enumValues.map((option) => (
                  <Checkbox
                    key={option}
                    checked={tokens.includes(option)}
                    onCheckedChange={() =>
                      setField(
                        field.id,
                        tokens.includes(option)
                          ? tokens.filter((t) => t !== option)
                          : [...tokens, option],
                      )
                    }
                    label={option}
                  />
                ))}
              </div>
            </div>
          );
        }

        const isSingleLine = field.kind === "fetch" && field.valueType === "tokens";
        const joined = tokens.join(isSingleLine ? " " : ", ");
        return (
          <div key={field.id} className="filters-group">
            <span>
              {field.label}{" "}
              <span className="filters-hint">({fieldHint(field.kind)})</span>
            </span>
            {isSingleLine ? (
              <TextInput
                aria-label={`${source} ${field.label}`}
                value={joined}
                onValueChange={(text) =>
                  setField(field.id, text === "" ? [] : [text])
                }
              />
            ) : (
              <Textarea
                aria-label={`${source} ${field.label}`}
                value={tokens.join(", ")}
                onValueChange={(text) =>
                  setField(
                    field.id,
                    text.split(/[,\n]+/).map((k) => k.trim()),
                  )
                }
              />
            )}
          </div>
        );
      })}

      <label className="filters-exclude">
        Exclude
        <Textarea
          aria-label={`${source} exclude`}
          value={exclude.join(", ")}
          onValueChange={(text) => {
            setStatus("idle");
            setExclude(text.split(/[,\n]+/).map((k) => k.trim()));
          }}
        />
      </label>

      <div className="filters-actions">
        <Button
          type="button"
          intent="primary"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              saveFiltersAction(source, buildFilter())
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
            applyDefaults();
            startTransition(() => {
              resetFiltersAction(source)
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
    </>
  );

  return (
    <CollapsibleSection
      classNames={{ root: "filters-track" }}
      items={[
        { id: source, title: source, defaultOpen: false, children: body },
      ]}
    />
  );
}
