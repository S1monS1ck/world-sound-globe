import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "World / Sound — A living atlas of music",
  description:
    "Explore a cinematic 3D earth and discover the sounds, cities and local voices of the world.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
