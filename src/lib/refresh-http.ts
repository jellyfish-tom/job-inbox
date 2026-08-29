import type { SourceId } from "@/types/job";

export function authorizeRefresh(header: string | null, secret: string): boolean {
  return header === `Bearer ${secret}`;
}

export function parseSourceParam(value: string | null): SourceId | null {
  const allowed: SourceId[] = [
    "jungle",
    "himalayas",
    "wwr",
    "justjoin",
    "nofluff",
    "remoteok",
  ];
  if (value && (allowed as string[]).includes(value)) return value as SourceId;
  return null;
}
