import { supabase } from "./supabase";
import { startOfDayISO, endOfDayISO, daysFromNowISO } from "./format";
import type {
  Booking,
  BookingStatus,
  Client,
  Dog,
  Lead,
  LeadStatus,
  Walk,
  WalkEvent,
  WalkEventType,
  WalkPoint,
} from "./types";

function db() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

export interface BookingWithNames extends Booking {
  client_name: string;
  dog_name: string;
}

function mapBookingRow(row: any): BookingWithNames {
  return {
    ...row,
    client_name: row.clients?.full_name ?? "Unknown client",
    dog_name: row.dogs?.name ?? "Unknown dog",
  };
}

export async function listBookingsBetween(startISO: string, endISO: string): Promise<BookingWithNames[]> {
  const { data, error } = await db()
    .from("bookings")
    .select("*, clients(full_name, phone), dogs(name)")
    .gte("scheduled_at", startISO)
    .lt("scheduled_at", endISO)
    .neq("status", "cancelled")
    .order("scheduled_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapBookingRow);
}

export function listTodayBookings(): Promise<BookingWithNames[]> {
  return listBookingsBetween(startOfDayISO(), endOfDayISO());
}

export function listUpcomingBookings(days: number): Promise<BookingWithNames[]> {
  return listBookingsBetween(endOfDayISO(), daysFromNowISO(days));
}

export async function setBookingStatus(id: string, status: BookingStatus): Promise<void> {
  const { error } = await db().from("bookings").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function createBooking(input: {
  client_id: string;
  dog_id: string;
  service_type: string;
  scheduled_at: string;
  duration_minutes: number;
  recurring_note?: string;
  notes?: string;
}): Promise<Booking> {
  const { data, error } = await db().from("bookings").insert(input).select().single();
  if (error) throw error;
  return data as Booking;
}

export async function listClients(): Promise<Client[]> {
  const { data, error } = await db().from("clients").select("*").order("full_name");
  if (error) throw error;
  return data ?? [];
}

export async function listDogs(): Promise<Dog[]> {
  const { data, error } = await db().from("dogs").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createClient(input: { full_name: string; phone?: string; email?: string; notes?: string }): Promise<Client> {
  const { data, error } = await db().from("clients").insert(input).select().single();
  if (error) throw error;
  return data as Client;
}

export async function createDog(input: { client_id: string; name: string; breed?: string; notes?: string }): Promise<Dog> {
  const { data, error } = await db().from("dogs").insert(input).select().single();
  if (error) throw error;
  return data as Dog;
}

export async function listLeads(): Promise<Lead[]> {
  const { data, error } = await db().from("leads").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function setLeadStatus(id: string, status: LeadStatus): Promise<void> {
  const { error } = await db().from("leads").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function submitLead(input: { name: string; phone: string; best_time_to_call?: string; message?: string }): Promise<void> {
  const { error } = await db().from("leads").insert(input);
  if (error) throw error;
}

export async function getOrCreateWalkForBooking(booking: Booking): Promise<Walk> {
  const existing = await db().from("walks").select("*").eq("booking_id", booking.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as Walk;

  const { data, error } = await db()
    .from("walks")
    .insert({
      booking_id: booking.id,
      client_id: booking.client_id,
      dog_id: booking.dog_id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Walk;
}

export async function getActiveWalk(): Promise<Walk | null> {
  const { data, error } = await db().from("walks").select("*").eq("status", "active").maybeSingle();
  if (error) throw error;
  return (data as Walk | null) ?? null;
}

export async function startWalk(walkId: string): Promise<Walk> {
  const { data, error } = await db()
    .from("walks")
    .update({ status: "active", started_at: new Date().toISOString() })
    .eq("id", walkId)
    .select()
    .single();
  if (error) throw error;
  return data as Walk;
}

export async function endWalk(walkId: string, distanceMeters: number): Promise<Walk> {
  const { data, error } = await db()
    .from("walks")
    .update({ status: "completed", ended_at: new Date().toISOString(), distance_meters: distanceMeters })
    .eq("id", walkId)
    .select()
    .single();
  if (error) throw error;
  return data as Walk;
}

export async function addWalkPoint(walkId: string, lat: number, lng: number): Promise<void> {
  const { error } = await db().from("walk_points").insert({ walk_id: walkId, lat, lng });
  if (error) throw error;
}

export async function addWalkEvent(walkId: string, type: WalkEventType, note?: string, photoPath?: string): Promise<WalkEvent> {
  const { data, error } = await db()
    .from("walk_events")
    .insert({ walk_id: walkId, type, note: note ?? null, photo_path: photoPath ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as WalkEvent;
}

export async function listWalkEvents(walkId: string): Promise<WalkEvent[]> {
  const { data, error } = await db().from("walk_events").select("*").eq("walk_id", walkId).order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function listWalkPoints(walkId: string): Promise<WalkPoint[]> {
  const { data, error } = await db().from("walk_points").select("lat, lng, recorded_at").eq("walk_id", walkId).order("recorded_at");
  if (error) throw error;
  return data ?? [];
}

export async function uploadWalkPhoto(walkId: string, file: File): Promise<string> {
  const path = `${walkId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
  const { error } = await db().storage.from("walk-photos").upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export function walkPhotoUrl(path: string): string {
  return db().storage.from("walk-photos").getPublicUrl(path).data.publicUrl;
}
