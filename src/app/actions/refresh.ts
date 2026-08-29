"use server";

import { revalidatePath } from "next/cache";
import { refreshSource, type RefreshResult } from "@/lib/refresh";
import type { SourceId } from "@/types/job";

export async function triggerRefresh(source: SourceId): Promise<RefreshResult> {
  const result = await refreshSource(source);
  revalidatePath("/");
  revalidatePath("/applied");
  return result;
}
