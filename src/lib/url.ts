export function normalizeUrl(url: string): string {
  const u = new URL(url);
  u.hash = "";
  u.search = "";
  u.hostname = u.hostname.toLowerCase();
  const path = u.pathname.replace(/\/+$/, "");
  return `${u.protocol}//${u.host}${path}`;
}
