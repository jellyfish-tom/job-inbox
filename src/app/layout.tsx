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
          <form action={logout}>
            <button type="submit">Logout</button>
          </form>
        </nav>
        {children}
      </body>
    </html>
  );
}
