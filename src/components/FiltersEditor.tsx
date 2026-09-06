"use client";

import {
  Badge,
  Button,
  Checkbox,
  CollapsibleSection,
  Spinner,
  Text,
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
      <Text.P className="filters-hint">
        Fetch fields go to the board. Match fields keep a listing when a
        configured token hits that field. Empty field = no constraint. Missing
        or “any” values pass. Exclude is title, description, and tags only.
      </Text.P>

      {capabilities.fields.map((field) => {
        const tokens = values[field.id] ?? [];
        if (field.valueType === "enum" && field.enumValues) {
          return (
            <div key={field.id} className="filters-group">
              <Text.Span>
                {field.label}{" "}
                <Text.Span className="filters-hint">
                  ({fieldHint(field.kind)})
                </Text.Span>
              </Text.Span>
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
            <Text.Span>
              {field.label}{" "}
              <Text.Span className="filters-hint">
                ({fieldHint(field.kind)})
              </Text.Span>
            </Text.Span>
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
        <Text.Span>Exclude</Text.Span>
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
          <Text.Span>Save</Text.Span>
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
          <Text.Span>Reset to defaults</Text.Span>
        </Button>
        {pending ? <Spinner size="sm" label="Saving" /> : null}
        {status === "saved" && (
          <Badge intent="primary" role="status">
            <Text.Span>Saved.</Text.Span>
          </Badge>
        )}
        {status === "error" && (
          <Badge intent="danger" role="status">
            <Text.Span>Save failed — try again.</Text.Span>
          </Badge>
        )}
      </div>
    </>
  );

  return (
    <CollapsibleSection classNames={{ root: "filters-track" }}>
      <CollapsibleSection.Item id={source} defaultOpen={false}>
        <CollapsibleSection.Title>
          <Text.Span>{source}</Text.Span>
        </CollapsibleSection.Title>
        <CollapsibleSection.Panel>{body}</CollapsibleSection.Panel>
      </CollapsibleSection.Item>
    </CollapsibleSection>
  );
}
