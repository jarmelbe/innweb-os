import "./globals.css";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://os.innweb.co"),
  title: "INNweb OS | Opportunity Finder",
  description: "Bilingual website and infrastructure audit intelligence by INNweb.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}