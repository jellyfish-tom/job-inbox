"use server";

import { refreshSource, type RefreshResult } from "@/lib/refresh";
import type { SourceId } from "@/types/job";

export async function triggerRefresh(source: SourceId): Promise<RefreshResult> {
  return refreshSource(source);
}
