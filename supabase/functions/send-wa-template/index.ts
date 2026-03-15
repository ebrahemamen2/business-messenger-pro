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
  component: string;
  sub_type?: string;
  button_index?: number;
}

function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s\-\+]/g, "");
  if (/^0\d{10}$/.test(p)) p = "2" + p;
  if (/^200\d{9}$/.test(p)) p = "20" + p.slice(3);
  return p;
}

function getPhoneVariants(phone: string): string[] {
  const clean = phone.replace(/[\s\-\+]/g, "");
  const normalized = normalizePhone(clean);
  const variants = new Set<string>([clean, normalized]);
  if (/^20\d{10}$/.test(normalized)) {
    variants.add(`0${normalized.slice(2)}`);
  }
  return [...variants];
}

function buildTemplateComponents(
  mappings: VariableMapping[],
  shipment: Record<string, any>
): any[] {
  const components: any[] = [];

  const bodyVars = mappings
    .filter((m) => m.component === "body")
    .sort((a, b) => a.position - b.position);
  const headerVars = mappings
    .filter((m) => m.component === "header")
    .sort((a, b) => a.position - b.position);
  const buttonVars = mappings
    .filter((m) => m.component === "button")
    .sort((a, b) => (a.button_index ?? 0) - (b.button_index ?? 0));

  if (headerVars.length > 0) {
    components.push({
      type: "header",
      parameters: headerVars.map((v) => ({
        type: "text",
        text: String(shipment[v.field] ?? ""),
      })),
    });
  }

  if (bodyVars.length > 0) {
    components.push({
      type: "body",
      parameters: bodyVars.map((v) => ({
        type: "text",
        text: String(shipment[v.field] ?? ""),
      })),
    });
  }

  for (const btn of buttonVars) {
    if (btn.sub_type === "quick_reply") continue;
    const value = String(shipment[btn.field] ?? "");
    components.push({
      type: "button",
      sub_type: "url",
      index: btn.button_index ?? 0,
      parameters: [{ type: "text", text: value }],
    });
  }

  return components;
}

function buildTemplateMessageBody(
  templateName: string,
  shipment: Record<string, any>
): string {
  const lines: string[] = [`📋 قالب واتساب: ${templateName}`];
  if (shipment.customer_name) lines.push(`👤 ${shipment.customer_name}`);
  if (shipment.shipment_code) lines.push(`📦 بوليصة: ${shipment.shipment_code}`);
  if (shipment.order_code) lines.push(`🧾 طلب: ${shipment.order_code}`);
  if (shipment.amount) lines.push(`💰 ${shipment.amount} ج.م`);
  if (shipment.status) lines.push(`📊 الحالة: ${shipment.status}`);
  if (shipment.customer_address) lines.push(`📍 ${shipment.customer_address}`);
  if (shipment.order_details) lines.push(`📝 ${shipment.order_details}`);
  return lines.join("\n");
}

async function ensureFollowupConversation(
  supabase: any,
  phone: string,
  tenantId: string,
  templateName: string,
  shipment: Record<string, any>
): Promise<string | null> {
  const normalized = normalizePhone(phone);
  const variants = getPhoneVariants(phone);
  const messageBody = buildTemplateMessageBody(templateName, shipment);

  // Check if conversation exists for this phone in ANY module
  const { data: existingConvs } = await supabase
    .from("conversations")
    .select("id, module, contact_phone")
    .eq("tenant_id", tenantId)
    .in("contact_phone", variants);

  const nowIso = new Date().toISOString();
  let conversationId: string | null = null;

  if (existingConvs && existingConvs.length > 0) {
    const followupConv = existingConvs.find(
      (c: any) => c.module === "followup"
    );
    if (followupConv) {
      conversationId = followupConv.id;
      await supabase
        .from("conversations")
        .update({
          last_message_at: nowIso,
          last_message_body: messageBody.split("\n").slice(0, 2).join(" | "),
        })
        .eq("id", conversationId);
    } else {
      conversationId = existingConvs[0].id;
      await supabase
        .from("conversations")
        .update({
          module: "followup",
          last_message_at: nowIso,
          last_message_body: messageBody.split("\n").slice(0, 2).join(" | "),
        })
        .eq("id", conversationId);
    }
  } else {
    const { data: newConv } = await supabase
      .from("conversations")
      .insert({
        contact_phone: normalized,
        tenant_id: tenantId,
        module: "followup",
        status: "open",
        chat_status: "replied",
        last_message_at: nowIso,
        last_message_body: messageBody.split("\n").slice(0, 2).join(" | "),
        unread_count: 0,
      })
      .select("id")
      .single();

    if (newConv) {
      conversationId = newConv.id;

      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("tenant_id", tenantId)
        .in("phone", variants)
        .maybeSingle();

      if (!existingContact) {
        await supabase.from("contacts").insert({
          phone: normalized,
          name: shipment.customer_name || null,
          tenant_id: tenantId,
        });
      }
    }
  }

  // Store the template message with full details
  if (conversationId) {
    await supabase.from("messages").insert({
      contact_phone: normalized,
      tenant_id: tenantId,
      direction: "outbound",
      body: messageBody,
      status: "sent",
    });
  }

  // Link conversation to shipment if not already linked
  if (conversationId) {
    await supabase
      .from("shipment_tracking")
      .update({ conversation_id: conversationId } as any)
      .eq("id", shipment.id)
      .is("conversation_id", null);
  }

  return conversationId;
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
      return json(
        { error: "Missing shipmentIds, templateName, or tenantId" },
        400
      );
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
      (templateData?.has_variables &&
        (templateData?.variable_mappings as VariableMapping[])) ||
      [];

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

    const results: {
      id: string;
      phone: string;
      success: boolean;
      error?: string;
    }[] = [];
    const nowIso = new Date().toISOString();

    for (const shipment of shipments) {
      if (!shipment.customer_phone) {
        results.push({
          id: shipment.id,
          phone: "",
          success: false,
          error: "No phone",
        });
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
          console.error(
            "WA template send error:",
            JSON.stringify(waResult),
            "Payload:",
            JSON.stringify(waPayload)
          );
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

        // Ensure conversation exists in followup module
        try {
          await ensureFollowupConversation(
            supabase,
            shipment.customer_phone,
            tenantId,
            templateName,
            shipment
          );
        } catch (convErr) {
          console.error("Conversation upsert error:", convErr);
          // Don't fail the whole send if conversation creation fails
        }

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
