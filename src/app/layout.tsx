import { Button } from "@proteus-ui/core";
import "@proteus-ui/tokens/tokens.css";
import "@proteus-ui/theme-default/tokens.css";
import "@proteus-ui/core/styles.css";
import "@proteus-ui/theme-default/theme.css";
import Link from "next/link";
import { logout } from "@/app/actions/logout";
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <nav className="site-nav">
          <Link href="/">Inbox</Link>
          <Link href="/applied">Applied</Link>
          <Link href="/filters">Filters</Link>
          <form action={logout}>
            <Button type="submit">Logout</Button>
          </form>
        </nav>
        {children}
      </body>
    </html>
  );
}
