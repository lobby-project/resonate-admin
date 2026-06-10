import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import Wizard from "./Wizard";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { svc } = await requireAdmin();

  const { data: event } = await svc
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("is_owned", true)
    .single();
  if (!event) notFound();

  const { data: tiers } = await svc
    .from("ticket_types")
    .select("*")
    .eq("event_id", id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const { data: codes } = await svc
    .from("discount_codes")
    .select("*")
    .or(`event_id.eq.${id},event_id.is.null`)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  return <Wizard event={event} tiers={tiers ?? []} codes={codes ?? []} />;
}
