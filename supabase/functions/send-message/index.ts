import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { to, message } = await req.json();

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' or 'message'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get config
    const { data: config } = await supabase
      .from("wa_config")
      .select("access_token, phone_number_id")
      .limit(1)
      .single();

    if (!config?.access_token || !config?.phone_number_id) {
      return new Response(
        JSON.stringify({ error: "WhatsApp API not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via WhatsApp API
    const waUrl = `https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`;
    const res = await fetch(waUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      }),
    });

    const waResult = await res.json();

    if (!res.ok) {
      console.error("WhatsApp API error:", JSON.stringify(waResult));
      return new Response(
        JSON.stringify({ error: "WhatsApp API error", details: waResult }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save outbound message
    await supabase.from("messages").insert({
      wa_message_id: waResult.messages?.[0]?.id,
      contact_phone: to,
      direction: "outbound",
      body: message,
      status: "sent",
    });

    return new Response(JSON.stringify({ success: true, data: waResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Send message error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
