import "./style.css";
import type { Session, RealtimeChannel } from "@supabase/supabase-js";
import { supabase, isConfigured, renderNotConfigured } from "./supabase";
import * as api from "./api";
import type { BookingWithNames } from "./api";
import type { Client, Dog, Walk, WalkEvent } from "./types";
import { formatTime, formatDateTime, formatDuration } from "./format";
import { totalDistanceMeters, formatDistance } from "./geo";
import { createMap, L } from "./leaflet-setup";

type Tab = "today" | "leads" | "clients" | "walk";

const root = document.getElementById("app")!;
let activeTab: Tab = "today";

// ── Walk session state (persists across tab switches within the page) ─────
interface WalkState {
  walk: Walk | null;
  points: Array<{ lat: number; lng: number }>;
  watchId: number | null;
  startedAtMs: number | null;
  channel: RealtimeChannel | null;
  map: L.Map | null;
  polyline: L.Polyline | null;
  marker: L.Marker | null;
  timerId: number | null;
}
const walkState: WalkState = {
  walk: null,
  points: [],
  watchId: null,
  startedAtMs: null,
  channel: null,
  map: null,
  polyline: null,
  marker: null,
  timerId: null,
};

function toast(message: string) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ── Boot ─────────────────────────────────────────────────────────────────

async function main() {
  if (!isConfigured || !supabase) {
    renderNotConfigured(root);
    return;
  }

  const { data } = await supabase.auth.getSession();
  render(data.session);

  supabase.auth.onAuthStateChange((_event, session) => {
    render(session);
  });
}

function render(session: Session | null) {
  if (!session) {
    renderLogin();
  } else {
    renderShell(session);
    renderTab(activeTab);
  }
}

main();

// ── Login ────────────────────────────────────────────────────────────────

function renderLogin() {
  root.innerHTML = `
    <div class="shell" style="max-width: 420px; padding-top: 4rem;">
      <h1>Yaya's Dashboard</h1>
      <p style="color: var(--ink-muted);">Sign in with the email set up as an admin to manage bookings and run walks.</p>
      <div class="card">
        <form id="login-form">
          <div class="field">
            <label for="login-email">Email</label>
            <input id="login-email" type="email" required autocomplete="email" placeholder="you@example.com" />
          </div>
          <button class="btn btn--primary btn--block" type="submit">Send magic link</button>
        </form>
        <p id="login-status" style="margin-top: 0.8rem; font-size: 0.88rem; color: var(--ink-muted);"></p>
      </div>
    </div>
  `;

  const form = document.getElementById("login-form") as HTMLFormElement;
  const status = document.getElementById("login-status")!;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = (document.getElementById("login-email") as HTMLInputElement).value.trim();
    if (!email || !supabase) return;
    status.textContent = "Sending…";
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
    status.textContent = error ? `Couldn't send link: ${error.message}` : `Check ${email} for a sign-in link.`;
  });
}

// ── Shell ────────────────────────────────────────────────────────────────

function renderShell(session: Session) {
  root.innerHTML = `
    <div class="topbar">
      <div class="brand">Walks with <span>Yaya</span></div>
      <div class="topbar-right">
        <span>${session.user.email ?? ""}</span>
        <button class="btn btn--ghost" id="sign-out" style="padding: 0.4rem 0.8rem;">Sign out</button>
      </div>
    </div>
    <div class="tabs">
      <button class="tab" data-tab="today">Today</button>
      <button class="tab" data-tab="leads">Leads</button>
      <button class="tab" data-tab="clients">Clients &amp; Dogs</button>
      <button class="tab" data-tab="walk">Walk</button>
    </div>
    <div class="shell" id="tab-content"></div>
  `;

  document.getElementById("sign-out")!.addEventListener("click", async () => {
    stopWalkTracking();
    await supabase?.auth.signOut();
  });

  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab as Tab;
      renderTab(activeTab);
    });
  });
}

function tabContent(): HTMLElement {
  return document.getElementById("tab-content")!;
}

function markActiveTabButton() {
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === activeTab);
  });
}

function renderTab(tab: Tab) {
  markActiveTabButton();
  if (tab === "today") renderToday();
  if (tab === "leads") renderLeads();
  if (tab === "clients") renderClients();
  if (tab === "walk") renderWalkTab();
}

