// Texts Yaya when a new lead comes in, so she can call back within 24h.
// Wired up as a Supabase Database Webhook on `leads` INSERT (see README).
// Safe no-op (200, does nothing) until Twilio secrets are set — the webhook
// stays configured and just starts working the moment credentials are added.

interface LeadRow {
  name: string;
  phone: string;
  best_time_to_call: string | null;
}

interface WebhookPayload {
  type: "INSERT";
  table: string;
  record: LeadRow;
}

Deno.serve(async (req: Request) => {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER");
  const yayaNumber = Deno.env.get("YAYA_PHONE_NUMBER");

  if (!accountSid || !authToken || !fromNumber || !yayaNumber) {
    return new Response(JSON.stringify({ skipped: "Twilio not configured" }), { status: 200 });
  }

  const payload = (await req.json()) as WebhookPayload;
  const lead = payload.record;

  const body = `🐾 New lead: ${lead.name}, ${lead.phone}` + (lead.best_time_to_call ? ` — best time to call: ${lead.best_time_to_call}` : "");

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: fromNumber, To: yayaNumber, Body: body }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return new Response(JSON.stringify({ error: "Twilio request failed", detail }), { status: 502 });
  }

  return new Response(JSON.stringify({ sent: true }), { status: 200 });
});
