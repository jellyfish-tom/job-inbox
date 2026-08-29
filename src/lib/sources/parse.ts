export function pickArray(data: unknown, keys: string[]): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[];
      }
    }
  }
  return [];
}
