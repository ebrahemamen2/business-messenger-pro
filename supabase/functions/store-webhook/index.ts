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

    const body = await req.json();
    const { api_key, phone, message, customer_name, timestamp, order_id, template_name } = body;

    if (!api_key || !phone || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: api_key, phone, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up tenant by store_api_key
    const { data: config, error: configErr } = await supabase
      .from("wa_config")
      .select("tenant_id, module")
      .eq("store_api_key", api_key)
      .maybeSingle();

    if (configErr || !config) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert contact
    const normalizedPhone = phone.replace(/[\s\-\+]/g, "");
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

    // Save message as "store" direction — displayed but NOT re-sent to customer
    const messageData: any = {
      contact_phone: normalizedPhone,
      contact_name: customer_name || null,
      direction: "store",
      body: message,
      status: "delivered",
      tenant_id: config.tenant_id,
    };

    if (timestamp) {
      messageData.created_at = new Date(timestamp).toISOString();
    }

    await supabase.from("messages").insert(messageData);

    return new Response(
      JSON.stringify({ success: true, message: "Message received and stored" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Store webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
