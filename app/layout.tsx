import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "AeroReserva · Tu próximo vuelo",
  description:
    "Reservas y coordinación de vuelos de instrucción del club aéreo.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
