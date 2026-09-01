"use server";

import { revalidatePath } from "next/cache";
import { resetSourceFilter, saveSourceFilter } from "@/lib/db/queries";
import { sanitizeSourceFilter } from "@/lib/filter-defaults";
import { getAdapter } from "@/lib/sources/registry";
import type { SourceFilter, SourceId } from "@/types/job";

export async function saveFiltersAction(
  source: SourceId,
  config: SourceFilter,
): Promise<void> {
  const allowed = getAdapter(source).capabilities.fields.map((f) => f.id);
  await saveSourceFilter(source, sanitizeSourceFilter(config, allowed));
  revalidatePath("/filters");
}

export async function resetFiltersAction(source: SourceId): Promise<void> {
  await resetSourceFilter(source);
  revalidatePath("/filters");
}
