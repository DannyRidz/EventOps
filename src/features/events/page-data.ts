import "server-only";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/http";
import { readPlan } from "./data";
export async function pageDraft(id: string) {
  try {
    return await readPlan(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function pageOfficialPlan(id: string, revisionId?: string) {
  try {
    return await (
      await import("@/features/plans/data")
    ).officialPlan(id, revisionId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
