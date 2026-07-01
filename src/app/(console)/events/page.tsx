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
          <button className="btn-green">+ New Event</button>
        </form>
      </div>

      {drafts.length > 0 && (
        <>
          <div className="small muted" style={{ letterSpacing: ".14em", marginBottom: 10 }}>
            DRAFTS
          </div>
          <div className="ev-grid">
            {drafts.map((e) => (
              <EventCard key={e.id} e={e} />
            ))}
          </div>
        </>
      )}

      <div className="small muted" style={{ letterSpacing: ".14em", marginBottom: 10 }}>
        PUBLISHED
      </div>
      {published.length === 0 && (
        <div className="panel muted small">No published events yet. Click New Event to create your first.</div>
      )}
      <div className="ev-grid">
        {published.map((e) => (
          <EventCard key={e.id} e={e} />
        ))}
      </div>
    </div>
  );
}

function EventCard({
  e,
}: {
  e: {
    id: string;
    artist: string | null;
    status: string;
    event_type: string;
    date_tbd: boolean;
    event_date: string | null;
    poster_url: string | null;
  };
}) {
  const title = e.artist || "UNTITLED EVENT";
  const date = e.date_tbd
    ? "DATE TBD"
    : e.event_date
      ? new Date(e.event_date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";
  const badgeClass = e.status === "published" ? "live" : e.status === "canceled" ? "canceled" : "draft";

  return (
    <Link href={`/events/${e.id}`} className="ev-card">
      <div className="ev-cover-box">
        {e.poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.poster_url} alt={title} />
        ) : (
          <div className="ev-ph">
            <span>{title[0]}</span>
          </div>
        )}
        <span className={"ev-badge " + badgeClass}>{e.status.toUpperCase()}</span>
      </div>
      <div className="ev-card-body">
        <div className="ev-card-name">{title}</div>
        <div className="ev-card-meta">
          {date} · {e.event_type === "rsvp" ? "RSVP" : "TICKETED"}
        </div>
      </div>
    </Link>
  );
}
