import { Button } from "@proteus-ui/core";
import "@proteus-ui/tokens/tokens.css";
import "@proteus-ui/theme-default/tokens.css";
import "@proteus-ui/core/styles.css";
import "@proteus-ui/theme-default/theme.css";
import { cookies } from "next/headers";
import Link from "next/link";
import { logout } from "@/app/actions/logout";
import { COOKIE, verifySession } from "@/lib/auth";
import "./globals.css";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const token = (await cookies()).get(COOKIE)?.value;
  const loggedIn = Boolean(token && (await verifySession(token)));

  return (
    <html lang="en">
      <body>
        {loggedIn ? (
          <nav className="site-nav">
            <Link href="/">Inbox</Link>
            <Link href="/applied">Applied</Link>
            <Link href="/filters">Filters</Link>
            <form action={logout}>
              <Button type="submit">Logout</Button>
            </form>
          </nav>
        ) : null}
        {children}
      </body>
    </html>
  );
}
