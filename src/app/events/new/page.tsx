import { EventForm } from "@/features/events/event-form";
export default function NewEvent() {
  return (
    <section className="workspace-page narrow stack">
      <p className="eyebrow">Event setup</p>
      <h1>Start with the essentials.</h1>
      <p>Set the boundaries everyone will plan within.</p>
      <EventForm />
    </section>
  );
}
