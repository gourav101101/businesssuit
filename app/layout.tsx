import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
    title: "Newsdesk — City Publishing Studio",
    description: "Your local newsroom, beautifully organized. Import, review, design and schedule city news.",
    icons: {
        icon: "/favicon.svg",
        shortcut: "/favicon.svg",
    },
};
export default function RootLayout({ children, }: Readonly<{
    children: React.ReactNode;
}>) {
    return (<html lang="en">
      <body className="antialiased">{children}</body>
    </html>);
}
