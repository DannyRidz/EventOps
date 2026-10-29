import Link from "next/link";
import { settings } from "@/features/privacy/data";
import { PrivacySettings } from "@/features/privacy/settings-form";
export default async function SettingsPage() {
  return (
    <section className="workspace-page narrow stack">
      <p className="eyebrow">Your workspace</p>
      <h1>Privacy and recovery</h1>
      <p>Manage saved information and recovery deadlines.</p>
      <Link href="/privacy">Read the privacy notice</Link>
      <PrivacySettings initial={await settings()} />
    </section>
  );
}
