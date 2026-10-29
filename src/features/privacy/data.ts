import "server-only";
import { z } from "zod";
import { authenticatedClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/http";
export type LifecycleEvent = {
  id: string;
  name: string;
  status: string;
  retention_days: number;
  generation: number;
  event_date: string;
  timezone: string;
  retention_deadline: string;
  purge_after: string;
};
export type OriginalStatus = {
  artifact_id: string;
  event_id: string;
  filename: string;
  available: boolean;
};
export type Settings = {
  originals?: OriginalStatus[];
  workspace_id: string;
  generation: number;
  deletion_requested_at: string | null;
  purge_after: string | null;
  events: LifecycleEvent[];
};
export async function privacyRpc(
  name: string,
  args: Record<string, unknown> = {},
) {
  const { data, error } = await (await authenticatedClient()).rpc(name, args);
  if (error) {
    if (error.code === "54000")
      throw new ApiError(
        413,
        "EXPORT_LIMIT",
        "Workspace export exceeds the current download limit.",
      );
    if (error.code === "P0002")
      throw new ApiError(404, "NOT_FOUND", "Saved data is unavailable.");
    if (error.code === "42501")
      throw new ApiError(
        403,
        "RECENT_SIGN_IN",
        "Sign out and sign in again before requesting account deletion.",
      );
    if (error.code === "P0001")
      throw new ApiError(
        409,
        "LIFECYCLE_CHANGED",
        "This item changed, expired or reached its limit. Reload settings before trying again.",
      );
    throw new Error("SERVICE_UNAVAILABLE");
  }
  return data;
}
export async function settings(): Promise<Settings> {
  const result = await privacyRpc("lifecycle_settings");
  return {
    ...result,
    originals: result.deletion_requested_at
      ? []
      : await privacyRpc("csv_original_status"),
  };
}
export async function changeSettings(input: unknown) {
  const value = z
    .discriminatedUnion("kind", [
      z.strictObject({
        kind: z.literal("event"),
        id: z.uuid(),
        generation: z.number().int().positive(),
        action: z.enum(["archive", "trash", "restore", "reopen", "retention"]),
        days: z
          .union([z.literal(30), z.literal(90), z.literal(365)])
          .optional(),
      }),
      z.strictObject({
        kind: z.literal("account"),
        generation: z.number().int().positive(),
        action: z.enum(["delete", "recover"]),
        confirmed: z.literal(true),
      }),
    ])
    .parse(input);
  return value.kind === "event"
    ? privacyRpc("change_event_lifecycle", {
        p_event_id: value.id,
        p_generation: value.generation,
        p_action: value.action,
        p_days: value.days ?? null,
      })
    : privacyRpc("change_account_lifecycle", {
        p_generation: value.generation,
        p_action: value.action,
      });
}
