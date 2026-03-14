import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Normalize phone: strip leading 0 or +, ensure country code 20 for Egypt */
function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s\-\+]/g, "");
  if (/^0\d{10}$/.test(p)) p = "2" + p;
  if (/^200\d{9}$/.test(p)) p = "20" + p.slice(3);
  return p;
}

/** Extract message body from any message type */
function extractBody(message: any): string {
  // Handle text messages (most common)
  if (message.text?.body) return message.text.body;
  
  // Handle interactive messages (buttons, lists, etc.)
  if (message.interactive?.button_reply?.title) return message.interactive.button_reply.title;
  if (message.interactive?.list_reply?.title) return message.interactive.list_reply.title;
  if (message.button?.text) return message.button.text;
  
  // Handle reactions
  if (message.type === 'reaction') {
    return message.reaction?.emoji ? message.reaction.emoji : "[إزالة تفاعل]";
  }
  
  // Handle media with captions first
  if (message.image?.caption) return message.image.caption;
  if (message.video?.caption) return message.video.caption;
  if (message.document?.caption) return message.document.caption;
  
  // Handle media without captions
  if (message.image) return "[صورة]";
  if (message.video) return "[فيديو]";
  if (message.audio) return "[صوت]";
  if (message.document) return `[مستند] ${message.document.filename || ""}`.trim();
  if (message.sticker) return "[ملصق]";
  if (message.location) return "[موقع]";
  if (message.contacts) return "[جهة اتصال]";
  
  // Handle newer message types
  if (message.order) return "[طلب من الكتالوج]";
  if (message.system) return "[رسالة نظام]";
  
  // Handle messages with 'type' field but no specific handler
  if (message.type && !['text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contacts'].includes(message.type)) {
    return `[رسالة غير مدعومة: ${message.type}]`;
  }
  
  // Fallback for completely unknown message structures
  return "[رسالة]";
}

/** Map WhatsApp media type to MIME prefix */
function getMediaMimeType(type: string, message: any): string {
  const mimeMap: Record<string, string> = {
    image: message.image?.mime_type || "image/jpeg",
    video: message.video?.mime_type || "video/mp4",
    audio: message.audio?.mime_type || "audio/ogg",
    document: message.document?.mime_type || "application/pdf",
    sticker: message.sticker?.mime_type || "image/webp",
  };
  return mimeMap[type] || "application/octet-stream";
}

/** Get file extension from MIME type */
function getExtFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
    "video/mp4": "mp4", "video/3gpp": "3gp",
    "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/aac": "aac", "audio/opus": "opus",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };
  return map[mime] || mime.split("/")[1] || "bin";
}

