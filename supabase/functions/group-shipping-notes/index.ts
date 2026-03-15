const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callLovableAI(messages: ChatMessage[]): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI Gateway error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { notes } = await req.json();

    if (!notes || !Array.isArray(notes) || notes.length === 0) {
      return new Response(JSON.stringify({ groups: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate and clean
    const uniqueNotes = [...new Set(notes.filter((n: string) => n && n.trim()))];

    if (uniqueNotes.length === 0) {
      return new Response(JSON.stringify({ groups: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `أنت مساعد متخصص في تصنيف ملاحظات شركات الشحن.

المطلوب: تجميع ملاحظات الشحن المتشابهة في معنى واحد تحت اسم مجموعة واحدة قصيرة وواضحة.

أمثلة:
- "لا يرد"، "العميل لا يرد"، "الهاتف لا يرد"، "لا يرد على الاتصال"، "no answer" → مجموعة: "لا يرد"
- "مغلق"، "الهاتف مغلق"، "الموبايل مغلق"، "phone off" → مجموعة: "الهاتف مغلق"
- "عنوان خاطئ"، "العنوان غير صحيح"، "عنوان غلط" → مجموعة: "عنوان خاطئ"
- "تم التسليم"، "delivered"، "تم الاستلام" → مجموعة: "تم التسليم"
- "مرتجع"، "راجع"، "returned" → مجموعة: "مرتجع"
- "مؤجل"، "تأجيل"، "postponed" → مجموعة: "مؤجل"

القواعد:
1. اسم المجموعة يكون بالعربي وقصير (كلمة أو كلمتين)
2. إذا ملاحظة لا تشبه أي شيء آخر، ضعها في مجموعة باسمها
3. أرجع JSON فقط بدون أي نص إضافي

أرجع الناتج بهذا الشكل بالضبط:
{
  "اسم المجموعة": ["ملاحظة1", "ملاحظة2"],
  "اسم مجموعة أخرى": ["ملاحظة3"]
}`;

    const userMessage = `صنف هذه الملاحظات:\n${JSON.stringify(uniqueNotes, null, 2)}`;

    const aiResponse = await callLovableAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ]);

    // Parse AI response - extract JSON
    let groups: Record<string, string[]> = {};
    try {
      // Try to extract JSON from response (might have markdown code blocks)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        groups = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiResponse);
      // Fallback: each note is its own group
      uniqueNotes.forEach((note) => {
        groups[note] = [note];
      });
    }

    return new Response(JSON.stringify({ groups }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in group-shipping-notes:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
