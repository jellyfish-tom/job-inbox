import { SOURCE_IDS } from "@/types/job";
import type { SourceId } from "@/types/job";

export function authorizeRefresh(header: string | null, secret: string): boolean {
  return header === `Bearer ${secret}`;
}

export function parseSourceParam(value: string | null): SourceId | null {
  if (value && (SOURCE_IDS as readonly string[]).includes(value)) {
    return value as SourceId;
  }
  return null;
}
