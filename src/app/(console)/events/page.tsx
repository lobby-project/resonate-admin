import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createDraftAndRedirect } from "./actions";

// 活动列表:草稿 + 已发布(只看自办 is_owned)
export default async function EventsListPage() {
  const { svc } = await requireAdmin();

  const { data: events } = await svc
    .from("events")
    .select("id, artist, status, event_type, date_tbd, event_date, poster_url")
    .eq("is_owned", true)
    .order("created_at", { ascending: false } as never)
    .limit(100);

  const drafts = (events ?? []).filter((e) => e.status === "draft");
  const published = (events ?? []).filter((e) => e.status !== "draft");

  return (
    <div>
      <div className="page-h">
        <h1>EVENTS</h1>
        <form action={createDraftAndRedirect}>
          <button className="btn-green">+ NEW EVENT</button>
        </form>
      </div>

      {drafts.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="small muted" style={{ letterSpacing: ".14em", marginBottom: 10 }}>
            DRAFTS
          </div>
          {drafts.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </div>
      )}

      <div className="small muted" style={{ letterSpacing: ".14em", marginBottom: 10 }}>
        PUBLISHED
      </div>
      {published.length === 0 && (
        <div className="panel muted small">还没有已发布的活动。点 NEW EVENT 创建第一场。</div>
      )}
      {published.map((e) => (
        <EventRow key={e.id} e={e} />
      ))}
    </div>
  );
}

function EventRow({
  e,
}: {
  e: {
    id: string;
    artist: string | null;
    status: string;
    event_type: string;
    date_tbd: boolean;
    event_date: string | null;
  };
}) {
  const date = e.date_tbd
    ? "DATE TBD"
    : e.event_date
      ? new Date(e.event_date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";
  return (
    <Link href={`/events/${e.id}`}>
      <div
        className="panel"
        style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <div>
          <div style={{ color: "#fff", marginBottom: 4 }}>{e.artist || "UNTITLED EVENT"}</div>
          <div className="small muted">
            {date} · {e.event_type === "rsvp" ? "RSVP" : "TICKETED"}
          </div>
        </div>
        <span className={"badge " + (e.status === "published" ? "live" : "draft")}>
          {e.status.toUpperCase()}
        </span>
      </div>
    </Link>
  );
}
