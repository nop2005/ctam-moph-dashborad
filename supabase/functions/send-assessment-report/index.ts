import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendReportRequest {
  assessment_ids: string[];
}

// Severity labels mapping
const severityLabels: Record<string, string> = {
  no_fine_training: "ไม่ร้ายแรง (อบรม)",
  fine_under_1m: "ปรับไม่เกิน 1 ล้าน",
  fine_1m_to_3m: "ปรับ 1-3 ล้าน",
  fine_over_3m: "ปรับเกิน 3 ล้าน",
  criminal: "โทษทางอาญา",
};

serve(async (req: Request): Promise<Response> => {
  console.log("send-assessment-report function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Create client with user's token for auth verification
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is logged in
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      throw new Error("Unauthorized");
    }

    console.log("User authenticated:", user.id);

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is regional admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*, health_regions(*)")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile error:", profileError);
      throw new Error("Profile not found");
    }

    if (profile.role !== "regional") {
      throw new Error("Only regional admin can send reports");
    }

    console.log("Regional admin verified:", profile.full_name);

    const { assessment_ids }: SendReportRequest = await req.json();

    if (!assessment_ids || assessment_ids.length === 0) {
      throw new Error("No assessments selected");
    }

    console.log("Processing assessments:", assessment_ids.length);

    // Fetch assessments with all related data
    const { data: assessments, error: assessError } = await supabaseAdmin
      .from("assessments")
      .select(`
        *,
        hospitals(
          id, name, 
          provinces(id, name, health_regions(id, name, region_number))
        ),
        health_offices(
          id, name, province_id,
          provinces!health_offices_province_id_fkey(id, name),
          health_regions(id, name, region_number)
        )
      `)
      .in("id", assessment_ids);

    if (assessError) {
      console.error("Error fetching assessments:", assessError);
      throw new Error("Failed to fetch assessments");
    }

    if (!assessments || assessments.length === 0) {
      throw new Error("No assessments found");
    }

    console.log("Fetched assessments:", assessments.length);

    // Fetch impact scores for each assessment
    const { data: impactScores, error: impactError } = await supabaseAdmin
      .from("impact_scores")
      .select("*")
      .in("assessment_id", assessment_ids);

    if (impactError) {
      console.error("Error fetching impact scores:", impactError);
    }

    const impactMap = new Map(impactScores?.map(is => [is.assessment_id, is]) || []);

    // Fetch assessment items to calculate passed count
    const { data: assessmentItems, error: itemsError } = await supabaseAdmin
      .from("assessment_items")
      .select("assessment_id, status, score")
      .in("assessment_id", assessment_ids);

    if (itemsError) {
      console.error("Error fetching assessment items:", itemsError);
    }

    // Calculate passed items per assessment
    const passedCountMap = new Map<string, number>();
    assessmentItems?.forEach(item => {
      if (item.score === 1) {
        const current = passedCountMap.get(item.assessment_id) || 0;
        passedCountMap.set(item.assessment_id, current + 1);
      }
    });

    // Get health region info
    const healthRegion = (profile as any).health_regions;
    const regionName = healthRegion?.name || `เขตสุขภาพที่ ${healthRegion?.region_number || "?"}`;

    // Build email content
    const appUrl = Deno.env.get("APP_URL") || "https://ctam.cmhis.org";
    const currentDate = new Date().toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Generate table rows
    const tableRows = assessments.map(assessment => {
      const hospital = assessment.hospitals as any;
      const healthOffice = assessment.health_offices as any;
      
      const unitName = hospital?.name || healthOffice?.name || "-";
      const provinceName = hospital?.provinces?.name || healthOffice?.provinces?.name || "-";
      
      const impact = impactMap.get(assessment.id);
      const passedCount = passedCountMap.get(assessment.id) || 0;
      
      // Format incident info
      let incidentText = "ไม่มี";
      if (impact?.had_incident) {
        const hours = impact.incident_recovery_hours || 0;
        incidentText = `มี (กู้คืน ${hours} ชม.)`;
      }
      
      // Format breach info
      let breachText = "ไม่มี";
      if (impact?.had_data_breach) {
        const severity = impact.breach_severity || "";
        const severityLabel = severityLabels[severity] || severity;
        breachText = `มี (${severityLabel})`;
      }

      return `
        <tr>
          <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">${unitName}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">${provinceName}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">${assessment.assessment_period}/${(assessment.fiscal_year || 0) + 543}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center; font-weight: bold;">${assessment.total_score !== null ? Number(assessment.total_score).toFixed(2) : "-"}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">${assessment.quantitative_score !== null ? Number(assessment.quantitative_score).toFixed(2) : "-"}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">${passedCount}/17</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">${assessment.qualitative_score !== null ? Number(assessment.qualitative_score).toFixed(2) : "-"}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center; color: ${impact?.had_incident ? "#dc2626" : "#16a34a"};">${incidentText}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center; color: ${impact?.had_data_breach ? "#dc2626" : "#16a34a"};">${breachText}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">
            <a href="${appUrl}/assessment/${assessment.id}" 
               style="display: inline-block; padding: 6px 12px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 4px; font-size: 12px;">
              ดูรายละเอียด
            </a>
          </td>
        </tr>
      `;
    }).join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>รายงานสรุปผลการประเมิน CTAM</title>
      </head>
      <body style="font-family: 'Sarabun', 'Noto Sans Thai', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
        <div style="max-width: 1200px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">รายงานสรุปผลการประเมิน</h1>
            <h2 style="color: #bfdbfe; margin: 10px 0 0; font-size: 18px; font-weight: normal;">Cyber Threat Assessment Management (CTAM)</h2>
          </div>

          <!-- Info Section -->
          <div style="padding: 20px 30px; background-color: #f8fafc; border-bottom: 1px solid #e5e7eb;">
            <table style="width: 100%;">
              <tr>
                <td style="padding: 8px 0;">
                  <strong style="color: #374151;">เขตสุขภาพ:</strong>
                  <span style="color: #1e40af; font-weight: bold; margin-left: 8px;">${regionName}</span>
                </td>
                <td style="padding: 8px 0; text-align: right;">
                  <strong style="color: #374151;">วันที่ส่งรายงาน:</strong>
                  <span style="color: #374151; margin-left: 8px;">${currentDate}</span>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding: 8px 0;">
                  <strong style="color: #374151;">จำนวนแบบประเมิน:</strong>
                  <span style="color: #1e40af; font-weight: bold; margin-left: 8px;">${assessments.length} รายการ</span>
                </td>
              </tr>
            </table>
          </div>

          <!-- Table -->
          <div style="padding: 20px; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr style="background-color: #1e40af; color: white;">
                  <th style="padding: 12px; border: 1px solid #1e40af; text-align: left;">โรงพยาบาล/หน่วยงาน</th>
                  <th style="padding: 12px; border: 1px solid #1e40af; text-align: left;">จังหวัด</th>
                  <th style="padding: 12px; border: 1px solid #1e40af; text-align: center;">ปี/ครั้ง</th>
                  <th style="padding: 12px; border: 1px solid #1e40af; text-align: center;">คะแนนรวม</th>
                  <th style="padding: 12px; border: 1px solid #1e40af; text-align: center;">เชิงปริมาณ</th>
                  <th style="padding: 12px; border: 1px solid #1e40af; text-align: center;">ผ่าน/17</th>
                  <th style="padding: 12px; border: 1px solid #1e40af; text-align: center;">ผลกระทบ</th>
                  <th style="padding: 12px; border: 1px solid #1e40af; text-align: center;">เหตุการณ์โจมตี</th>
                  <th style="padding: 12px; border: 1px solid #1e40af; text-align: center;">การละเมิดข้อมูล</th>
                  <th style="padding: 12px; border: 1px solid #1e40af; text-align: center;">ลิงก์</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>

          <!-- Footer -->
          <div style="padding: 20px 30px; background-color: #f8fafc; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">
              <strong>ส่งโดย:</strong> ${profile.full_name || "Regional Admin"}
            </p>
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
              ระบบ CTAM - Cyber Threat Assessment Management<br>
              ส่งอัตโนมัติจากระบบประเมินความปลอดภัยไซเบอร์
            </p>
          </div>

        </div>
      </body>
      </html>
    `;

    // Send email
    console.log("Sending email...");
    const emailResponse = await resend.emails.send({
      from: "CTAM Report <report@ctam.cmhis.org>",
      to: ["cyberaudit@moph.go.th", "nopparat.ratcha@sansaihospital.go.th"],
      subject: `สรุปผลการประเมิน CTAM ${regionName} - ${assessments.length} รายการ`,
      html: htmlContent,
    });

    // Check if email was sent successfully
    if (emailResponse.error) {
      console.error("Email sending failed:", emailResponse.error);
      throw new Error(`Failed to send email: ${emailResponse.error.message}`);
    }

    console.log("Email sent successfully:", emailResponse.data);

    // Update assessments with email sent info ONLY after successful send
    const { error: updateError } = await supabaseAdmin
      .from("assessments")
      .update({
        email_sent_at: new Date().toISOString(),
        email_sent_by: profile.id,
      })
      .in("id", assessment_ids);

    if (updateError) {
      console.error("Error updating assessments:", updateError);
    }

    console.log("Assessments updated with email_sent_at");

    return new Response(
      JSON.stringify({
        success: true,
        message: `ส่งอีเมลสำเร็จ ${assessments.length} รายการ`,
        emailId: emailResponse.data?.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in send-assessment-report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
