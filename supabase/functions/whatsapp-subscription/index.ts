import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const method = req.method;
    const payload = method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = payload?.action === "status" ? "status" : "subscribe";

    const { data: config, error: configError } = await supabase
      .from("wa_config")
      .select("access_token, business_account_id, verify_token")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError || !config?.access_token || !config?.business_account_id) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "WhatsApp config is missing",
          details: configError?.message || null,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const endpoint = `https://graph.facebook.com/v21.0/${config.business_account_id}/subscribed_apps`;
    const callbackUri = `${supabaseUrl}/functions/v1/whatsapp-webhook`;

    if (action === "subscribe") {
      const subscribeRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          override_callback_uri: callbackUri,
          verify_token: config.verify_token || undefined,
        }),
      });

      const subscribeJson = await subscribeRes.json();
      if (!subscribeRes.ok) {
        return new Response(
          JSON.stringify({
            ok: false,
            stage: "subscribe",
            status: subscribeRes.status,
            details: subscribeJson,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const statusRes = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.access_token}`,
        "Content-Type": "application/json",
      },
    });

    const statusJson = await statusRes.json();
    if (!statusRes.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          stage: "status",
          status: statusRes.status,
          details: statusJson,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apps = Array.isArray(statusJson?.data) ? statusJson.data : [];

    return new Response(
      JSON.stringify({
        ok: true,
        action,
        expected_callback_uri: callbackUri,
        subscribed_apps_count: apps.length,
        subscribed_apps: apps,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
