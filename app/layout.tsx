import type { Metadata } from "next";
export const metadata: Metadata = { title: "vistgo · Panel de Informes" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
