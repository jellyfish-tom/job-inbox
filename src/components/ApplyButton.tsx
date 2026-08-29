"use client";

import { applyJobAction } from "@/app/actions/jobs";

export function ApplyButton({ id, url }: { id: string; url: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        window.open(url, "_blank", "noopener,noreferrer");
        await applyJobAction(id);
      }}
    >
      Apply
    </button>
  );
}
