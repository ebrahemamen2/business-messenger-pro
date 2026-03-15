import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface VariableMapping {
  position: number;
  field: string;
  component: string; // 'body' or 'header'
}

function buildTemplateComponents(
  mappings: VariableMapping[],
  shipment: Record<string, any>
): any[] {
  // Group by component type
  const groups: Record<string, VariableMapping[]> = {};
  for (const m of mappings) {
    const comp = m.component || 'body';
    if (!groups[comp]) groups[comp] = [];
    groups[comp].push(m);
  }

  const components: any[] = [];

  for (const [compType, vars] of Object.entries(groups)) {
    // Sort by position
    vars.sort((a, b) => a.position - b.position);

    const parameters = vars.map((v) => ({
      type: "text",
      text: String(shipment[v.field] ?? ""),
    }));

    components.push({
      type: compType, // 'body' or 'header'
      parameters,
    });
  }

  return components;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { shipmentIds, templateName, language, tenantId } = await req.json();

    if (!shipmentIds?.length || !templateName || !tenantId) {
      return json({ error: "Missing shipmentIds, templateName, or tenantId" }, 400);
    }

    // Get WA config
    const { data: config } = await supabase
      .from("wa_config")
      .select("access_token, phone_number_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!config?.access_token || !config?.phone_number_id) {
      return json({ error: "WhatsApp API not configured" }, 400);
    }

    // Get template with variable mappings
    const { data: templateData } = await supabase
      .from("followup_wa_templates")
      .select("variable_mappings, has_variables")
      .eq("tenant_id", tenantId)
      .eq("template_name", templateName)
      .maybeSingle();

    const variableMappings: VariableMapping[] =
      (templateData?.has_variables && templateData?.variable_mappings as VariableMapping[]) || [];

    // Get shipments
    const { data: shipments, error: shipErr } = await supabase
      .from("shipment_tracking")
      .select("*")
      .in("id", shipmentIds)
      .eq("tenant_id", tenantId);

    if (shipErr || !shipments?.length) {
      return json({ error: "No shipments found", details: shipErr }, 400);
    }

    const waUrl = `https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`;
    const headers = {
      Authorization: `Bearer ${config.access_token}`,
      "Content-Type": "application/json",
    };

    const results: { id: string; phone: string; success: boolean; error?: string }[] = [];
    const nowIso = new Date().toISOString();

    for (const shipment of shipments) {
      if (!shipment.customer_phone) {
        results.push({ id: shipment.id, phone: "", success: false, error: "No phone" });
        continue;
      }

      try {
        const waPayload: any = {
          messaging_product: "whatsapp",
          to: shipment.customer_phone,
          type: "template",
          template: {
            name: templateName,
            language: { code: language || "ar" },
          },
        };

        // Add components with variables if mappings exist
        if (variableMappings.length > 0) {
          waPayload.template.components = buildTemplateComponents(
            variableMappings,
            shipment
          );
        }

        const res = await fetch(waUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(waPayload),
        });

        const waResult = await res.json();

        if (!res.ok) {
          console.error("WA template send error:", JSON.stringify(waResult));
          results.push({
            id: shipment.id,
            phone: shipment.customer_phone,
            success: false,
            error: waResult?.error?.message || `HTTP ${res.status}`,
          });
          continue;
        }

        // Update shipment tracking
        await supabase
          .from("shipment_tracking")
          .update({
            wa_template_sent: true,
            wa_template_name: templateName,
            wa_sent_at: nowIso,
          } as any)
          .eq("id", shipment.id);

        results.push({
          id: shipment.id,
          phone: shipment.customer_phone,
          success: true,
        });
      } catch (err) {
        results.push({
          id: shipment.id,
          phone: shipment.customer_phone,
          success: false,
          error: err instanceof Error ? err.message : "Unknown",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return json({
      success: true,
      sent: successCount,
      failed: failCount,
      results,
    });
  } catch (error) {
    console.error("Send WA template error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});
