"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [attested, setAttested] = useState(false),
    [sent, setSent] = useState(false),
    [workspacePending, setWorkspacePending] = useState(false),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(workspacePending ? "bootstrap" : sent ? "verify" : "code");
  }
  async function run(action: "code" | "verify" | "bootstrap") {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        action === "bootstrap"
          ? "/api/workspace/bootstrap"
          : `/api/auth/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code, attested }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        if (data.retry_after_seconds) setCooldown(data.retry_after_seconds);
        throw new Error(data.message);
      }
      if (data.workspace_pending) {
        setWorkspacePending(true);
        throw new Error(
          "Your email is verified. Please retry opening your workspace.",
        );
      }
      if (action === "verify" || action === "bootstrap") {
        router.push("/events");
        router.refresh();
        return;
      }
      setSent(true);
      setCooldown(60);
      setMessage(
        "A code was requested. Check your email, including spam. It expires in 10 minutes.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not connect. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="stack form-panel" onSubmit={submit} aria-busy={pending}>
      <TextField
        label="Email address"
        type="email"
        autoComplete="email"
        name="email"
        required
        maxLength={254}
        value={email}
        readOnly={sent}
        onChange={(e) => setEmail(e.target.value)}
      />
      <label className="check-label">
        <input
          type="checkbox"
          checked={attested}
          required
          onChange={(e) => setAttested(e.target.checked)}
        />{" "}
        <span>
          I am 18 or older and authorized to organize this event and handle its
          adult roster.
        </span>
      </label>
      <p className="field-hint">
        By continuing, you accept the <Link href="/terms">account terms</Link>{" "}
        and acknowledge the <Link href="/privacy">privacy notice</Link>.
      </p>
      {sent && !workspacePending && (
        <TextField
          label="Six digit email code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          hint="Use the latest code sent to this email address."
        />
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <Button type="submit" disabled={pending || !attested}>
        {pending
          ? "Please wait…"
          : workspacePending
            ? "Retry opening workspace"
            : sent
              ? "Verify and open workspace"
              : "Send email code"}
      </Button>
      {sent && !workspacePending && (
        <div className="actions">
          <Button
            variant="secondary"
            disabled={pending || cooldown > 0}
            onClick={() => run("code")}
          >
            {cooldown ? `Resend in ${cooldown}s` : "Resend code"}
          </Button>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setSent(false);
              setCode("");
              setMessage("");
              setError("");
            }}
          >
            Use another email
          </Button>
        </div>
      )}
    </form>
  );
}
