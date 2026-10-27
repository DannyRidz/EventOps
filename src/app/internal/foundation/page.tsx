import { notFound } from "next/navigation";
import { FoundationChecks } from "./foundation-checks";
export const dynamic = "force-dynamic";
export default function FoundationPage() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.EVENTOPS_INTERNAL_UI !== "1"
  )
    notFound();
  return <FoundationChecks />;
}
