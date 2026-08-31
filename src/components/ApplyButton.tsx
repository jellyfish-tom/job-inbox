"use client";

import { Button } from "@proteus-ui/core";
import { applyJobAction } from "@/app/actions/jobs";

export function ApplyButton({ id, url }: { id: string; url: string }) {
  return (
    <Button
      type="button"
      intent="primary"
      onClick={async () => {
        window.open(url, "_blank", "noopener,noreferrer");
        await applyJobAction(id);
      }}
    >
      Apply
    </Button>
  );
}
