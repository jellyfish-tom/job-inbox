export function normalizeUrl(url: string): string {
  const u = new URL(url);
  u.hash = "";
  u.search = "";
  u.hostname = u.hostname.toLowerCase();
  const path = u.pathname.replace(/\/+$/, "");
  return `${u.protocol}//${u.host}${path}`;
}

export function requireUrl(value: string | null | undefined): string {
  if (!value || !URL.canParse(value)) {
    throw new Error("unparseable listing");
  }
  return value;
}
