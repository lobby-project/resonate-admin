import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import CodesPanel from "../../edit/CodesPanel";

// 促销分区:折扣码管理(复用向导面板)。
export default async function EventPromosSection({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { svc } = await requireAdmin();

  const { data: ev } = await svc.from("events").select("id, event_type").eq("id", id).eq("is_owned", true).single();
  if (!ev) notFound();

  const { data: codes } = await svc
    .from("discount_codes")
    .select("*")
    .or(`event_id.eq.${id},event_id.is.null`)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  return (
    <div className="panel">
      <CodesPanel event={ev} codes={codes ?? []} />
    </div>
  );
}
