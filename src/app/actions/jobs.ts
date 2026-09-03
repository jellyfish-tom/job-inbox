"use server";

import { revalidatePath } from "next/cache";
import { applyJob, rejectJob, updateNotes } from "@/lib/db/queries";

export async function applyJobAction(id: string): Promise<void> {
  await applyJob(id);
}

export async function rejectJobAction(id: string): Promise<void> {
  await rejectJob(id);
}

export async function rejectJobsAction(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => rejectJob(id)));
}

export async function saveNotesAction(id: string, notes: string): Promise<void> {
  await updateNotes(id, notes);
  revalidatePath("/");
  revalidatePath("/applied");
}
