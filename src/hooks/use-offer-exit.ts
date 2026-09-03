"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { pushToast } from "@/components/Toasts";
import { errorMessage } from "@/lib/errors";

export const OFFER_EXIT_MS = 280;

export function useOfferExit() {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "pending" | "exiting" | "gone">(
    "idle",
  );
  const [which, setWhich] = useState<string | null>(null);
  const [minWidth, setMinWidth] = useState<number>();

  const run = useCallback(
    async (
      key: string,
      button: HTMLButtonElement,
      action: () => Promise<void>,
      ok: string,
      fail: string,
    ) => {
      if (phase !== "idle") return;
      setMinWidth(button.offsetWidth);
      setWhich(key);
      setPhase("pending");
      try {
        await action();
        setPhase("exiting");
        pushToast("ok", ok);
        const wait = window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches
          ? 0
          : OFFER_EXIT_MS;
        window.setTimeout(() => {
          setPhase("gone");
          router.refresh();
        }, wait);
      } catch (err) {
        setPhase("idle");
        setWhich(null);
        setMinWidth(undefined);
        pushToast("error", fail || errorMessage(err));
      }
    },
    [phase, router],
  );

  return { phase, which, minWidth, run };
}
