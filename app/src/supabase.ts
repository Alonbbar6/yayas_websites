import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url as string, anonKey as string)
  : null;

/** Renders a friendly notice instead of a blank/broken page when env vars are missing. */
export function renderNotConfigured(root: HTMLElement) {
  root.innerHTML = `
    <div class="not-configured">
      <h1>Not connected yet</h1>
      <p>
        This screen needs a Supabase project. Set <code>VITE_SUPABASE_URL</code> and
        <code>VITE_SUPABASE_ANON_KEY</code> (see <code>app/.env.example</code> and the
        setup steps in the repo README), then rebuild.
      </p>
    </div>
  `;
}
