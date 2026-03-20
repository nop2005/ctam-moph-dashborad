import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchDashboardData(): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Fetch key dashboard data in parallel
    const [
      { data: regions },
      { data: provinces },
      { data: hospitals },
      { data: healthOffices },
      { data: assessments },
      { data: personnel },
      { data: budgetRecords },
    ] = await Promise.all([
      supabase.from("health_regions").select("*").order("region_number"),
      supabase.from("provinces").select("*").order("name"),
      supabase.from("hospitals").select("*, provinces(name)").order("name"),
      supabase.from("health_offices").select("*, provinces(name)").order("name"),
      supabase.from("assessments").select("id, hospital_id, health_office_id, fiscal_year, assessment_period, status, total_score, quantitative_score, qualitative_score, impact_score, created_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("personnel").select("id, first_name, last_name, position, hospital_id, health_office_id").limit(1000),
      supabase.from("budget_records").select("id, fiscal_year, budget_amount, category_id, hospital_id, health_office_id").limit(500),
    ]);

    // Build summary
    const totalHospitals = hospitals?.length || 0;
    const totalHealthOffices = healthOffices?.length || 0;
    const totalPersonnel = personnel?.length || 0;
    const totalAssessments = assessments?.length || 0;

    // Assessment status breakdown
    const statusCounts: Record<string, number> = {};
    assessments?.forEach((a: any) => {
      statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
    });

    // Score averages
    const scoredAssessments = assessments?.filter((a: any) => a.total_score != null) || [];
    const avgTotalScore = scoredAssessments.length > 0
      ? (scoredAssessments.reduce((s: number, a: any) => s + (a.total_score || 0), 0) / scoredAssessments.length).toFixed(1)
      : "N/A";

    // Budget totals
    const totalBudget = budgetRecords?.reduce((s: number, b: any) => s + (b.budget_amount || 0), 0) || 0;

    // Hospital list with provinces
    const hospitalList = hospitals?.map((h: any) => `${h.name} (${h.provinces?.name || 'ไม่ระบุจังหวัด'})`).join(", ") || "ไม่มีข้อมูล";

    // Province list
    const provinceList = provinces?.map((p: any) => p.name).join(", ") || "ไม่มีข้อมูล";

    // Personnel positions breakdown
    const positionCounts: Record<string, number> = {};
    personnel?.forEach((p: any) => {
      const pos = p.position || "ไม่ระบุตำแหน่ง";
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    });
    const positionSummary = Object.entries(positionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pos, count]) => `${pos}: ${count} คน`)
      .join(", ");

    return `
=== ข้อมูลจากฐานข้อมูล Dashboard (ข้อมูลจริง, แหล่งที่มา: ฐานข้อมูลภายใน CTAM) ===
จังหวัดในเขต: ${provinceList}
จำนวนโรงพยาบาล: ${totalHospitals} แห่ง
จำนวนสำนักงานสาธารณสุข: ${totalHealthOffices} แห่ง
จำนวนบุคลากรในระบบ: ${totalPersonnel} คน
ตำแหน่งบุคลากร: ${positionSummary || "ไม่มีข้อมูลตำแหน่ง"}

รายชื่อโรงพยาบาล: ${hospitalList}

=== ข้อมูลการประเมิน CTAM ===
จำนวนการประเมินทั้งหมด: ${totalAssessments} รายการ
สถานะการประเมิน: ${Object.entries(statusCounts).map(([k, v]) => `${k}: ${v}`).join(", ") || "ไม่มีข้อมูล"}
คะแนนเฉลี่ยรวม: ${avgTotalScore}

=== ข้อมูลงบประมาณ ===
งบประมาณรวมในระบบ: ${totalBudget.toLocaleString()} บาท
จำนวนรายการงบประมาณ: ${budgetRecords?.length || 0} รายการ
`;
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return "ไม่สามารถดึงข้อมูลจากฐานข้อมูลได้";
  }
}

