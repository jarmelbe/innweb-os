import "./globals.css";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://os.innweb.co"),
  title: "InnWeb Diagnostics: Intelligence / Rank Pulse",
  description: "InnWeb Diagnostics turns website and infrastructure signals into clear, evidence-based priorities and opportunities.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}