/** Download media from WhatsApp Graph API and upload to Supabase Storage */
async function downloadAndStoreMedia(
  mediaId: string,
  accessToken: string,
  mimeType: string,
  supabase: any
): Promise<string | null> {
  try {
    // Step 1: Get media URL from WhatsApp
    const mediaInfoRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!mediaInfoRes.ok) {
      console.error("Failed to get media info:", await mediaInfoRes.text());
      return null;
    }
    const mediaInfo = await mediaInfoRes.json();
    const mediaUrl = mediaInfo.url;
    if (!mediaUrl) return null;

    // Step 2: Download the actual media file
    const fileRes = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileRes.ok) {
      console.error("Failed to download media:", fileRes.status);
      return null;
    }
    const fileBuffer = await fileRes.arrayBuffer();

    // Step 3: Upload to Supabase Storage
    const ext = getExtFromMime(mimeType);
    const path = `media/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("chat-attachments")
      .upload(path, fileBuffer, { contentType: mimeType, upsert: false });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr.message);
      return null;
    }

    // Step 4: Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("chat-attachments")
      .getPublicUrl(path);

    return publicUrl;
  } catch (err) {
    console.error("Media download/store error:", err);
    return null;
  }
}

/** Extract media info if present */
function extractMediaInfo(message: any): { id?: string; type?: string; mimeType?: string } {
  for (const t of ["image", "video", "audio", "document", "sticker"]) {
    if (message[t]) {
      return {
        id: message[t].id || null,
        type: t,
        mimeType: getMediaMimeType(t, message),
      };
    }
  }
  return {};
}

async function upsertConversationFromMessage(params: {
  supabase: any;
  contactPhone: string;
  tenantId: string | null;
  module: string;
  direction: "inbound" | "outbound";
  atIso: string;
}) {
  const { supabase, contactPhone, tenantId, module, direction, atIso } = params;

  let lookup = supabase
    .from("conversations")
    .select("id, unread_count, chat_status")
    .eq("contact_phone", contactPhone)
    .eq("module", module)
    .limit(1);

  lookup = tenantId ? lookup.eq("tenant_id", tenantId) : lookup.is("tenant_id", null);

  const { data: existingConv, error: lookupErr } = await lookup.maybeSingle();
  if (lookupErr) throw lookupErr;

  const newChatStatus = direction === "inbound" ? "unread" : "replied";

  if (existingConv) {
    const nextUnread = direction === "inbound" ? (existingConv.unread_count || 0) + 1 : 0;
    const updateData: Record<string, any> = {
      last_message_at: atIso,
      updated_at: atIso,
      unread_count: nextUnread,
    };
    // Only update chat_status if inbound (set to unread) or if agent is replying
    if (direction === "inbound") {
      updateData.chat_status = "unread";
      updateData.last_customer_message_at = atIso;
    } else {
      updateData.chat_status = "replied";
    }
    const { error: updateErr } = await supabase
      .from("conversations")
      .update(updateData)
      .eq("id", existingConv.id);

    if (updateErr) throw updateErr;
    return;
  }

  const unreadCount = direction === "inbound" ? 1 : 0;
  const insertData: Record<string, any> = {
    contact_phone: contactPhone,
    tenant_id: tenantId,
    module,
    status: "open",
    unread_count: unreadCount,
    chat_status: newChatStatus,
    last_message_at: atIso,
    created_at: atIso,
    updated_at: atIso,
  };
  if (direction === "inbound") {
    insertData.last_customer_message_at = atIso;
  }
  const { error: insertErr } = await supabase.from("conversations").insert(insertData);

  if (insertErr) throw insertErr;
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

    const allPhones: string[] = [];
    let totalMessages = 0;
    let eventType = "status";
    const errors: string[] = [];

    // Load config — resolve tenant from phone_number_id in the webhook payload
    const phoneNumberId = entries?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

    let configQuery = supabase.from("wa_config").select("*");
    if (phoneNumberId) {
      configQuery = configQuery.eq("phone_number_id", phoneNumberId);
    }
    const { data: config } = await configQuery.order("updated_at", { ascending: false }).limit(1).single();

    let rules: Array<{ trigger_keyword: string; response_text: string }> = [];
    if (config?.access_token && config?.phone_number_id) {
      let rulesQuery = supabase
        .from("auto_reply_rules")
        .select("trigger_keyword, response_text")
        .eq("is_active", true);
      if (config.tenant_id) rulesQuery = rulesQuery.eq("tenant_id", config.tenant_id);
      if (config.module) rulesQuery = rulesQuery.eq("module", config.module);
      const { data } = await rulesQuery;
      rules = data || [];
    }

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];

      for (const change of changes) {
        const value = change?.value;
        if (!value) continue;

        // Handle status updates - update message status in DB
        const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
        for (const statusUpdate of statuses) {
          try {
            const waMessageId = statusUpdate.id;
            const newStatus = statusUpdate.status; // sent, delivered, read, failed

            const recipient = typeof statusUpdate.recipient_id === "string" ? statusUpdate.recipient_id : "";
            if (recipient) allPhones.push(normalizePhone(recipient));

            // Capture Meta error details (especially for failed media)
            const statusErrors = Array.isArray(statusUpdate.errors) ? statusUpdate.errors : [];
            if (newStatus === "failed" && statusErrors.length) {
              const details = statusErrors
                .map((e: any) => {
                  const code = e?.code ?? "";
                  const title = e?.title ?? e?.message ?? "";
                  const det = e?.details ?? e?.error_data?.details ?? "";
                  return [code, title, det].filter(Boolean).join(" - ");
                })
                .filter(Boolean)
                .join(" | ");
              errors.push(`wa_failed(${waMessageId}): ${details}`);
            }

            if (waMessageId && newStatus) {
              await supabase
                .from("messages")
                .update({ status: newStatus })
                .eq("wa_message_id", waMessageId);
            }
          } catch (err) {
            console.error("Status update error:", err);
          }
        }

        const incomingMessages = Array.isArray(value?.messages) ? value.messages : [];
        const contacts = Array.isArray(value?.contacts) ? value.contacts : [];

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
            const media = extractMediaInfo(message);

            // Download and store media if present
            let storedMediaUrl: string | null = null;
            let storedMediaType: string | null = null;

            if (media.id && config?.access_token) {
              storedMediaUrl = await downloadAndStoreMedia(
                media.id,
                config.access_token,
                media.mimeType || "application/octet-stream",
                supabase
              );
              storedMediaType = media.mimeType || null;
              console.log("Media stored:", storedMediaUrl ? "success" : "failed", media.type);
            }

            const inboundAt = new Date().toISOString();

            // Insert message
            const { error: insertErr } = await supabase.from("messages").insert({
              wa_message_id: message.id,
              contact_phone: contactPhone,
              contact_name: contactName,
              direction: "inbound",
              body,
              status: "delivered",
              media_url: storedMediaUrl,
              media_type: storedMediaType,
              tenant_id: config?.tenant_id || null,
              created_at: inboundAt,
            });

            if (insertErr) {
              console.error("Insert message error:", insertErr.message);
              errors.push(`msg_insert: ${insertErr.message}`);
              if (insertErr.message?.includes("duplicate")) continue;
            }

            // Upsert contact
            await supabase.from("contacts").upsert(
              { phone: contactPhone, name: contactName, tenant_id: config?.tenant_id || null },
              { onConflict: "phone" }
            );

            await upsertConversationFromMessage({
              supabase,
              contactPhone,
              tenantId: config?.tenant_id || null,
              module: config?.module || "confirm",
              direction: "inbound",
              atIso: inboundAt,
            });

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

                  const outboundAt = new Date().toISOString();
                  const { error: autoInsertErr } = await supabase.from("messages").insert({
                    wa_message_id: waResult.messages?.[0]?.id,
                    contact_phone: contactPhone,
                    contact_name: contactName,
                    direction: "outbound",
                    body: autoResponse,
                    status: "sent",
                    tenant_id: config?.tenant_id || null,
                    created_at: outboundAt,
                  });

                  if (autoInsertErr) {
                    console.error("Auto-reply save error:", autoInsertErr.message);
                    errors.push(`auto_reply_insert: ${autoInsertErr.message}`);
                  } else {
                    await upsertConversationFromMessage({
                      supabase,
                      contactPhone,
                      tenantId: config?.tenant_id || null,
                      module: config?.module || "confirm",
                      direction: "outbound",
                      atIso: outboundAt,
                    });
                  }
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