const baseSystemPrompt = `คุณคือ AI Assistant สำหรับ Smart Dashboard เขตสุขภาพที่ 1 เชียงใหม่ ประเทศไทย
มีความเชี่ยวชาญด้านข้อมูลสาธารณสุข ระบบ HIS (103 ระบบ HL7 FHIR) และ Non-HIS

กฎการตอบ:
1. **ค้นหาข้อมูลจาก Dashboard ก่อนเสมอ** - หากคำถามเกี่ยวข้องกับข้อมูลในระบบ Dashboard (เช่น โรงพยาบาล บุคลากร งบประมาณ คะแนนประเมิน) ให้ใช้ข้อมูลจากฐานข้อมูลภายในที่ให้ไว้ด้านล่าง และระบุ "📊 แหล่งที่มา: ข้อมูลจากฐานข้อมูลภายใน Smart Dashboard CTAM"
2. **หากข้อมูลไม่มีในระบบ** - ให้แจ้งผู้ใช้ก่อนว่า "⚠️ ไม่พบข้อมูลนี้ในฐานข้อมูล R1-Datacenter จึงค้นหาจากแหล่งข้อมูลภายนอกให้" จากนั้นใช้ google_search เพื่อค้นหาข้อมูลจากแหล่งภายนอก และระบุแหล่งที่มาจาก grounding metadata
3. **อ้างอิงแหล่งที่มาเสมอ** - ทุกคำตอบต้องมีส่วน "📌 แหล่งอ้างอิง:" ท้ายคำตอบ ระบุว่ามาจากฐานข้อมูลภายในหรือแหล่งภายนอก
4. ตอบเป็นภาษาไทย กระชับ เน้นตัวเลขและคำแนะนำเชิงนโยบาย

ข้อมูลอ้างอิงคงที่ (Dashboard KPI):
- งบประมาณรวม 4,820 ล้านบาท เบิกจ่าย 68.4%
- บุคลากรรวม 35,066 คน ว่าง 2,340 อัตรา แพทย์ขาดแคลน รพช. 12 แห่ง
- OPD 318,000 ครั้ง/วัน (+4.2% YoY), ผู้ป่วยใน 182,400 ราย Bed Occ. 78.3% ALoS 4.2 วัน
- ครุภัณฑ์ 14,230 ชิ้น มูลค่า 2,140 ลบ. ชำรุด 8.2%
- Data Quality Score 91.4%
- 8 จังหวัด: เชียงใหม่ เชียงราย ลำปาง ลำพูน พะเยา แพร่ น่าน แม่ฮ่องสอน`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // Fetch real dashboard data from database
    const dashboardData = await fetchDashboardData();

    // Build system prompt with real data
    const systemPrompt = `${baseSystemPrompt}\n\n${dashboardData}`;

    // Convert messages to Gemini format
    const userMessages = messages.filter((m: any) => m.role !== "system");
    const geminiContents = userMessages.map((msg: any) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

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
          tools: [{ googleSearch: {} }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
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
                const candidate = parsed.candidates?.[0];
                const text = candidate?.content?.parts?.[0]?.text;

                // Extract grounding metadata for short citations
                const groundingMeta = candidate?.groundingMetadata;
                let citations = "";
                if (groundingMeta?.groundingChunks?.length > 0) {
                  const sources = groundingMeta.groundingChunks
                    .filter((c: any) => c.web?.uri)
                    .map((c: any) => {
                      const title = c.web.title || new URL(c.web.uri).hostname;
                      // Keep title short
                      const shortTitle = title.length > 30 ? title.slice(0, 30) + "…" : title;
                      return `[${shortTitle}](${c.web.uri})`;
                    })
                    .slice(0, 3);
                  if (sources.length > 0) {
                    citations = "\n\n📌 อ้างอิง: " + sources.join(" · ");
                  }
                }

                if (text) {
                  const chunk = {
                    choices: [{ delta: { content: text } }],
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }

                // Send citations at the end of a candidate's finish
                if (citations && candidate?.finishReason) {
                  const citChunk = {
                    choices: [{ delta: { content: citations } }],
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(citChunk)}\n\n`));
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
