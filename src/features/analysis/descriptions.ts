import type { Plan } from "@/features/plans/schema";
import type { Intent } from "./contracts";
export function describeRequest(r: Intent, plan: Plan): string {
  const session =
    "session_id" in r
      ? plan.sessions.find((s) => s.id === r.session_id)?.title
      : "";
  const volunteer = (id: string | null) =>
    id
      ? (plan.volunteers.find((v) => v.id === id)?.display_name ?? id)
      : "None";
  switch (r.action) {
    case "move_session":
      return `Move ${session} to ${plan.rooms.find((room) => room.id === r.room_id)?.name}${r.time_choices.length ? `, at ${r.time_choices.map((t) => `${t.start} to ${t.end}`).join(" or ")}` : " at its existing time"}.`;
    case "change_time":
      return `Change ${session} to ${r.time_choices.map((t) => `${t.start} to ${t.end}`).join(" or ")}. Assignment times move by the same elapsed interval.`;
    case "cancel_session":
      return `Cancel ${session}, its assignments and linked dependencies.`;
    case "change_assignment":
      return `For ${session}, remove ${volunteer(r.from_volunteer_id)} and assign ${volunteer(r.to_volunteer_id)} as ${r.role_tag}${r.find_replacement ? " (replacement from the existing roster)" : ""}.`;
    case "record_availability":
      return `Record ${volunteer(r.volunteer_id)} as ${r.status} from ${r.interval.start} to ${r.interval.end}.`;
    case "change_room_facts":
      return `Confirm ${plan.rooms.find((room) => room.id === r.room_id)?.name}: capacity ${r.capacity ?? "unknown"}, features ${r.feature_tags.join(", ") || "none recorded"}.`;
  }
}
