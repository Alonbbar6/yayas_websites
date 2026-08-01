export interface Client {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

export interface Dog {
  id: string;
  client_id: string;
  name: string;
  breed: string | null;
  notes: string | null;
  photo_url: string | null;
  created_at: string;
}

export type LeadStatus = "new" | "contacted" | "converted" | "closed";

export interface Lead {
  id: string;
  name: string;
  phone: string;
  best_time_to_call: string | null;
  message: string | null;
  status: LeadStatus;
  created_at: string;
}

export type BookingStatus = "scheduled" | "completed" | "cancelled";

export interface Booking {
  id: string;
  client_id: string;
  dog_id: string;
  service_type: string;
  scheduled_at: string;
  duration_minutes: number;
  recurring_note: string | null;
  status: BookingStatus;
  notes: string | null;
  created_at: string;
}

export type WalkStatus = "pending" | "active" | "completed" | "cancelled";

export interface Walk {
  id: string;
  booking_id: string | null;
  client_id: string;
  dog_id: string;
  share_token: string;
  status: WalkStatus;
  started_at: string | null;
  ended_at: string | null;
  distance_meters: number | null;
  created_at: string;
}

export type WalkEventType = "potty" | "water" | "photo" | "note";

export interface WalkEvent {
  id: string;
  walk_id: string;
  type: WalkEventType;
  note: string | null;
  photo_path: string | null;
  created_at: string;
}

export interface WalkPoint {
  lat: number;
  lng: number;
  recorded_at: string;
}

export interface LivePing {
  lat: number;
  lng: number;
  ts: number;
}
