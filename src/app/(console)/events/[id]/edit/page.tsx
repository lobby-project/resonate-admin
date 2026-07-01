import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import BasicInfoForm from "./BasicInfoForm";
import BackLink from "../../../BackLink";

// 创建 / 编辑活动基本信息(单页,步0-4)。票档/促销/设置/发布在运营中心。
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

  return (
    <>
      <BackLink href="/events" label="Events" />
      <BasicInfoForm event={event} />
    </>
  );
}