function statusPill(status: string): string {
  const cls = status === "completed" || status === "converted" ? "pill--ok" : status === "cancelled" || status === "closed" ? "pill--danger" : status === "contacted" || status === "active" ? "pill--warn" : "pill--muted";
  return `<span class="pill ${cls}">${status}</span>`;
}

// ── Today ────────────────────────────────────────────────────────────────

async function renderToday() {
  const container = tabContent();
  container.innerHTML = `<p class="empty-state">Loading today's bookings…</p>`;

  const [todayBookings, upcoming, clients, dogs] = await Promise.all([
    api.listTodayBookings(),
    api.listUpcomingBookings(7),
    api.listClients(),
    api.listDogs(),
  ]);

  container.innerHTML = `
    <div class="card">
      <h2>Today</h2>
      ${renderBookingList(todayBookings)}
    </div>
    <div class="card">
      <h2>Next 7 days</h2>
      ${renderBookingList(upcoming)}
    </div>
    <div class="card">
      <h2>New booking</h2>
      ${clients.length === 0 ? `<p class="empty-state">Add a client under "Clients &amp; Dogs" first.</p>` : renderBookingForm(clients, dogs)}
    </div>
  `;

  container.querySelectorAll<HTMLButtonElement>("[data-start-walk]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const bookingId = btn.dataset.startWalk!;
      const booking = [...todayBookings, ...upcoming].find((b) => b.id === bookingId);
      if (!booking) return;
      await beginWalkForBooking(booking);
      activeTab = "walk";
      renderTab("walk");
    });
  });

  const form = document.getElementById("booking-form") as HTMLFormElement | null;
  if (form) {
    const clientSelect = document.getElementById("booking-client") as HTMLSelectElement;
    const dogSelect = document.getElementById("booking-dog") as HTMLSelectElement;
    const refreshDogs = () => {
      const filtered = dogs.filter((d) => d.client_id === clientSelect.value);
      dogSelect.innerHTML = filtered.map((d) => `<option value="${d.id}">${d.name}</option>`).join("");
    };
    clientSelect.addEventListener("change", refreshDogs);
    refreshDogs();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await api.createBooking({
          client_id: String(fd.get("client_id")),
          dog_id: String(fd.get("dog_id")),
          service_type: String(fd.get("service_type") || "walk"),
          scheduled_at: new Date(String(fd.get("scheduled_at"))).toISOString(),
          duration_minutes: Number(fd.get("duration_minutes")) || 30,
          recurring_note: String(fd.get("recurring_note") || "") || undefined,
          notes: String(fd.get("notes") || "") || undefined,
        });
        toast("Booking added");
        renderToday();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Couldn't save booking");
      }
    });
  }
}

function renderBookingList(bookings: BookingWithNames[]): string {
  if (bookings.length === 0) return `<p class="empty-state">Nothing scheduled.</p>`;
  return bookings
    .map(
      (b) => `
      <div class="list-row">
        <div>
          <strong>${formatTime(b.scheduled_at)}</strong> · ${b.dog_name} (${b.client_name})
          <div class="meta">${b.service_type} · ${b.duration_minutes} min</div>
        </div>
        <div style="display:flex; align-items:center; gap:0.6rem;">
          ${statusPill(b.status)}
          ${b.status === "scheduled" ? `<button class="btn btn--ghost" style="padding:0.4rem 0.8rem;" data-start-walk="${b.id}">Start walk</button>` : ""}
        </div>
      </div>`
    )
    .join("");
}

