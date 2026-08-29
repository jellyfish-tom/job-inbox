import type { SourceId } from "@/types/job";
import type { SourceAdapter } from "./types";
import { himalayasAdapter as himalayas } from "./himalayas";
import { jungle } from "./jungle";
import { justjoin } from "./justjoin";
import { nofluff } from "./nofluff";
import { remoteokAdapter as remoteok } from "./remoteok";
import { wwrAdapter as wwr } from "./wwr";

export const adapters: Record<SourceId, SourceAdapter> = {
  himalayas,
  wwr,
  remoteok,
  jungle,
  justjoin,
  nofluff,
};

export function getAdapter(source: SourceId): SourceAdapter {
  const a = adapters[source];
  if (!a) throw new Error("unknown source");
  return a;
}
