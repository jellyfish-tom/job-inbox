"use client";

import { Button, Dialog, KEYBOARD_KEYS, Text } from "@proteus-ui/core";
import { useEffect, type ReactNode } from "react";

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== KEYBOARD_KEYS.ENTER ||
        event.isComposing ||
        event.repeat
      ) {
        return;
      }
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "TEXTAREA") return;
      event.preventDefault();
      // Product: Enter always confirms, including when Cancel is focused.
      onConfirm();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onConfirm]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      classNames={{
        overlay: "confirm-dialog-overlay",
        panel: "confirm-dialog-panel",
      }}
    >
      <Dialog.Title>
        <Text.Span>{title}</Text.Span>
      </Dialog.Title>
      {children != null ? (
        <Dialog.Body>
          <Text.P>{children}</Text.P>
        </Dialog.Body>
      ) : null}
      <Dialog.Actions>
        <Button type="button" size="sm" onClick={onCancel}>
          <Text.Span>Cancel</Text.Span>
        </Button>
        <Button type="button" intent="danger" size="sm" onClick={onConfirm}>
          <Text.Span>{confirmLabel}</Text.Span>
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}
