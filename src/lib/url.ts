export function normalizeUrl(url: string): string {
  const u = new URL(url);
  u.hash = "";
  u.search = "";
  u.hostname = u.hostname.toLowerCase();
  let path = u.pathname.replace(/\/+$/, "");
  if (path === "") path = "";
  return `${u.protocol}//${u.host}${path}`;
}
