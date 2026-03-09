import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-store-api-key",
};

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  confirmation: "تأكيد طلب",
  order_edit: "تعديل طلب",
  shipping: "تحديث شحن",
  delivered: "تم التوصيل",
  abandoned_recovery: "استرجاع سلة",
  thankyou_offer: "عرض شكر",
  manual: "رسالة يدوية",
  auto_pending: "إرسال تلقائي",
  test: "اختبار اتصال",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // --- Validate API key from header OR body ---
    const body = await req.json();
    const apiKey = req.headers.get("x-store-api-key") || body.store_id || body.api_key;
    if (!apiKey) {
      return json({ error: "Missing API key (X-Store-API-Key header or store_id in body)" }, 401);
    }

    const { data: config, error: configErr } = await supabase
      .from("wa_config")
      .select("tenant_id, module")
      .eq("store_api_key", apiKey)
      .maybeSingle();

    if (configErr || !config) {
      return json({ error: "Invalid API key" }, 401);
    }

    // --- Parse body fields ---
    const {
      event,
      timestamp,
      customer_phone,
      customer_name,
      message_content,
      message_type,
      order_number,
      whatsapp_message_id,
    } = body;

    // --- Handle test_connection event ---
    if (event === "test_connection") {
      return json({ success: true, message: "Connection verified", tenant_id: config.tenant_id });
    }

    // --- Validate required fields for outbound_message ---
    if (event !== "outbound_message") {
      return json({ error: `Unknown event: ${event}` }, 400);
    }

    if (!customer_phone || !message_content) {
      return json({ error: "Missing required fields: customer_phone, message_content" }, 400);
    }

    // --- Normalize phone ---
    const normalizedPhone = customer_phone.replace(/[\s\-\+]/g, "");

    // --- Upsert contact ---
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("phone", normalizedPhone)
      .eq("tenant_id", config.tenant_id)
      .maybeSingle();

    if (!existingContact) {
      await supabase.from("contacts").insert({
        phone: normalizedPhone,
        name: customer_name || normalizedPhone,
        tenant_id: config.tenant_id,
      });
    } else if (customer_name) {
      await supabase
        .from("contacts")
        .update({ name: customer_name })
        .eq("id", existingContact.id);
    }

    // --- Build message body with type label ---
    const typeLabel = MESSAGE_TYPE_LABELS[message_type] || message_type || "";
    const bodyText = message_content;

    // --- Save message as direction='store' (fallback to outbound if legacy constraint exists) ---
    const messageCreatedAt = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
    const messageData: Record<string, any> = {
      contact_phone: normalizedPhone,
      contact_name: customer_name || null,
      direction: "store",
      body: bodyText,
      status: "delivered",
      tenant_id: config.tenant_id,
      wa_message_id: whatsapp_message_id || null,
      media_type: message_type || null,
      created_at: messageCreatedAt,
    };

    let { error: insertErr } = await supabase.from("messages").insert(messageData);

    // Some projects still have messages_direction_check allowing only inbound/outbound
    if (insertErr?.message?.includes("messages_direction_check")) {
      const fallback = await supabase
        .from("messages")
        .insert({ ...messageData, direction: "outbound" });
      insertErr = fallback.error;
    }

    if (insertErr) {
      console.error("Insert message error:", insertErr);
      return json({ error: "Failed to store message" }, 500);
    }

    const conversationModule = config.module || "confirm";
    let conversationLookup = supabase
      .from("conversations")
      .select("id")
      .eq("contact_phone", normalizedPhone)
      .eq("module", conversationModule)
      .eq("tenant_id", config.tenant_id)
      .limit(1);

    const { data: existingConversation } = await conversationLookup.maybeSingle();

    if (existingConversation) {
      await supabase
        .from("conversations")
        .update({
          last_message_at: messageCreatedAt,
          updated_at: messageCreatedAt,
          unread_count: 0,
        })
        .eq("id", existingConversation.id);
    } else {
      await supabase.from("conversations").insert({
        contact_phone: normalizedPhone,
        tenant_id: config.tenant_id,
        module: conversationModule,
        status: "open",
        unread_count: 0,
        last_message_at: messageCreatedAt,
        created_at: messageCreatedAt,
        updated_at: messageCreatedAt,
      });
    }

    return json({
      success: true,
      message: "Message stored",
      type: typeLabel,
      order: order_number || null,
    });
  } catch (error) {
    console.error("Store webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return json({ error: errorMessage }, 500);
  }
});
