"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function SignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            const response = await fetch("/api/auth/sign-out", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            if (!response.ok) throw new Error();
            router.push("/sign-in");
            router.refresh();
          } catch {
            setError("Could not sign out. Please try again.");
            setPending(false);
          }
        }}
      >
        {pending ? "Signing out…" : "Sign out"}
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