function renderBookingForm(clients: Client[], _dogs: Dog[]): string {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  const defaultValue = today.toISOString().slice(0, 16);
  return `
    <form id="booking-form">
      <div class="form-row">
        <div class="field">
          <label for="booking-client">Client</label>
          <select id="booking-client" name="client_id" required>
            ${clients.map((c) => `<option value="${c.id}">${c.full_name}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="booking-dog">Dog</label>
          <select id="booking-dog" name="dog_id" required></select>
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label for="booking-service">Service</label>
          <select id="booking-service" name="service_type">
            <option value="walk">Solo walk</option>
            <option value="group">Group walk</option>
            <option value="drop-in">Puppy drop-in</option>
            <option value="sitting">Pet sitting</option>
            <option value="overnight">Overnight care</option>
          </select>
        </div>
        <div class="field">
          <label for="booking-duration">Duration (min)</label>
          <input id="booking-duration" name="duration_minutes" type="number" value="30" min="10" step="5" />
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label for="booking-when">Date &amp; time</label>
          <input id="booking-when" name="scheduled_at" type="datetime-local" value="${defaultValue}" required />
        </div>
        <div class="field">
          <label for="booking-recurring">Recurring? (optional note)</label>
          <input id="booking-recurring" name="recurring_note" placeholder="e.g. every Tue/Thu" />
        </div>
      </div>
      <div class="field">
        <label for="booking-notes">Notes</label>
        <textarea id="booking-notes" name="notes" placeholder="Gate code, meds, anything Yaya should know"></textarea>
      </div>
      <button class="btn btn--primary" type="submit">Add booking</button>
    </form>
  `;
}

// ── Leads ────────────────────────────────────────────────────────────────

async function renderLeads() {
  const container = tabContent();
  container.innerHTML = `<p class="empty-state">Loading leads…</p>`;
  const leads = await api.listLeads();

  if (leads.length === 0) {
    container.innerHTML = `<div class="card"><h2>Leads</h2><p class="empty-state">No enquiries yet — they'll show up here as soon as someone submits the contact form.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="card">
      <h2>Leads</h2>
      ${leads
        .map(
          (lead) => `
        <div class="list-row">
          <div>
            <strong>${lead.name}</strong> · <a href="tel:${lead.phone}">${lead.phone}</a>
            <div class="meta">
              ${lead.best_time_to_call ? `Best time to call: ${lead.best_time_to_call} · ` : ""}${formatDateTime(lead.created_at)}
            </div>
            ${lead.message ? `<div class="meta">"${lead.message}"</div>` : ""}
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            ${statusPill(lead.status)}
            <select data-lead-status="${lead.id}" style="border:1px solid var(--line); border-radius:8px; padding:0.35rem;">
              <option value="new" ${lead.status === "new" ? "selected" : ""}>New</option>
              <option value="contacted" ${lead.status === "contacted" ? "selected" : ""}>Contacted</option>
              <option value="converted" ${lead.status === "converted" ? "selected" : ""}>Converted</option>
              <option value="closed" ${lead.status === "closed" ? "selected" : ""}>Closed</option>
            </select>
          </div>
        </div>`
        )
        .join("")}
    </div>
  `;

  container.querySelectorAll<HTMLSelectElement>("[data-lead-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      await api.setLeadStatus(select.dataset.leadStatus!, select.value as any);
      toast("Lead updated");
    });
  });
}

// ── Clients & Dogs ───────────────────────────────────────────────────────

async function renderClients() {
  const container = tabContent();
  container.innerHTML = `<p class="empty-state">Loading clients…</p>`;
  const [clients, dogs] = await Promise.all([api.listClients(), api.listDogs()]);

  container.innerHTML = `
    <div class="card">
      <h2>Add a client</h2>
      <form id="client-form">
        <div class="form-row">
          <div class="field"><label for="c-name">Full name</label><input id="c-name" name="full_name" required /></div>
          <div class="field"><label for="c-phone">Phone</label><input id="c-phone" name="phone" /></div>
        </div>
        <div class="field"><label for="c-email">Email</label><input id="c-email" name="email" type="email" /></div>
        <div class="field"><label for="c-notes">Notes</label><textarea id="c-notes" name="notes"></textarea></div>
        <button class="btn btn--primary" type="submit">Add client</button>
      </form>
    </div>
    ${clients.length === 0 ? `<p class="empty-state">No clients yet.</p>` : ""}
    ${clients
      .map((c) => {
        const clientDogs = dogs.filter((d) => d.client_id === c.id);
        return `
        <div class="card">
          <h2>${c.full_name}</h2>
          <p class="meta">${[c.phone, c.email].filter(Boolean).join(" · ") || "No contact info yet"}</p>
          ${clientDogs.length ? clientDogs.map((d) => `<div class="list-row"><div><strong>${d.name}</strong>${d.breed ? ` · ${d.breed}` : ""}${d.notes ? `<div class="meta">${d.notes}</div>` : ""}</div></div>`).join("") : `<p class="empty-state">No dogs yet.</p>`}
          <form data-dog-form="${c.id}" style="margin-top:0.8rem; display:flex; gap:0.6rem; flex-wrap:wrap; align-items:end;">
            <div class="field" style="margin-bottom:0;"><label>Dog name</label><input name="name" required /></div>
            <div class="field" style="margin-bottom:0;"><label>Breed</label><input name="breed" /></div>
            <button class="btn btn--ghost" type="submit">Add dog</button>
          </form>
        </div>`;
      })
      .join("")}
  `;

  const clientForm = document.getElementById("client-form") as HTMLFormElement;
  clientForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(clientForm);
    await api.createClient({
      full_name: String(fd.get("full_name")),
      phone: String(fd.get("phone") || "") || undefined,
      email: String(fd.get("email") || "") || undefined,
      notes: String(fd.get("notes") || "") || undefined,
    });
    toast("Client added");
    renderClients();
  });

  container.querySelectorAll<HTMLFormElement>("[data-dog-form]").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      await api.createDog({
        client_id: form.dataset.dogForm!,
        name: String(fd.get("name")),
        breed: String(fd.get("breed") || "") || undefined,
      });
      toast("Dog added");
      renderClients();
    });
  });
}

// ── Walk ─────────────────────────────────────────────────────────────────

async function beginWalkForBooking(booking: BookingWithNames) {
  const walk = await api.getOrCreateWalkForBooking(booking);
  const started = await api.startWalk(walk.id);
  walkState.walk = started;
  walkState.points = [];
  walkState.startedAtMs = Date.now();
  walkState.channel = supabase!.channel(`walk-${started.share_token}`);
  walkState.channel.subscribe();
  startGeolocationWatch();
}

function startGeolocationWatch() {
  if (!("geolocation" in navigator)) {
    toast("This device doesn't support GPS in the browser");
    return;
  }
  walkState.watchId = navigator.geolocation.watchPosition(
    (pos) => handlePosition(pos.coords.latitude, pos.coords.longitude),
    () => toast("Couldn't read location — check location permission"),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
  );
}

function handlePosition(lat: number, lng: number) {
  walkState.points.push({ lat, lng });
  api.addWalkPoint(walkState.walk!.id, lat, lng).catch(() => {});
  walkState.channel?.send({ type: "broadcast", event: "ping", payload: { lat, lng, ts: Date.now() } });
  updateWalkMap();
  updateWalkStats();
}

function updateWalkMap() {
  if (!walkState.map) return;
  const latlngs = walkState.points.map((p) => [p.lat, p.lng] as [number, number]);
  const last = latlngs[latlngs.length - 1];
  if (!last) return;
  if (!walkState.polyline) {
    walkState.polyline = L.polyline(latlngs, { color: "#2f6d5c", weight: 4 }).addTo(walkState.map);
  } else {
    walkState.polyline.setLatLngs(latlngs);
  }
  if (!walkState.marker) {
    walkState.marker = L.marker(last).addTo(walkState.map);
  } else {
    walkState.marker.setLatLng(last);
  }
  walkState.map.setView(last, walkState.map.getZoom());
}

function updateWalkStats() {
  const statsEl = document.getElementById("walk-stats");
  if (!statsEl || !walkState.startedAtMs) return;
  const elapsed = Date.now() - walkState.startedAtMs;
  const distance = totalDistanceMeters(walkState.points);
  statsEl.innerHTML = `
    <div class="stat"><span class="num">${formatDuration(elapsed)}</span><span class="label">Elapsed</span></div>
    <div class="stat"><span class="num">${formatDistance(distance)}</span><span class="label">Distance</span></div>
    <div class="stat"><span class="num">${walkState.points.length}</span><span class="label">GPS points</span></div>
  `;
}

function stopWalkTracking() {
  if (walkState.watchId !== null) navigator.geolocation.clearWatch(walkState.watchId);
  if (walkState.timerId !== null) window.clearInterval(walkState.timerId);
  walkState.watchId = null;
  walkState.timerId = null;
}

async function endCurrentWalk() {
  if (!walkState.walk) return;
  const distance = totalDistanceMeters(walkState.points);
  await api.endWalk(walkState.walk.id, distance);
  walkState.channel?.send({ type: "broadcast", event: "ended", payload: {} });
  await walkState.channel?.unsubscribe();
  stopWalkTracking();
  toast("Walk saved — report card is ready");
  walkState.walk = null;
  walkState.points = [];
  walkState.map = null;
  walkState.polyline = null;
  walkState.marker = null;
  renderWalkTab();
}

async function renderWalkTab() {
  const container = tabContent();

  if (!walkState.walk) {
    container.innerHTML = `<p class="empty-state">Loading today's bookings…</p>`;
    const bookings = await api.listTodayBookings();
    const startable = bookings.filter((b) => b.status === "scheduled");
    container.innerHTML = `
      <div class="card">
        <h2>Start a walk</h2>
        ${startable.length === 0 ? `<p class="empty-state">No bookings left to start today. Add one under "Today".</p>` : renderBookingList(startable)}
      </div>
    `;
    container.querySelectorAll<HTMLButtonElement>("[data-start-walk]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const booking = startable.find((b) => b.id === btn.dataset.startWalk);
        if (!booking) return;
        await beginWalkForBooking(booking);
        renderWalkTab();
      });
    });
    return;
  }

  const shareUrl = `${window.location.origin}/track.html?w=${walkState.walk.share_token}`;

  container.innerHTML = `
    <div class="card walk-stage">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <h2 style="margin:0;">Walk in progress</h2>
        <span class="pill pill--warn">active</span>
      </div>
      <div id="walk-stats" class="stat-row"></div>
      <div class="walk-map" id="walk-map"></div>
      <div class="walk-actions">
        <button class="btn btn--ghost" id="log-potty">🐾 Potty</button>
        <button class="btn btn--ghost" id="log-water">💧 Water</button>
        <button class="btn btn--ghost" id="log-note">📝 Note</button>
        <label class="btn btn--ghost" style="cursor:pointer;">
          📷 Photo
          <input type="file" accept="image/*" capture="environment" id="log-photo" style="display:none;" />
        </label>
      </div>
      <div class="photo-grid" id="walk-photos"></div>
      <button class="btn btn--danger btn--lg btn--block" id="end-walk">End walk</button>
      <p class="meta">Share this link so the owner can watch live: <br /><code>${shareUrl}</code></p>
    </div>
  `;

  const mapEl = document.getElementById("walk-map")!;
  walkState.map = createMap(mapEl, walkState.points.length ? [walkState.points[walkState.points.length - 1].lat, walkState.points[walkState.points.length - 1].lng] : undefined);
  walkState.polyline = null;
  walkState.marker = null;
  updateWalkMap();
  updateWalkStats();
  walkState.timerId = window.setInterval(updateWalkStats, 1000);

  document.getElementById("log-potty")!.addEventListener("click", async () => {
    await api.addWalkEvent(walkState.walk!.id, "potty");
    toast("Logged potty break");
    refreshWalkEvents();
  });
  document.getElementById("log-water")!.addEventListener("click", async () => {
    await api.addWalkEvent(walkState.walk!.id, "water");
    toast("Logged water break");
    refreshWalkEvents();
  });
  document.getElementById("log-note")!.addEventListener("click", async () => {
    const note = window.prompt("Note for the owner:");
    if (!note) return;
    await api.addWalkEvent(walkState.walk!.id, "note", note);
    toast("Note added");
  });
  document.getElementById("log-photo")!.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !walkState.walk) return;
    toast("Uploading photo…");
    const path = await api.uploadWalkPhoto(walkState.walk.id, file);
    await api.addWalkEvent(walkState.walk.id, "photo", undefined, path);
    toast("Photo added");
    refreshWalkEvents();
  });
  document.getElementById("end-walk")!.addEventListener("click", async () => {
    if (window.confirm("End this walk and generate the report card?")) {
      await endCurrentWalk();
    }
  });

  refreshWalkEvents();
}

async function refreshWalkEvents() {
  if (!walkState.walk) return;
  const events = await api.listWalkEvents(walkState.walk.id);
  const photosEl = document.getElementById("walk-photos");
  if (!photosEl) return;
  const photos = events.filter((e: WalkEvent) => e.type === "photo" && e.photo_path);
  photosEl.innerHTML = photos.map((e) => `<img src="${api.walkPhotoUrl(e.photo_path!)}" alt="Walk photo" />`).join("");
}
