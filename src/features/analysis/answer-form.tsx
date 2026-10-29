"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { planRequest } from "@/features/plans/editor";
export function AnswerForm({
  eventId,
  jobId,
  digest,
  generation,
  questions,
}: {
  eventId: string;
  jobId: string;
  digest: string;
  generation: number;
  questions: string[];
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [question, setQuestion] = useState(0),
    [answer, setAnswer] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!answer) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [answer]);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        try {
          const d = await planRequest(
            `/api/events/${eventId}/analysis/${jobId}/answers`,
            {
              result_digest: digest,
              generation,
              question_index: question,
              answer,
              idempotency_key: key,
            },
          );
          setAnswer("");
          router.push(`/events/${eventId}/updates/${d.id}`);
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not save answer.");
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="field">
        Question
        <select
          value={question}
          disabled={pending}
          onChange={(e) => {
            setQuestion(Number(e.target.value));
            setKey(crypto.randomUUID());
          }}
        >
          {questions.map((q, i) => (
            <option key={i} value={i}>
              {q}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Your answer
        <textarea
          aria-describedby={error ? "answer-error" : undefined}
          required
          maxLength={2000}
          value={answer}
          disabled={pending}
          onChange={(e) => {
            setAnswer(e.target.value);
            setKey(crypto.randomUUID());
          }}
        />
      </label>
      <p>
        Saving adds your answer to the clarified draft. Review and confirm that
        exact text before another analysis. Contradictory facts still need your
        explicit correction.
      </p>
      <Button type="submit" disabled={pending || !answer.trim()}>
        Save answer and review text
      </Button>
      {error && (
        <p id="answer-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
