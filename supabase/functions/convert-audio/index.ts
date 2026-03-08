import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FFmpeg } from "npm:@ffmpeg/ffmpeg@0.12.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let ffmpeg: FFmpeg | null = null;
let ffmpegLoading: Promise<void> | null = null;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getInputExt = (mime: string) => {
  const normalized = mime.toLowerCase();
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("mp4")) return "m4a";
  if (normalized.includes("mpeg")) return "mp3";
  if (normalized.includes("aac")) return "aac";
  if (normalized.includes("amr")) return "amr";
  if (normalized.includes("webm")) return "webm";
  return "bin";
};

const getFfmpeg = async () => {
  if (!ffmpeg) ffmpeg = new FFmpeg();

  if (!ffmpegLoading) {
    ffmpegLoading = ffmpeg.load({
      coreURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js",
      wasmURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm",
      workerURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.worker.js",
    });
  }

  await ffmpegLoading;
  return ffmpeg;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { sourceUrl, sourceMime } = await req.json();

    if (!sourceUrl || typeof sourceUrl !== "string") {
      return json({ error: "Missing sourceUrl" }, 400);
    }

    const normalizedSourceMime =
      (typeof sourceMime === "string" && sourceMime.toLowerCase().split(";")[0].trim()) ||
      "audio/mp4";

    if (normalizedSourceMime === "audio/ogg") {
      return json({ success: true, url: sourceUrl, mimeType: "audio/ogg" });
    }

    const sourceRes = await fetch(sourceUrl);
    if (!sourceRes.ok) {
      return json(
        { error: "Failed to fetch source audio", details: await sourceRes.text() },
        400,
      );
    }

    const sourceBuffer = await sourceRes.arrayBuffer();
    if (!sourceBuffer.byteLength) {
      return json({ error: "Source audio is empty" }, 400);
    }

    const ff = await getFfmpeg();
    const inputName = `input-${Date.now()}.${getInputExt(normalizedSourceMime)}`;
    const outputName = `output-${Date.now()}.ogg`;

    await ff.writeFile(inputName, new Uint8Array(sourceBuffer));

    await ff.exec([
      "-i",
      inputName,
      "-ac",
      "1",
      "-ar",
      "48000",
      "-c:a",
      "libopus",
      "-b:a",
      "32k",
      outputName,
    ]);

    const converted = await ff.readFile(outputName);
    const convertedBytes = converted instanceof Uint8Array
      ? converted
      : new TextEncoder().encode(String(converted));

    if (!convertedBytes.byteLength) {
      return json({ error: "Converted audio is empty" }, 500);
    }

    const convertedPath = `converted/voice-${Date.now()}-${Math.random().toString(36).slice(2)}.ogg`;

    const { error: uploadError } = await supabase.storage
      .from("chat-attachments")
      .upload(convertedPath, convertedBytes, {
        contentType: "audio/ogg",
        upsert: false,
      });

    if (uploadError) {
      return json({ error: "Failed to store converted audio", details: uploadError.message }, 500);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("chat-attachments").getPublicUrl(convertedPath);

    return json({ success: true, url: publicUrl, mimeType: "audio/ogg" });
  } catch (error) {
    console.error("convert-audio error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Unknown conversion error" },
      500,
    );
  }
});
