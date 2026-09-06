import { Button, Semantic, Text } from "@proteus-ui/core";
import "@proteus-ui/tokens/tokens.css";
import "@proteus-ui/theme-default/tokens.css";
import "@proteus-ui/core/styles.css";
import "@proteus-ui/theme-default/theme.css";
import { cookies } from "next/headers";
import Link from "next/link";
import { logout } from "@/app/actions/logout";
import { Toasts } from "@/components/Toasts";
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
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {loggedIn ? (
          <Semantic.Nav className="site-nav" aria-label="Site">
            <Link href="/">
              <Text.Span>Inbox</Text.Span>
            </Link>
            <Link href="/applied">
              <Text.Span>Applied</Text.Span>
            </Link>
            <Link href="/filters">
              <Text.Span>Filters</Text.Span>
            </Link>
            <form action={logout}>
              <Button type="submit">
                <Text.Span>Logout</Text.Span>
              </Button>
            </form>
          </Semantic.Nav>
        ) : null}
        {children}
        <Toasts />
      </body>
    </html>
  );
}
