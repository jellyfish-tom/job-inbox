"use server";

import { revalidatePath } from "next/cache";
import { resetFilterConfig, saveFilterConfig } from "@/lib/db/queries";
import { sanitizeTrackFilter } from "@/lib/filter-defaults";
import type { Track, TrackFilter } from "@/types/job";

export async function saveFiltersAction(
  track: Track,
  config: TrackFilter,
): Promise<void> {
  await saveFilterConfig(track, sanitizeTrackFilter(config));
  revalidatePath("/filters");
}

export async function resetFiltersAction(track: Track): Promise<void> {
  await resetFilterConfig(track);
  revalidatePath("/filters");
}
