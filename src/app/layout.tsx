import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lecture Attendance",
  description: "QR-based lecture attendance system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
