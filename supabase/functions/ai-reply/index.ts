import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AiConfig {
  provider: string;
  api_key: string | null;
  model: string;
  is_active: boolean;
}

interface ModulePrompt {
  system_prompt: string;
  is_active: boolean;
  escalation_keywords: string[];
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Call Lovable AI Gateway */
async function callLovable(model: string, messages: ChatMessage[]): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (res.status === 429) throw new Error("RATE_LIMITED");
  if (res.status === 402) throw new Error("PAYMENT_REQUIRED");
  if (!res.ok) {
    const t = await res.text();
    console.error("Lovable AI error:", res.status, t);
    throw new Error(`Lovable AI error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/** Call OpenAI API directly */
async function callOpenAI(apiKey: string, model: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("OpenAI error:", res.status, t);
    throw new Error(`OpenAI error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/** Call Google Gemini API directly */
async function callGemini(apiKey: string, model: string, messages: ChatMessage[]): Promise<string> {
  // Convert OpenAI-style messages to Gemini format
  const systemInstruction = messages.find(m => m.role === "system");
  const conversationMessages = messages.filter(m => m.role !== "system");

  const contents = conversationMessages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: any = { contents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const t = await res.text();
    console.error("Gemini error:", res.status, t);
    throw new Error(`Gemini error: ${res.status}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

/** Call Anthropic Claude API directly */
async function callAnthropic(apiKey: string, model: string, messages: ChatMessage[]): Promise<string> {
  const systemMsg = messages.find(m => m.role === "system");
  const conversationMessages = messages
    .filter(m => m.role !== "system")
    .map(m => ({ role: m.role, content: m.content }));

  const body: any = {
    model,
    max_tokens: 1024,
    messages: conversationMessages,
  };
  if (systemMsg) body.system = systemMsg.content;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("Anthropic error:", res.status, t);
    throw new Error(`Anthropic error: ${res.status}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { tenantId, contactPhone, module, incomingMessage } = await req.json();

    if (!tenantId || !contactPhone || !module || !incomingMessage) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Load AI config for this tenant
    const { data: aiConfig } = await supabase
      .from("ai_config")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!aiConfig || !aiConfig.is_active) {
      return new Response(
        JSON.stringify({ skip: true, reason: "AI not active" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Load module-specific prompt
    const { data: modulePrompt } = await supabase
      .from("ai_module_prompts")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("module", module)
      .maybeSingle();

    if (!modulePrompt || !modulePrompt.is_active || !modulePrompt.system_prompt?.trim()) {
      return new Response(
        JSON.stringify({ skip: true, reason: "Module AI prompt not configured or not active" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check escalation keywords - if message contains escalation keywords, skip AI
    const escalationKeywords: string[] = modulePrompt.escalation_keywords || [];
    const lowerMsg = incomingMessage.toLowerCase();
    const shouldEscalate = escalationKeywords.some(
      (kw: string) => kw.trim() && lowerMsg.includes(kw.trim().toLowerCase())
    );

    if (shouldEscalate) {
      return new Response(
        JSON.stringify({ skip: true, reason: "Escalation keyword detected", escalated: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Load conversation history (last 20 messages for context)
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("body, direction, created_at")
      .eq("contact_phone", contactPhone)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Build conversation history (oldest first)
    const history: ChatMessage[] = (recentMessages || [])
      .reverse()
      .map((m: any) => ({
        role: m.direction === "inbound" ? "user" as const : "assistant" as const,
        content: m.body,
      }));

    // Add the current incoming message
    history.push({ role: "user", content: incomingMessage });

    // Build full messages array with system prompt
    const messages: ChatMessage[] = [
      { role: "system", content: modulePrompt.system_prompt },
      ...history,
    ];

    // 5. Call the appropriate AI provider
    let aiResponse: string;
    const provider = aiConfig.provider;
    const model = aiConfig.model;

    try {
      switch (provider) {
        case "lovable":
          aiResponse = await callLovable(model, messages);
          break;
        case "openai":
          if (!aiConfig.api_key) throw new Error("OpenAI API key not configured");
          aiResponse = await callOpenAI(aiConfig.api_key, model, messages);
          break;
        case "google":
          if (!aiConfig.api_key) throw new Error("Google API key not configured");
          aiResponse = await callGemini(aiConfig.api_key, model, messages);
          break;
        case "anthropic":
          if (!aiConfig.api_key) throw new Error("Anthropic API key not configured");
          aiResponse = await callAnthropic(aiConfig.api_key, model, messages);
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
    } catch (providerErr) {
      const errMsg = providerErr instanceof Error ? providerErr.message : "Unknown AI error";
      console.error("AI provider error:", errMsg);
      return new Response(
        JSON.stringify({ error: errMsg, skip: true }),
        { status: errMsg === "RATE_LIMITED" ? 429 : errMsg === "PAYMENT_REQUIRED" ? 402 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!aiResponse?.trim()) {
      return new Response(
        JSON.stringify({ skip: true, reason: "Empty AI response" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ reply: aiResponse.trim() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ai-reply error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
