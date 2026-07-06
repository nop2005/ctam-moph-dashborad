import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InlineAutocomplete } from "@/components/event/InlineAutocomplete";
import { StrictCombobox } from "@/components/event/StrictCombobox";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_INFO } from "@/data/eventContent";
import {
  eventRegistrationSchema,
  type EventRegistrationInput,
  DIETARY_OPTIONS,
} from "@/lib/eventRegistrationSchema";
import { ArrowLeft, CheckCircle2, Calendar, MapPin, Mail, Loader2, Sparkles, Copy } from "lucide-react";

interface PersonnelSuggestion {
  personnel_id: string;
  full_name: string;
  position_name: string;
  organization: string;
  province: string;
}

interface OrgSuggestion {
  org_id: string;
  org_type: string;
  organization: string;
  province: string;
}

interface SuccessInfo {
  registration_no: string;
  email: string;
}

export default function EventR1Next2026Register() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [positionOther, setPositionOther] = useState(false);
  const [orgOther, setOrgOther] = useState(false);

  const form = useForm<EventRegistrationInput>({
    resolver: zodResolver(eventRegistrationSchema),
    defaultValues: {
      full_name: "",
      position: "",
      organization: "",
      province: "",
      email: "",
      phone: "",
      attend_day1: true,
      attend_day2: true,
      dietary: "normal",
      dietary_note: "",
      notes: "",
    },
  });

  const dietary = form.watch("dietary");
  const fullName = form.watch("full_name");
  const position = form.watch("position");
  const organization = form.watch("organization");

  const fetchPersonnel = useCallback(async (q: string): Promise<PersonnelSuggestion[]> => {
    const { data, error } = await supabase.rpc("search_event_personnel_r1", {
      p_query: q || null,
      p_limit: 20,
    });
    if (error) throw error;
    return (data as PersonnelSuggestion[]) || [];
  }, []);

  const fetchPositions = useCallback(async (q: string) => {
    const { data, error } = await supabase.rpc("search_r1_positions", {
      p_query: q || null,
      p_limit: 30,
    });
    if (error) throw error;
    const list = (data as { position_name: string }[]) || [];
    return [...list, { position_name: "อื่นๆ (ระบุเอง)" }];
  }, []);

  const fetchOrgs = useCallback(async (q: string): Promise<OrgSuggestion[]> => {
    const { data, error } = await supabase.rpc("search_r1_organizations", {
      p_query: q || null,
      p_limit: 50,
    });
    if (error) throw error;
    return (data as OrgSuggestion[]) || [];
  }, []);

  const fetchProvinces = useCallback(async (q: string): Promise<{ province: string }[]> => {
    const { data, error } = await supabase.rpc("search_r1_organizations", {
      p_query: null,
      p_limit: 200,
    });
    if (error) throw error;
    const uniq = Array.from(
      new Set(((data as OrgSuggestion[]) || []).map((o) => o.province).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, "th"));
    const filtered = q ? uniq.filter((p) => p.includes(q)) : uniq;
    return filtered.map((province) => ({ province }));
  }, []);

  async function onSubmit(values: EventRegistrationInput) {
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("event_registrations")
        .insert({
          event_code: EVENT_INFO.code,
          full_name: values.full_name,
          position: values.position,
          organization: values.organization,
          province: values.province,
          email: values.email,
          phone: values.phone,
          attend_day1: values.attend_day1,
          attend_day2: values.attend_day2,
          dietary: values.dietary,
          dietary_note: values.dietary === "allergy" ? values.dietary_note || null : null,
          notes: values.notes || null,
        })
        .select("id, registration_no, email")
        .single();

      if (error) throw error;

      supabase.functions
        .invoke("send-event-registration-email", { body: { registration_id: data.id } })
        .catch((e) => console.warn("Email send failed:", e));

      setSuccess({ registration_no: data.registration_no, email: data.email });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      toast({
        title: "ลงทะเบียนไม่สำเร็จ",
        description: err instanceof Error ? err.message : "โปรดลองอีกครั้งภายหลัง",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <PublicLayout>
        <div className="max-w-2xl mx-auto py-12 px-4">
          <Card className="border-primary/30 shadow-xl">
            <CardHeader className="text-center pt-10">
              <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center mb-3 shadow-lg">
                <CheckCircle2 className="h-9 w-9 text-white" />
              </div>
              <CardTitle className="text-2xl">ลงทะเบียนสำเร็จ!</CardTitle>
              <CardDescription>
                ระบบได้บันทึกข้อมูลของท่านและส่งอีเมลยืนยันไปที่ <strong>{success.email}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pb-8">
              <div className="rounded-2xl bg-gradient-to-br from-cyan-50 to-violet-50 border border-cyan-200 p-6 text-center">
                <div className="text-xs uppercase tracking-widest text-cyan-700 mb-2">
                  หมายเลขลงทะเบียนของท่าน
                </div>
                <div className="flex items-center justify-center gap-3">
                  <div className="text-3xl md:text-4xl font-bold font-mono tracking-widest text-slate-900">
                    {success.registration_no}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(success.registration_no);
                      toast({ title: "คัดลอกแล้ว" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  โปรดบันทึกหมายเลขนี้เพื่อแสดงตนหน้างาน
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-primary mt-0.5" />
                  <span>{EVENT_INFO.dateText}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-primary mt-0.5" />
                  <span>{EVENT_INFO.venue}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 text-primary mt-0.5" />
                  <span>
                    หากไม่ได้รับอีเมลใน 5 นาที กรุณาตรวจสอบกล่อง Spam หรือติดต่อ{" "}
                    <a
                      href={`mailto:${EVENT_INFO.contactEmail}`}
                      className="underline text-primary"
                    >
                      {EVENT_INFO.contactEmail}
                    </a>
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" asChild>
                  <Link to="/public/event/r1next2026">
                    <ArrowLeft className="h-4 w-4 mr-1" /> กลับไปหน้างาน
                  </Link>
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-violet-500 text-white border-0"
                  onClick={() => {
                    setSuccess(null);
                    form.reset();
                  }}
                >
                  ลงทะเบียนคนถัดไป
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/public/event/r1next2026")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> กลับหน้างาน
          </Button>
          <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0">
            <Sparkles className="h-3 w-3 mr-1" /> เปิดรับสมัครแล้ว
          </Badge>
        </div>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl">ลงทะเบียนเข้าร่วมงาน</CardTitle>
            <CardDescription className="text-base">
              R1 Digital Health Forum 2026 · {EVENT_INFO.dateText}
              <br />
              <span className="text-xs">{EVENT_INFO.venue}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <Alert className="bg-primary/5 border-primary/20">
                <AlertDescription className="text-xs">
                  💡 พิมพ์ชื่อ / ตำแหน่ง / หน่วยงาน แล้วระบบจะแสดงรายชื่อในเขตสุขภาพที่ 1 ให้เลือกอัตโนมัติ
                  หากไม่พบชื่อในระบบ (บุคคลภายนอก) พิมพ์ข้อมูลได้ตามปกติแล้วกด "บันทึกการลงทะเบียน" ด้านล่าง
                </AlertDescription>
              </Alert>

              {/* Personal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="full_name">
                    ชื่อ-นามสกุล (พร้อมคำนำหน้า) <span className="text-destructive">*</span>
                  </Label>
                  <InlineAutocomplete<PersonnelSuggestion>
                    id="full_name"
                    value={fullName}
                    onChange={(v) => form.setValue("full_name", v, { shouldValidate: true })}
                    fetcher={fetchPersonnel}
                    onSelect={(p) => {
                      form.setValue("full_name", p.full_name, { shouldValidate: true });
                      if (p.position_name) form.setValue("position", p.position_name, { shouldValidate: true });
                      if (p.organization) form.setValue("organization", p.organization, { shouldValidate: true });
                      if (p.province) form.setValue("province", p.province, { shouldValidate: true });
                    }}
                    placeholder="พิมพ์ชื่อ เช่น นพ.สมชาย ใจดี"
                    itemKey={(p) => p.personnel_id}
                    emptyText='ไม่พบชื่อในระบบ — พิมพ์ต่อได้ แล้วกด "บันทึกการลงทะเบียน" ด้านล่าง'
                    renderItem={(p) => (
                      <>
                        <div className="font-medium text-sm">{p.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[p.position_name, p.organization, p.province].filter(Boolean).join(" · ")}
                        </div>
                      </>
                    )}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    เลือกจากรายชื่อจะกรอกตำแหน่ง / หน่วยงาน / จังหวัดให้อัตโนมัติ
                  </p>
                  {form.formState.errors.full_name && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.full_name.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="position">
                    ตำแหน่ง <span className="text-destructive">*</span>
                  </Label>
                  <StrictCombobox<{ position_name: string }>
                    id="position"
                    value={positionOther ? "อื่นๆ (ระบุเอง)" : position}
                    onSelect={(p) => {
                      if (p.position_name === "อื่นๆ (ระบุเอง)") {
                        setPositionOther(true);
                        form.setValue("position", "", { shouldValidate: true });
                      } else {
                        setPositionOther(false);
                        form.setValue("position", p.position_name, { shouldValidate: true });
                      }
                    }}
                    fetcher={fetchPositions}
                    placeholder="เลือกตำแหน่ง"
                    searchPlaceholder="พิมพ์เพื่อค้นหาตำแหน่ง..."
                    emptyText='ไม่พบตำแหน่ง — เลือก "อื่นๆ (ระบุเอง)" เพื่อกรอกเอง'
                    itemKey={(p) => p.position_name}
                    itemLabel={(p) => p.position_name}
                  />
                  {positionOther && (
                    <Input
                      className="mt-2"
                      placeholder="ระบุตำแหน่งของท่าน"
                      value={position}
                      onChange={(e) =>
                        form.setValue("position", e.target.value, { shouldValidate: true })
                      }
                    />
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    เลือกจากรายการ หรือเลือก "อื่นๆ (ระบุเอง)" เพื่อพิมพ์เอง
                  </p>
                  {form.formState.errors.position && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.position.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="organization">
                    หน่วยงาน / โรงพยาบาล <span className="text-destructive">*</span>
                  </Label>
                  <StrictCombobox<OrgSuggestion>
                    id="organization"
                    value={organization}
                    onSelect={(o) => {
                      form.setValue("organization", o.organization, { shouldValidate: true });
                      if (o.province)
                        form.setValue("province", o.province, { shouldValidate: true });
                    }}
                    fetcher={fetchOrgs}
                    placeholder="เลือกหน่วยงาน / โรงพยาบาล"
                    searchPlaceholder="พิมพ์เพื่อค้นหาหน่วยงาน..."
                    emptyText="ไม่พบหน่วยงานที่ตรงกับคำค้น"
                    itemKey={(o) => `${o.org_type}-${o.org_id}`}
                    itemLabel={(o) => o.organization}
                    renderItem={(o) => (
                      <>
                        <div className="text-sm font-medium">{o.organization}</div>
                        <div className="text-xs text-muted-foreground">
                          {o.org_type === "hospital" ? "โรงพยาบาล" : "สนง.สาธารณสุข"}
                          {o.province ? ` · จ.${o.province}` : ""}
                        </div>
                      </>
                    )}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    เลือกจากรายการเท่านั้น — จังหวัดจะถูกกรอกให้อัตโนมัติ
                  </p>
                  {form.formState.errors.organization && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.organization.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="province">
                    จังหวัด <span className="text-destructive">*</span>
                  </Label>
                  <StrictCombobox<{ province: string }>
                    id="province"
                    value={form.watch("province")}
                    onSelect={(p) =>
                      form.setValue("province", p.province, { shouldValidate: true })
                    }
                    fetcher={fetchProvinces}
                    placeholder="เลือกจังหวัด"
                    searchPlaceholder="พิมพ์เพื่อค้นหาจังหวัด..."
                    emptyText="ไม่พบจังหวัด"
                    itemKey={(p) => p.province}
                    itemLabel={(p) => p.province}
                  />
                  {form.formState.errors.province && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.province.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="email">
                    อีเมล <span className="text-destructive">*</span>
                  </Label>
                  <Input id="email" type="email" placeholder="you@example.com" {...form.register("email")} />
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="phone">
                    เบอร์โทรศัพท์ <span className="text-destructive">*</span>
                  </Label>
                  <Input id="phone" placeholder="0812345678" {...form.register("phone")} />
                  {form.formState.errors.phone && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.phone.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Attendance */}
              <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                <Label className="text-base">
                  วันที่ท่านเข้าร่วม <span className="text-destructive">*</span>
                </Label>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={form.watch("attend_day1")}
                      onCheckedChange={(v) => form.setValue("attend_day1", !!v, { shouldValidate: true })}
                    />
                    <div className="text-sm">
                      <div className="font-medium">Day 1 · จันทร์ 20 ก.ค. 2569</div>
                      <div className="text-xs text-muted-foreground">PDPA & Cybersecurity</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={form.watch("attend_day2")}
                      onCheckedChange={(v) => form.setValue("attend_day2", !!v, { shouldValidate: true })}
                    />
                    <div className="text-sm">
                      <div className="font-medium">Day 2 · อังคาร 21 ก.ค. 2569</div>
                      <div className="text-xs text-muted-foreground">AI & Proactive Care</div>
                    </div>
                  </label>
                </div>
                {form.formState.errors.attend_day1 && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.attend_day1.message}
                  </p>
                )}
              </div>

              {/* Dietary */}
              <div className="space-y-3">
                <Label className="text-base">อาหาร</Label>
                <RadioGroup
                  value={dietary}
                  onValueChange={(v) => form.setValue("dietary", v as EventRegistrationInput["dietary"])}
                  className="grid grid-cols-2 md:grid-cols-3 gap-2"
                >
                  {DIETARY_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent"
                    >
                      <RadioGroupItem value={opt.value} />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </RadioGroup>
                {dietary === "allergy" && (
                  <div>
                    <Label htmlFor="dietary_note">ระบุอาหารที่แพ้ / รายละเอียด</Label>
                    <Input
                      id="dietary_note"
                      placeholder="เช่น แพ้กุ้ง, อาหารทะเล"
                      {...form.register("dietary_note")}
                    />
                    {form.formState.errors.dietary_note && (
                      <p className="text-xs text-destructive mt-1">
                        {form.formState.errors.dietary_note.message}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes">หมายเหตุเพิ่มเติม (ถ้ามี)</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder="ข้อมูลเพิ่มเติมที่ต้องการแจ้งผู้จัด"
                  {...form.register("notes")}
                />
              </div>

              <Alert>
                <AlertDescription className="text-xs">
                  โดยการกดลงทะเบียน ท่านยินยอมให้ผู้จัดงานใช้ข้อมูลของท่านเพื่อการบริหารจัดการงานตาม
                  พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 และจะไม่นำไปเผยแพร่โดยไม่ได้รับอนุญาต
                </AlertDescription>
              </Alert>

              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-cyan-500 to-violet-500 text-white border-0 shadow-lg h-12 text-base font-semibold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> กำลังส่งข้อมูล...
                  </>
                ) : (
                  <>บันทึกการลงทะเบียน</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
