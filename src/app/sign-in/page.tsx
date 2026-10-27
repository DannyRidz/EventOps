import { PageShell } from "@/components/ui/page-shell";
import { SignInForm } from "@/features/auth/sign-in-form";
export default function SignIn() {
  return (
    <PageShell>
      <section className="workspace-page narrow stack">
        <p className="eyebrow">Your private workspace</p>
        <h1>Sign in with your email.</h1>
        <p>We will send a code. No password to remember.</p>
        <SignInForm />
      </section>
    </PageShell>
  );
}
