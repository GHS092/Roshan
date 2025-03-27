import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Generador de Imágenes con IA",
  description: "Crea y edita imágenes fácilmente con inteligencia artificial. Esta aplicación utiliza la tecnología de Google y está desarrollada por Luis GHS.",
  authors: [{ name: "Luis GHS" }],
  keywords: ["inteligencia artificial", "generación de imágenes", "edición de imágenes", "Gemini", "Google", "IA"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
