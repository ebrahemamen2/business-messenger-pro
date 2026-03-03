import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS
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

    // Get verify token from DB
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

  // POST = Incoming messages from Meta
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("Webhook received:", JSON.stringify(body));

      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value?.messages) {
        // Status update or other non-message event
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const message = value.messages[0];
      const contact = value.contacts?.[0];
      const contactPhone = message.from;
      const contactName = contact?.profile?.name || contactPhone;

      // Save message to DB
      await supabase.from("messages").insert({
        wa_message_id: message.id,
        contact_phone: contactPhone,
        contact_name: contactName,
        direction: "inbound",
        body: message.text?.body || "[media]",
        status: "delivered",
      });

      // Upsert contact
      await supabase.from("contacts").upsert(
        { phone: contactPhone, name: contactName },
        { onConflict: "phone" }
      );

      // Check auto-reply rules
      const { data: config } = await supabase
        .from("wa_config")
        .select("*")
        .limit(1)
        .single();

      if (config?.access_token && config?.phone_number_id) {
        // Check keyword rules
        const { data: rules } = await supabase
          .from("auto_reply_rules")
          .select("*")
          .eq("is_active", true);

        const msgText = (message.text?.body || "").toLowerCase();
        let autoResponse: string | null = null;

        // Check keyword matches
        for (const rule of rules || []) {
          if (msgText.includes(rule.trigger_keyword.toLowerCase())) {
            autoResponse = rule.response_text;
            break;
          }
        }

        // Welcome message for first-time contacts
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

        // Send auto-reply if matched
        if (autoResponse) {
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

          // Save outbound message
          await supabase.from("messages").insert({
            wa_message_id: waResult.messages?.[0]?.id,
            contact_phone: contactPhone,
            contact_name: contactName,
            direction: "outbound",
            body: autoResponse,
            status: "sent",
          });
        }
      }

      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
