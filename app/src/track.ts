import "./style.css";
import { supabase, isConfigured, renderNotConfigured } from "./supabase";
import { formatDateTime, formatDuration } from "./format";
import { formatDistance } from "./geo";
import { createMap, L } from "./leaflet-setup";

const root = document.getElementById("track")!;

interface WalkInfo {
  id: string;
  status: "pending" | "active" | "completed" | "cancelled";
  started_at: string | null;
  ended_at: string | null;
  distance_meters: number | null;
  dog_name: string;
}

interface WalkEventRow {
  type: "potty" | "water" | "photo" | "note";
  note: string | null;
  photo_path: string | null;
  created_at: string;
}

const EVENT_LABEL: Record<WalkEventRow["type"], string> = {
  potty: "🐾 Potty break",
  water: "💧 Water break",
  photo: "📷 Photo",
  note: "📝 Note",
};

function photoUrl(path: string): string {
  return supabase!.storage.from("walk-photos").getPublicUrl(path).data.publicUrl;
}

async function main() {
  const token = new URLSearchParams(window.location.search).get("w");

  if (!isConfigured || !supabase) {
    renderNotConfigured(root);
    return;
  }
  if (!token) {
    root.innerHTML = `<div class="track-header"><h1>No walk link</h1><p>This page needs a walk link from Yaya to show anything.</p></div>`;
    return;
  }

  const { data, error } = await supabase.rpc("get_walk_by_token", { token }).maybeSingle();
  if (error || !data) {
    root.innerHTML = `<div class="track-header"><h1>Walk not found</h1><p>This link may have expired or been mistyped.</p></div>`;
    return;
  }

  const walk = data as WalkInfo;
  if (walk.status === "completed") {
    await renderReport(walk, token);
  } else {
    await renderLive(walk, token);
  }
}

async function renderLive(walk: WalkInfo, token: string) {
  root.innerHTML = `
    <div class="track-header">
      <h1>${walk.dog_name}'s walk</h1>
      <p>${walk.status === "active" ? "Live now" : "Hasn't started yet — this page updates automatically."}</p>
    </div>
    <div class="track-map" id="live-map"></div>
  `;

  const mapEl = document.getElementById("live-map")!;
  const map = createMap(mapEl);
  let polyline: L.Polyline | null = null;
  let marker: L.Marker | null = null;
  const points: Array<[number, number]> = [];

  const channel = supabase!.channel(`walk-${token}`);
  channel
    .on("broadcast", { event: "ping" }, (msg) => {
      const { lat, lng } = msg.payload as { lat: number; lng: number };
      points.push([lat, lng]);
      if (!polyline) polyline = L.polyline(points, { color: "#2f6d5c", weight: 4 }).addTo(map);
      else polyline.setLatLngs(points);
      if (!marker) marker = L.marker([lat, lng]).addTo(map);
      else marker.setLatLng([lat, lng]);
      map.setView([lat, lng], map.getZoom());
    })
    .on("broadcast", { event: "ended" }, () => {
      void channel.unsubscribe();
      main();
    })
    .subscribe();
}

async function renderReport(walk: WalkInfo, token: string) {
  const [pointsRes, eventsRes] = await Promise.all([
    supabase!.rpc("get_walk_points_by_token", { token }),
    supabase!.rpc("get_walk_events_by_token", { token }),
  ]);

  const points = (pointsRes.data ?? []) as Array<{ lat: number; lng: number }>;
  const events = (eventsRes.data ?? []) as WalkEventRow[];
  const photos = events.filter((e) => e.type === "photo" && e.photo_path);
  const logEntries = events.filter((e) => e.type !== "photo");

  const duration = walk.started_at && walk.ended_at ? new Date(walk.ended_at).getTime() - new Date(walk.started_at).getTime() : null;

  root.innerHTML = `
    <div class="track-header">
      <h1>${walk.dog_name}'s report card</h1>
      <p>${walk.started_at ? formatDateTime(walk.started_at) : ""}</p>
      <div class="stat-row" style="justify-content:center;">
        <div class="stat"><span class="num">${duration !== null ? formatDuration(duration) : "—"}</span><span class="label">Duration</span></div>
        <div class="stat"><span class="num">${walk.distance_meters !== null ? formatDistance(walk.distance_meters) : "—"}</span><span class="label">Distance</span></div>
      </div>
    </div>
    ${points.length > 1 ? `<div class="track-map" id="report-map"></div>` : ""}
    ${
      photos.length
        ? `<div class="card" style="margin: 1.2rem 1rem;"><h2>Photos</h2><div class="photo-grid">${photos.map((p) => `<img src="${photoUrl(p.photo_path!)}" alt="Walk photo" />`).join("")}</div></div>`
        : ""
    }
    ${
      logEntries.length
        ? `<div class="card" style="margin: 1.2rem 1rem;"><h2>Walk log</h2><ul class="event-log">${logEntries
            .map((e) => `<li><time>${new Date(e.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time><span>${EVENT_LABEL[e.type]}${e.note ? ` — ${e.note}` : ""}</span></li>`)
            .join("")}</ul></div>`
        : ""
    }
  `;

  if (points.length > 1) {
    const mapEl = document.getElementById("report-map")!;
    const latlngs = points.map((p) => [p.lat, p.lng] as [number, number]);
    const map = createMap(mapEl, latlngs[0]);
    const line = L.polyline(latlngs, { color: "#2f6d5c", weight: 4 }).addTo(map);
    map.fitBounds(line.getBounds(), { padding: [24, 24] });
  }
}

main();
