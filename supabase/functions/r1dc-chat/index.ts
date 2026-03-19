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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
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
