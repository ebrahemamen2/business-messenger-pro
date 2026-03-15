
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-store-api-key",
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

    const body = await req.json();
    const apiKey = req.headers.get("x-store-api-key") || body.store_id || body.api_key;
    if (!apiKey) {
      return json({ error: "Missing API key" }, 401);
    }

    const { data: config } = await supabase
      .from("wa_config")
      .select("tenant_id, access_token, phone_number_id")
      .eq("store_api_key", apiKey)
      .maybeSingle();

    if (!config) {
      return json({ error: "Invalid API key" }, 401);
    }

    const tenantId = config.tenant_id;
    const { event } = body;

    if (event === "test_connection") {
      return json({ success: true, message: "Connection verified", tenant_id: tenantId });
    }

    if (event === "new_order") {
      return await handleNewOrder(supabase, body, tenantId, json);
    }

    if (event === "order_modified") {
      return await handleOrderModified(supabase, body, tenantId, json);
    }

    if (event === "lost_order") {
      return await handleLostOrder(supabase, body, tenantId, json);
    }

    if (event === "outbound_message") {
      return await handleOutboundMessage(supabase, body, tenantId, json);
    }

    return json({ error: `Unknown event: ${event}` }, 400);
  } catch (error) {
    console.error("Store webhook error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

// ─── Normalize Egyptian phone to international format ───
function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s\-\+]/g, "");
  // Egyptian mobile: 01xxxxxxxxx → 201xxxxxxxxx
  if (p.startsWith("01") && p.length === 11) {
    p = "2" + p;
  }
  return p;
}

// ─── New Order ───
async function handleNewOrder(supabase: any, body: any, tenantId: string, json: Function) {
  const {
    order_number, customer_name, customer_phone, customer_phone_alt,
    customer_email, customer_city, customer_sub_zone, customer_address,
    payment_method, payment_status, order_status,
    subtotal, shipping_cost, discount_amount, coupon_code,
    total_amount, currency, items, store_order_id, notes,
  } = body;

  if (!order_number || !customer_phone) {
    return json({ error: "Missing required: order_number, customer_phone" }, 400);
  }

  const phone = normalizePhone(customer_phone);

  await upsertContact(supabase, phone, customer_name, tenantId);

  // Check duplicate
  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .eq("order_number", order_number)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existing) {
    return json({ success: true, message: "Order already exists", order_id: existing.id });
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      tenant_id: tenantId,
      order_number,
      customer_name: customer_name || null,
      customer_phone: phone,
      customer_phone_alt: customer_phone_alt ? normalizePhone(customer_phone_alt) : null,
      customer_email: customer_email || null,
      customer_city: customer_city || null,
      customer_sub_zone: customer_sub_zone || null,
      customer_address: customer_address || null,
      payment_method: payment_method || null,
      payment_status: payment_status || "pending",
      subtotal: subtotal || null,
      shipping_cost: shipping_cost || 0,
      discount_amount: discount_amount || 0,
      coupon_code: coupon_code || null,
      total_amount: total_amount || null,
      currency: currency || "EGP",
      items: items || [],
      store_order_id: store_order_id || null,
      notes: notes || null,
      status: order_status || "pending",
    })
    .select("id")
    .single();

  if (orderErr) {
    console.error("Insert order error:", orderErr);
    return json({ error: "Failed to create order" }, 500);
  }

  console.log(`New order ${order_number} created for tenant ${tenantId}`);

  return json({
    success: true,
    message: "Order created",
    order_id: order.id,
    order_number,
  });
}

// ─── Order Modified ───
async function handleOrderModified(supabase: any, body: any, tenantId: string, json: Function) {
  const {
    order_number, modification_type, old_data, new_data,
    items, total_amount, subtotal, shipping_cost, discount_amount,
    customer_phone, customer_name,
  } = body;

  if (!order_number) {
    return json({ error: "Missing required: order_number" }, 400);
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_phone")
    .eq("order_number", order_number)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!order) {
    return json({ error: "Order not found" }, 404);
  }

  const updateData: Record<string, any> = {};
  if (items) updateData.items = items;
  if (total_amount !== undefined) updateData.total_amount = total_amount;
  if (subtotal !== undefined) updateData.subtotal = subtotal;
  if (shipping_cost !== undefined) updateData.shipping_cost = shipping_cost;
  if (discount_amount !== undefined) updateData.discount_amount = discount_amount;

  if (Object.keys(updateData).length > 0) {
    await supabase.from("orders").update(updateData).eq("id", order.id);
  }

  await supabase.from("order_modifications").insert({
    order_id: order.id,
    tenant_id: tenantId,
    modification_type: modification_type || "edit",
    old_data: old_data || null,
    new_data: new_data || { items, total_amount },
  });

  console.log(`Order ${order_number} modified (${modification_type || "edit"})`);

  return json({
    success: true,
    message: "Order modification recorded",
    order_number,
    modification_type: modification_type || "edit",
  });
}

