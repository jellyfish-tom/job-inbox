"use client";

import { useEffect, useState } from "react";

export type ToastKind = "ok" | "error";

type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
};

let nextId = 0;
let items: Toast[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function pushToast(kind: ToastKind, message: string) {
  const id = ++nextId;
  items = [...items, { id, kind, message }];
  emit();
  window.setTimeout(() => {
    items = items.filter((toast) => toast.id !== id);
    emit();
  }, 3000);
}

export function Toasts() {
  const [toasts, setToasts] = useState(items);

  useEffect(() => {
    const sync = () => setToasts(items);
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast--${toast.kind}`}
          role="status"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
