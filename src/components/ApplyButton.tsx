"use client";

import { Button, Spinner } from "@proteus-ui/core";

export function ApplyButton({
  url,
  pending,
  disabled,
  minWidth,
  onApply,
}: {
  url: string;
  pending: boolean;
  disabled?: boolean;
  minWidth?: number;
  onApply: (button: HTMLButtonElement) => void;
}) {
  return (
    <Button
      type="button"
      intent="primary"
      size="sm"
      disabled={disabled}
      style={minWidth != null ? { minWidth } : undefined}
      onClick={(event) => {
        window.open(url, "_blank", "noopener,noreferrer");
        onApply(event.currentTarget);
      }}
    >
      {pending ? <Spinner size="sm" /> : "Apply"}
    </Button>
  );
}