// ─── Lost Order ───
async function handleLostOrder(supabase: any, body: any, tenantId: string, json: Function) {
  const {
    abandoned_checkout_id, customer_name, customer_phone,
    customer_city, customer_sub_zone, customer_address,
    total_amount, currency, items, notes,
  } = body;

  if (!customer_phone) {
    return json({ error: "Missing required: customer_phone" }, 400);
  }

  const phone = normalizePhone(customer_phone);
  await upsertContact(supabase, phone, customer_name, tenantId);

  // Generate order number for lost orders if not provided
  const order_number = body.order_number || `LOST-${Date.now()}`;

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      tenant_id: tenantId,
      order_number,
      customer_name: customer_name || null,
      customer_phone: phone,
      customer_city: customer_city || null,
      customer_sub_zone: customer_sub_zone || null,
      customer_address: customer_address || null,
      total_amount: total_amount || null,
      currency: currency || "EGP",
      items: items || [],
      notes: notes || null,
      status: "lost",
      order_source: "store_lost",
      abandoned_checkout_id: abandoned_checkout_id || null,
    })
    .select("id")
    .single();

  if (orderErr) {
    console.error("Insert lost order error:", orderErr);
    return json({ error: "Failed to create lost order" }, 500);
  }

  // Create/update conversation in lost-orders module
  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("contact_phone", phone)
    .eq("module", "lost-orders")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const now = new Date().toISOString();
  if (existingConv) {
    await supabase.from("conversations").update({
      last_message_at: now,
      updated_at: now,
      status: "open",
    }).eq("id", existingConv.id);
  } else {
    await supabase.from("conversations").insert({
      contact_phone: phone,
      tenant_id: tenantId,
      module: "lost-orders",
      status: "open",
      unread_count: 1,
      chat_status: "waiting",
      last_message_at: now,
    });
  }

  console.log(`Lost order ${order_number} created for tenant ${tenantId}`);

  return json({
    success: true,
    message: "Lost order created",
    order_id: order.id,
    order_number,
  });
}

// ─── Legacy outbound_message ───
async function handleOutboundMessage(supabase: any, body: any, tenantId: string, json: Function) {
  const { customer_phone, customer_name, message_content, message_type, order_number, whatsapp_message_id, timestamp } = body;

  if (!customer_phone || !message_content) {
    return json({ error: "Missing required fields: customer_phone, message_content" }, 400);
  }

  const phone = normalizePhone(customer_phone);
  await upsertContact(supabase, phone, customer_name, tenantId);

  const messageCreatedAt = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
  const messageData: Record<string, any> = {
    contact_phone: phone,
    contact_name: customer_name || null,
    direction: "store",
    body: message_content,
    status: "delivered",
    tenant_id: tenantId,
    wa_message_id: whatsapp_message_id || null,
    media_type: message_type || null,
    created_at: messageCreatedAt,
  };

  let { error: insertErr } = await supabase.from("messages").insert(messageData);
  if (insertErr?.message?.includes("messages_direction_check")) {
    const fallback = await supabase.from("messages").insert({ ...messageData, direction: "outbound" });
    insertErr = fallback.error;
  }
  if (insertErr) {
    return json({ error: "Failed to store message" }, 500);
  }

  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("contact_phone", phone)
    .eq("module", "confirm")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existingConv) {
    await supabase.from("conversations").update({
      last_message_at: messageCreatedAt,
      updated_at: messageCreatedAt,
      unread_count: 0,
      chat_status: "replied",
    }).eq("id", existingConv.id);
  } else {
    await supabase.from("conversations").insert({
      contact_phone: phone,
      tenant_id: tenantId,
      module: "confirm",
      status: "open",
      unread_count: 0,
      chat_status: "replied",
      last_message_at: messageCreatedAt,
    });
  }

  return json({ success: true, message: "Message stored", order: order_number || null });
}

// ─── Helpers ───
async function upsertContact(supabase: any, phone: string, name: string | null, tenantId: string) {
  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("phone", phone)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("contacts").insert({
      phone,
      name: name || phone,
      tenant_id: tenantId,
    });
  } else if (name) {
    await supabase.from("contacts").update({ name }).eq("id", existing.id);
  }
}
