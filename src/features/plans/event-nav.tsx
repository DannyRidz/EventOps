import Link from "next/link";
export function EventNav({ id }: { id: string }) {
  return (
    <nav className="actions" aria-label="Event">
      <Link href={`/events/${id}/plan`}>Plan</Link>
      <Link href={`/events/${id}/updates`}>Updates</Link>
      <Link href={`/events/${id}/briefing`}>Briefing</Link>
    </nav>
  );
}
