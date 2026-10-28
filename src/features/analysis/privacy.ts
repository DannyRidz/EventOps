import type { Plan } from "@/features/plans/schema";
import type { Interpretation } from "./contracts";
export function providerContext(plan: Plan, text: string) {
  const aliases = new Map<string, Set<string>>();
  function add(value: string, label: string) {
    if (!value) return;
    const key = value.toLocaleLowerCase("en");
    const values = aliases.get(key) ?? new Set<string>();
    values.add(label);
    aliases.set(key, values);
  }
  plan.volunteers.forEach((v, i) => {
    const label = `Volunteer ${i + 1}`;
    add(v.display_name, label);
    for (const token of v.display_name.split(/[^\p{L}\p{N}]+/u))
      if (token.length > 1) add(token, label);
    add(v.external_id, label);
  });
  for (const c of [
    "rooms",
    "sessions",
    "availability",
    "assignments",
    "dependencies",
  ] as const)
    plan[c].forEach((r, i) => add(r.external_id, `${c}-${i + 1}`));
  const names = [...aliases.keys()].sort(
    (a, b) => b.length - a.length || a.localeCompare(b),
  );
  const word = (char: string | undefined) =>
    !!char && /[\p{L}\p{N}]/u.test(char);
  function mask(value: string) {
    const positions: number[] = [];
    let masked = "";
    for (let i = 0; i < value.length;) {
      const name = names.find(
        (n) =>
          value.slice(i, i + n.length).toLocaleLowerCase("en") === n &&
          !word(value[i - 1]) &&
          !word(value[i + n.length]),
      );
      const contact = value
        .slice(i)
        .match(
          /^(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d ()-]{6,}\d)/i,
        )?.[0];
      const original =
        contact ?? (name ? value.slice(i, i + name.length) : undefined);
      if (original) {
        const labels = contact ? null : name ? aliases.get(name) : null;
        const replacement = labels
          ? labels.size === 1
            ? [...labels][0]!
            : "Ambiguous record"
          : "Contact omitted";
        for (let n = 0; n < replacement.length; n++) {
          masked += replacement[n];
          positions.push(
            i + Math.floor((n * original.length) / replacement.length),
          );
        }
        i += original.length;
      } else {
        masked += value[i];
        positions.push(i);
        i++;
      }
    }
    positions.push(value.length);
    return { text: masked, positions };
  }
  const minimized = structuredClone(plan);
  minimized.provenance = [];
  minimized.event.name = mask(minimized.event.name).text;
  minimized.event.locations = minimized.event.locations.map(
    (v) => mask(v).text,
  );
  for (const c of [
    "rooms",
    "sessions",
    "volunteers",
    "availability",
    "assignments",
    "dependencies",
  ] as const)
    minimized[c].forEach((row, i) => {
      row.external_id = `${c}-${i + 1}`;
      for (const [key, value] of Object.entries(row)) {
        if (
          [
            "name",
            "title",
            "display_name",
            "location",
            "role_tag",
            "required_role_tag",
          ].includes(key) &&
          typeof value === "string"
        )
          Object.assign(row, { [key]: mask(value).text });
        if (
          ["feature_tags", "required_feature_tags", "role_tags"].includes(
            key,
          ) &&
          Array.isArray(value)
        )
          Object.assign(row, { [key]: value.map((v) => mask(String(v)).text) });
      }
      if (c === "volunteers")
        Object.assign(row, { display_name: `Volunteer ${i + 1}` });
    });
  const { text: masked, positions } = mask(text);
  return {
    plan: minimized,
    text: masked,
    restore(value: Interpretation): Interpretation {
      return {
        ...value,
        intents: value.intents.map((r) => {
          const start = positions[r.span.start],
            end = positions[r.span.end];
          if (
            start === undefined ||
            end === undefined ||
            masked.slice(r.span.start, r.span.end) !== r.span.quote
          )
            throw new Error("INVALID_TEXT_EVIDENCE");
          return {
            ...r,
            span: {
              start: Array.from(text.slice(0, start)).length,
              end: Array.from(text.slice(0, end)).length,
              quote: text.slice(start, end),
            },
          };
        }),
      };
    },
  };
}
