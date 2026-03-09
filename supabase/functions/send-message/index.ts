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

async function convertAudioIfNeeded(params: {
  supabaseUrl: string;
  serviceKey: string;
  mediaUrl: string;
  baseAudioMime: string;
}) {
  const { supabaseUrl, serviceKey, mediaUrl, baseAudioMime } = params;

  if (baseAudioMime === "audio/ogg") {
    return { ok: true as const, url: mediaUrl, mimeType: "audio/ogg", converted: false };
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/convert-audio`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sourceUrl: mediaUrl, sourceMime: baseAudioMime }),
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.url) {
      console.warn("convert-audio failed:", payload);
      return {
        ok: false as const,
        error: "تعذّر تحويل ملف الصوت لصيغة مدعومة للإرسال. جرّب Chrome/Edge أو سجّل بصيغة OGG.",
        details: payload,
      };
    }

    return {
      ok: true as const,
      url: payload.url as string,
      mimeType: (payload.mimeType as string) || "audio/ogg",
      converted: true,
    };
  } catch (error) {
    console.warn("convert-audio exception:", error);
    return {
      ok: false as const,
      error: "فشل تحويل ملف الصوت قبل الإرسال.",
      details: error instanceof Error ? error.message : "unknown",
    };
  }
}

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
      return json({ error: "Missing 'to' or 'message'/'mediaUrl'" }, 400);
    }

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
      return json({ error: "WhatsApp API not configured" }, 400);
    }

    const waUrl = `https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`;
    const mediaUploadUrl = `https://graph.facebook.com/v21.0/${config.phone_number_id}/media`;
    const headers = {
      Authorization: `Bearer ${config.access_token}`,
      "Content-Type": "application/json",
    };

    const audioExtByMime: Record<string, string> = {
      "audio/ogg": "ogg",
      "audio/mpeg": "mp3",
      "audio/amr": "amr",
      "audio/mp4": "m4a",
      "audio/aac": "aac",
      "audio/webm": "webm",
    };

    let waPayload: any = {
      messaging_product: "whatsapp",
      to,
    };

    // For DB audit/debug: store the *actual* media URL/type we attempted to send
    let storedMediaUrl: string | null = mediaUrl || null;
    let storedMediaType: string | null = mediaType || null;

    if (replyToMessageId) {
      const { data: replyMsg } = await supabase
        .from("messages")
        .select("wa_message_id")
        .eq("id", replyToMessageId)
        .single();
      if (replyMsg?.wa_message_id) {
        waPayload.context = { message_id: replyMsg.wa_message_id };
      }
    }

    if (mediaUrl && mediaType) {
      const mimeType = mediaType.toLowerCase();

      if (mimeType.startsWith("image")) {
        waPayload.type = "image";
        waPayload.image = { link: mediaUrl, caption: message || undefined };
      } else if (mimeType.startsWith("video")) {
        waPayload.type = "video";
        waPayload.video = { link: mediaUrl, caption: message || undefined };
      } else if (mimeType.startsWith("audio")) {
        const baseAudioMime = mimeType.split(";")[0].trim();

        const convertResult = await convertAudioIfNeeded({
          supabaseUrl,
          serviceKey,
          mediaUrl,
          baseAudioMime,
        });

        if (!convertResult.ok) {
          return json(
            {
              error: convertResult.error,
              details: convertResult.details,
            },
            422,
          );
        }

        const finalAudioMime = convertResult.mimeType;
        const finalAudioUrl = convertResult.url;

        const supportedAudioTypes = ["audio/ogg", "audio/mpeg", "audio/amr", "audio/mp4", "audio/aac"];
        const isSupportedAudio = supportedAudioTypes.includes(finalAudioMime);

        if (!isSupportedAudio) {
          return json(
            {
              error: "Unsupported audio format",
              details:
                `Audio format (${finalAudioMime}) غير مدعوم بعد التحويل. Supported: audio/ogg;codecs=opus, audio/mpeg, audio/amr, audio/mp4, audio/aac`,
            },
            400,
          );
        }

        const audioRes = await fetch(finalAudioUrl);
        if (!audioRes.ok) {
          return json({ error: "Failed to fetch audio file", details: await audioRes.text() }, 400);
        }

        const audioBuffer = await audioRes.arrayBuffer();
        const ext = audioExtByMime[finalAudioMime] || "bin";

        // WhatsApp expects Opus voice notes as audio/ogg;codecs=opus
        const uploadMime = finalAudioMime === "audio/ogg" ? "audio/ogg;codecs=opus" : finalAudioMime;

        const formData = new FormData();
        formData.append("messaging_product", "whatsapp");
        formData.append(
          "file",
          new File([audioBuffer], `voice-${Date.now()}.${ext}`, { type: uploadMime }),
        );

        const uploadRes = await fetch(mediaUploadUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${config.access_token}` },
          body: formData,
        });

        const uploadResult = await uploadRes.json();
        if (!uploadRes.ok || !uploadResult?.id) {
          return json({ error: "WhatsApp media upload error", details: uploadResult }, uploadRes.status || 400);
        }

        waPayload.type = "audio";
        waPayload.audio = { id: uploadResult.id };

        // Persist the sent media details (after conversion)
        storedMediaUrl = finalAudioUrl;
        storedMediaType = finalAudioMime;
      } else {
        waPayload.type = "document";
        waPayload.document = { link: mediaUrl, caption: message || undefined };
      }
    } else {
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
      return json({ error: "WhatsApp API error", details: waResult }, res.status);
    }

    const nowIso = new Date().toISOString();

    await supabase.from("messages").insert({
      wa_message_id: waResult.messages?.[0]?.id,
      contact_phone: to,
      direction: "outbound",
      body: message || (mediaUrl && mediaType?.startsWith('audio') ? "[رسالة صوتية]" : (mediaUrl ? "[مرفق]" : "")),
      status: "sent",
      media_url: storedMediaUrl,
      media_type: storedMediaType,
      reply_to_message_id: replyToMessageId || null,
      tenant_id: config.tenant_id || tenantId || null,
      created_at: nowIso,
    });

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

    return json({ success: true, data: waResult });
  } catch (error) {
    console.error("Send message error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return json({ error: errorMessage }, 500);
  }
});
