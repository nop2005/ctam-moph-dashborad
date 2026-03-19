import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompt = `คุณคือ AI Assistant สำหรับ Dashboard เขตสุขภาพที่ 1 เชียงใหม่ ประเทศไทย
มีความเชี่ยวชาญด้านข้อมูลสาธารณสุข ระบบ HIS (103 ระบบ HL7 FHIR) และ Non-HIS

ข้อมูล dashboard ปัจจุบัน:
- งบประมาณรวม 4,820 ล้านบาท เบิกจ่าย 68.4%
- บุคลากรรวม 35,066 คน ว่าง 2,340 อัตรา แพทย์ขาดแคลน รพช. 12 แห่ง
- OPD 318,000 ครั้ง/วัน (+4.2% YoY), ผู้ป่วยใน 182,400 ราย Bed Occ. 78.3% ALoS 4.2 วัน
- ครุภัณฑ์ 14,230 ชิ้น มูลค่า 2,140 ลบ. ชำรุด 8.2%
- Bed Occ. สูงสุด: ลำพูน 88%, เชียงใหม่ 82%, ลำปาง 79%
- งบ UC ค้างจ่าย: รพ.เชียงราย, พะเยา, แพร่ รวม 38.5 ลบ.
- Data Quality Score 91.4% (ML/AI ตรวจสอบ HIS 103 ระบบ)
- DRG สูงสุด: DM+HTN 48,200, มะเร็ง 38,400, หัวใจ 31,200
- สิทธิ์: UC 58%, ข้าราชการ 22%, ประกันสังคม 13%
- 8 จังหวัด: เชียงใหม่ เชียงราย ลำปาง ลำพูน พะเยา แพร่ น่าน แม่ฮ่องสอน

ตอบเป็นภาษาไทย กระชับ เน้นตัวเลขและคำแนะนำเชิงนโยบาย`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // Convert OpenAI-style messages to Gemini format
    const geminiContents = [];
    
    // Add system instruction separately (Gemini uses systemInstruction)
    const userMessages = messages.filter((m: any) => m.role !== "system");
    
    for (const msg of userMessages) {
      geminiContents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: geminiContents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const t = await response.text();
      console.error("Gemini API error:", response.status, t);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Gemini API error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transform Gemini SSE stream to OpenAI-compatible SSE stream
    const reader = response.body!.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  // Convert to OpenAI-compatible format
                  const chunk = {
                    choices: [{ delta: { content: text } }],
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
              } catch {
                // skip malformed chunks
              }
            }
          }
        } catch (e) {
          console.error("Stream error:", e);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("r1dc-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
