import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "EventOps | Keep your event plan clear",
    template: "%s | EventOps",
  },
  description:
    "Keep schedules, rooms, volunteer assignments, and operational changes clear. Review each change before it becomes official.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
