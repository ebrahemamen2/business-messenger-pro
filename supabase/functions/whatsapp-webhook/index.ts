import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Normalize phone: strip leading 0 or +, ensure country code 20 for Egypt */
function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s\-\+]/g, "");
  // If starts with 0 and is 11 digits (Egyptian local), prepend 20
  if (/^0\d{10}$/.test(p)) {
    p = "2" + p; // 01xxx -> 201xxx
  }
  // If starts with 20 and next is 0, remove the 0 (2001xxx -> 201xxx)
  if (/^200\d{9}$/.test(p)) {
    p = "20" + p.slice(3);
  }
  return p;
}

/** Extract message body from any message type */
function extractBody(message: any): string {
  if (message.text?.body) return message.text.body;
  if (message.interactive?.button_reply?.title) return message.interactive.button_reply.title;
  if (message.interactive?.list_reply?.title) return message.interactive.list_reply.title;
  if (message.button?.text) return message.button.text;
  if (message.image) return "[صورة]";
  if (message.video) return "[فيديو]";
  if (message.audio) return "[صوت]";
  if (message.document) return "[مستند]";
  if (message.sticker) return "[ملصق]";
  if (message.location) return "[موقع]";
  if (message.contacts) return "[جهة اتصال]";
  return "[رسالة]";
}

/** Extract media info if present */
function extractMedia(message: any): { url?: string; type?: string } {
  for (const t of ["image", "video", "audio", "document", "sticker"]) {
    if (message[t]) {
      return { url: message[t].id || null, type: t };
    }
  }
  return {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // GET = Meta webhook verification
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const { data: config } = await supabase
      .from("wa_config")
      .select("verify_token")
      .limit(1)
      .single();

    if (mode === "subscribe" && token === config?.verify_token) {
      console.log("Webhook verified successfully");
      return new Response(challenge, { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }

  // POST = Incoming from Meta
  if (req.method === "POST") {
    let rawBody: any;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Webhook received:", JSON.stringify(rawBody).slice(0, 2000));

    const entries = Array.isArray(rawBody?.entry) ? rawBody.entry : [];

    // Collect all phones seen and message count for audit
    const allPhones: string[] = [];
    let totalMessages = 0;
    let eventType = "status"; // default; upgraded to "message" if messages found
    const errors: string[] = [];

    // Load config and rules once
    const { data: config } = await supabase
      .from("wa_config")
      .select("*")
      .limit(1)
      .single();

    let rules: Array<{ trigger_keyword: string; response_text: string }> = [];
    if (config?.access_token && config?.phone_number_id) {
      const { data } = await supabase
        .from("auto_reply_rules")
        .select("trigger_keyword, response_text")
        .eq("is_active", true);
      rules = data || [];
    }

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];

      for (const change of changes) {
        const value = change?.value;
        if (!value) continue;

        const incomingMessages = Array.isArray(value?.messages) ? value.messages : [];
        const contacts = Array.isArray(value?.contacts) ? value.contacts : [];

        // If no messages, it's a status update — skip processing but log
        if (!incomingMessages.length) continue;

        eventType = "message";

        for (const message of incomingMessages) {
          try {
            const rawPhone = message?.from;
            if (!rawPhone) continue;

            const contactPhone = normalizePhone(rawPhone);
            allPhones.push(contactPhone);

            const contact = contacts.find((c: any) => normalizePhone(c?.wa_id || "") === contactPhone) || contacts[0];
            const contactName = contact?.profile?.name || rawPhone;

            const body = extractBody(message);
            const media = extractMedia(message);

            // Insert message (idempotent via wa_message_id check)
            const { error: insertErr } = await supabase.from("messages").insert({
              wa_message_id: message.id,
              contact_phone: contactPhone,
              contact_name: contactName,
              direction: "inbound",
              body,
              status: "delivered",
              media_url: media.url || null,
              media_type: media.type || null,
            });

            if (insertErr) {
              console.error("Insert message error:", insertErr.message);
              errors.push(`msg_insert: ${insertErr.message}`);
              // If duplicate, continue (don't count as failure)
              if (insertErr.message?.includes("duplicate")) continue;
            }

            // Upsert contact
            await supabase.from("contacts").upsert(
              { phone: contactPhone, name: contactName },
              { onConflict: "phone" }
            );

            totalMessages += 1;

            // Auto-reply logic
            if (config?.access_token && config?.phone_number_id) {
              const msgText = body.toLowerCase();
              let autoResponse: string | null = null;

              for (const rule of rules) {
                if (msgText.includes(rule.trigger_keyword.toLowerCase())) {
                  autoResponse = rule.response_text;
                  break;
                }
              }

              if (!autoResponse && config.welcome_enabled) {
                const { count } = await supabase
                  .from("messages")
                  .select("*", { count: "exact", head: true })
                  .eq("contact_phone", contactPhone)
                  .eq("direction", "inbound");

                if (count === 1) {
                  autoResponse = config.welcome_message;
                }
              }

              if (autoResponse) {
                try {
                  const waUrl = `https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`;
                  const res = await fetch(waUrl, {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${config.access_token}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      messaging_product: "whatsapp",
                      to: contactPhone,
                      type: "text",
                      text: { body: autoResponse },
                    }),
                  });

                  const waResult = await res.json();
                  console.log("Auto-reply sent:", JSON.stringify(waResult));

                  await supabase.from("messages").insert({
                    wa_message_id: waResult.messages?.[0]?.id,
                    contact_phone: contactPhone,
                    contact_name: contactName,
                    direction: "outbound",
                    body: autoResponse,
                    status: "sent",
                  });
                } catch (replyErr) {
                  console.error("Auto-reply error:", replyErr);
                  errors.push(`auto_reply: ${replyErr}`);
                }
              }
            }
          } catch (msgErr) {
            console.error("Per-message error:", msgErr);
            errors.push(`per_msg: ${msgErr}`);
          }
        }
      }
    }

    // Log to webhook_logs audit trail
    try {
      await supabase.from("webhook_logs").insert({
        event_type: eventType,
        phones: allPhones,
        message_count: totalMessages,
        payload_summary: {
          entry_count: entries.length,
          first_entry_id: entries[0]?.id,
        },
        error: errors.length ? errors.join("; ") : null,
        status: errors.length ? "partial_error" : "ok",
      });
    } catch (logErr) {
      console.error("Audit log error:", logErr);
    }

    return new Response(
      JSON.stringify({ status: "ok", processed: totalMessages, phones: allPhones }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response("Method not allowed", { status: 405 });
});
