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

    const { to, message, mediaUrl, mediaType, replyToMessageId, tenantId, module, conversationId } = await req.json();

    if (!to || (!message && !mediaUrl)) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' or 'message'/'mediaUrl'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get config (prefer tenant/module-specific row, fallback to latest row)
    let configQuery = supabase
      .from("wa_config")
      .select("access_token, phone_number_id, tenant_id, module")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (tenantId) configQuery = configQuery.eq("tenant_id", tenantId);
    if (module) configQuery = configQuery.eq("module", module);

    let { data: config } = await configQuery.maybeSingle();

    if (!config) {
      const { data: fallbackConfig } = await supabase
        .from("wa_config")
        .select("access_token, phone_number_id, tenant_id, module")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      config = fallbackConfig;
    }

    if (!config?.access_token || !config?.phone_number_id) {
      return new Response(
        JSON.stringify({ error: "WhatsApp API not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const waUrl = `https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`;
    const headers = {
      Authorization: `Bearer ${config.access_token}`,
      "Content-Type": "application/json",
    };

    // Build WhatsApp message payload
    let waPayload: any = {
      messaging_product: "whatsapp",
      to,
    };

    // Add context for replies
    if (replyToMessageId) {
      // Look up the wa_message_id for the reply
      const { data: replyMsg } = await supabase
        .from("messages")
        .select("wa_message_id")
        .eq("id", replyToMessageId)
        .single();
      if (replyMsg?.wa_message_id) {
        waPayload.context = { message_id: replyMsg.wa_message_id };
      }
    }

    // Determine message type based on media
    if (mediaUrl && mediaType) {
      const mimeType = mediaType.toLowerCase();
      if (mimeType.startsWith("image")) {
        waPayload.type = "image";
        waPayload.image = { link: mediaUrl, caption: message || undefined };
      } else if (mimeType.startsWith("video")) {
        waPayload.type = "video";
        waPayload.video = { link: mediaUrl, caption: message || undefined };
      } else if (mimeType.startsWith("audio")) {
        waPayload.type = "audio";
        waPayload.audio = { link: mediaUrl };
      } else {
        // Document (PDF, DOCX, etc.)
        waPayload.type = "document";
        waPayload.document = { link: mediaUrl, caption: message || undefined };
      }
    } else {
      // Text-only message
      waPayload.type = "text";
      waPayload.text = { body: message };
    }

    const res = await fetch(waUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(waPayload),
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
    const nowIso = new Date().toISOString();

    await supabase.from("messages").insert({
      wa_message_id: waResult.messages?.[0]?.id,
      contact_phone: to,
      direction: "outbound",
      body: message || (mediaUrl ? "[مرفق]" : ""),
      status: "sent",
      media_url: mediaUrl || null,
      media_type: mediaType || null,
      reply_to_message_id: replyToMessageId || null,
      tenant_id: config.tenant_id || tenantId || null,
      created_at: nowIso,
    });

    // Keep conversation metadata in sync so ordering/unread updates immediately
    if (conversationId) {
      await supabase
        .from("conversations")
        .update({
          last_message_at: nowIso,
          unread_count: 0,
          updated_at: nowIso,
        })
        .eq("id", conversationId);
    }

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
