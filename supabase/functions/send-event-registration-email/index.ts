import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  registration_id: string;
}

const DIETARY_LABEL: Record<string, string> = {
  normal: "อาหารทั่วไป",
  vegetarian: "มังสวิรัติ",
  vegan: "เจ / วีแกน",
  halal: "ฮาลาล",
  allergy: "แพ้อาหาร (ระบุ)",
};

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { registration_id } = (await req.json()) as Payload;
    if (!registration_id) throw new Error("registration_id is required");

    const { data: reg, error } = await admin
      .from("event_registrations")
      .select("*")
      .eq("id", registration_id)
      .maybeSingle();

    if (error) throw error;
    if (!reg) throw new Error("Registration not found");

    const days: string[] = [];
    if (reg.attend_day1) days.push("วันที่ 1 · จ. 20 ก.ค. 2569");
    if (reg.attend_day2) days.push("วันที่ 2 · อ. 21 ก.ค. 2569");
    const daysHtml = days.map((d) => `<li>${escapeHtml(d)}</li>`).join("");

    const dietaryLabel = DIETARY_LABEL[reg.dietary] ?? reg.dietary;
    const dietaryDetail = reg.dietary === "allergy" && reg.dietary_note
      ? ` — ${escapeHtml(reg.dietary_note)}`
      : "";

    const html = `<!DOCTYPE html>
<html lang="th">
<head><meta charset="utf-8" /><title>ยืนยันการลงทะเบียน</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Tahoma,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#0e7490,#7c3aed);padding:32px 28px;color:#ffffff;">
            <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">R1 Digital Health Forum · 2026</div>
            <h1 style="margin:8px 0 0;font-size:22px;line-height:1.35;">ยืนยันการลงทะเบียนเรียบร้อยแล้ว</h1>
            <p style="margin:6px 0 0;font-size:13px;opacity:0.9;">Scaling Health Innovation with AI, Trust & Cyber Resilience</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 16px;font-size:15px;">เรียน คุณ<strong>${escapeHtml(reg.full_name)}</strong>,</p>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;">
              ขอบคุณที่ลงทะเบียนเข้าร่วมงาน <strong>R1 Digital Health Forum 2026</strong>
              กรุณาบันทึกหมายเลขลงทะเบียนของท่านเพื่อใช้แสดงตนหน้างาน
            </p>

            <div style="background:linear-gradient(135deg,#ecfeff,#f5f3ff);border:1px solid #a5f3fc;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
              <div style="font-size:11px;letter-spacing:2px;color:#0e7490;text-transform:uppercase;">หมายเลขลงทะเบียน</div>
              <div style="font-size:32px;font-weight:700;color:#0f172a;margin-top:6px;font-family:'Courier New',monospace;letter-spacing:2px;">${escapeHtml(reg.registration_no)}</div>
            </div>

            <h2 style="margin:0 0 12px;font-size:15px;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">📅 รายละเอียดงาน</h2>
            <table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="font-size:14px;color:#334155;margin-bottom:20px;">
              <tr><td width="120" style="color:#64748b;">วันที่</td><td>จันทร์ 20 – อังคาร 21 กรกฎาคม 2569</td></tr>
              <tr><td style="color:#64748b;">เวลา</td><td>08.30 – 16.30 น.</td></tr>
              <tr><td style="color:#64748b;vertical-align:top;">สถานที่</td><td>โรงพยาบาลลำปาง<br/>ห้องประชุม อาคารผู้ป่วยนอก ชั้น 8<br/><span style="color:#64748b;font-size:13px;">280 ถ.พหลโยธิน ต.หัวเวียง อ.เมือง จ.ลำปาง 52000</span></td></tr>
            </table>

            <h2 style="margin:0 0 12px;font-size:15px;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">✅ ข้อมูลผู้ลงทะเบียน</h2>
            <table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="font-size:14px;color:#334155;margin-bottom:16px;">
              <tr><td width="120" style="color:#64748b;">ชื่อ-นามสกุล</td><td>${escapeHtml(reg.full_name)}</td></tr>
              <tr><td style="color:#64748b;">ตำแหน่ง</td><td>${escapeHtml(reg.position)}</td></tr>
              <tr><td style="color:#64748b;">หน่วยงาน</td><td>${escapeHtml(reg.organization)}</td></tr>
              <tr><td style="color:#64748b;">จังหวัด</td><td>${escapeHtml(reg.province)}</td></tr>
              <tr><td style="color:#64748b;">อีเมล</td><td>${escapeHtml(reg.email)}</td></tr>
              <tr><td style="color:#64748b;">เบอร์โทร</td><td>${escapeHtml(reg.phone)}</td></tr>
              <tr><td style="color:#64748b;vertical-align:top;">เข้าร่วม</td><td><ul style="margin:0;padding-left:18px;">${daysHtml || "<li>-</li>"}</ul></td></tr>
              <tr><td style="color:#64748b;">อาหาร</td><td>${escapeHtml(dietaryLabel)}${dietaryDetail}</td></tr>
              ${reg.notes ? `<tr><td style="color:#64748b;vertical-align:top;">หมายเหตุ</td><td>${escapeHtml(reg.notes)}</td></tr>` : ""}
            </table>

            <div style="background:#fef9c3;border-left:4px solid #eab308;padding:12px 14px;border-radius:6px;font-size:13px;color:#713f12;margin-top:20px;">
              หากต้องการแก้ไขหรือยกเลิกการลงทะเบียน กรุณาติดต่อผู้จัดที่
              <a href="mailto:ciso.r1@moph.go.th" style="color:#713f12;">ciso.r1@moph.go.th</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:18px 28px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;">
            จัดโดย ศูนย์เฝ้าระวังความมั่นคงปลอดภัยไซเบอร์ เขตสุขภาพที่ 1 (CISO R1)<br/>
            ศูนย์เทคโนโลยีสารสนเทศและการสื่อสาร สำนักงานปลัดกระทรวงสาธารณสุข
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const result = await resend.emails.send({
      from: "R1 Digital Health Forum <onboarding@resend.dev>",
      to: [reg.email],
      subject: `[${reg.registration_no}] ยืนยันการลงทะเบียน R1 Digital Health Forum 2026`,
      html,
    });

    if ((result as any).error) {
      console.error("Resend error:", (result as any).error);
      throw new Error(JSON.stringify((result as any).error));
    }

    await admin
      .from("event_registrations")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", registration_id);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-event-registration-email error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
