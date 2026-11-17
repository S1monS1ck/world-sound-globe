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
      <body className="antialiased">
        {/* Liquid glass edge refraction filter, adapted from the open-source
            recreations of Apple's iOS 26 material (github.com/nikdelvin/liquid-glass,
            github.com/rdev/liquid-glass-react). An SVG displacement map bends the
            backdrop inward near the panel edges; Chromium applies it through
            backdrop-filter: url() while other engines keep the frosted fallback. */}
        <svg aria-hidden="true" focusable="false" style={{ position: "absolute", width: 0, height: 0 }}>
          <filter id="liquid-glass-edge" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feImage
              preserveAspectRatio="none"
              href="data:image/svg+xml;utf8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='320'%20height='200'%3E%3Cdefs%3E%3ClinearGradient%20id='Y'%20x1='0'%20x2='0'%20y1='2%25'%20y2='98%25'%3E%3Cstop%20offset='0%25'%20stop-color='%230F0'/%3E%3Cstop%20offset='100%25'%20stop-color='%23000'/%3E%3C/linearGradient%3E%3ClinearGradient%20id='X'%20x1='2%25'%20x2='98%25'%20y1='0'%20y2='0'%3E%3Cstop%20offset='0%25'%20stop-color='%23F00'/%3E%3Cstop%20offset='100%25'%20stop-color='%23000'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width='320'%20height='200'%20fill='%23808080'/%3E%3Cg%20filter='blur(2px)'%3E%3Crect%20width='320'%20height='200'%20fill='%23000080'/%3E%3Crect%20width='320'%20height='200'%20fill='url(%23Y)'%20style='mix-blend-mode:screen'/%3E%3Crect%20width='320'%20height='200'%20fill='url(%23X)'%20style='mix-blend-mode:screen'/%3E%3Crect%20x='14'%20y='14'%20width='292'%20height='172'%20fill='%23808080'%20rx='20'%20ry='20'%20filter='blur(14px)'/%3E%3C/g%3E%3C/svg%3E"
              result="map"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale="72"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </svg>
        {children}
      </body>
    </html>
  );
}
