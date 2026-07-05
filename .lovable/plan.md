
# แผนพัฒนา R1 Digital Health Forum 2026

## แนวทาง
รวมในเว็บ CTAM+ เดิม แต่ทำ branding แยกให้รู้สึกเป็น event site จริง ใช้ backend Supabase เดิม เพิ่มเมนู "R1 Digital Health Forum" ใน `PublicLayout` ข้าง "แผนยุทธศาสตร์ประจำปี"

## โครงสร้าง Routes (ทุก route เป็น public)

```text
/public/event/r1next2026              → หน้าโปรโมท (Landing)
/public/event/r1next2026/agenda       → กำหนดการ 2 วัน (แยกหน้า/หรือ section)
/public/event/r1next2026/speakers     → โปรไฟล์วิทยากร
/public/event/r1next2026/venue        → สถานที่/แผนที่/ที่พัก
/public/event/r1next2026/register     → ฟอร์มลงทะเบียน
/public/event/r1next2026/success/:id  → หน้ายืนยัน + QR code
/public/event/r1next2026/checkin      → หน้า scan QR (admin)

/admin/event/r1next2026               → Dashboard จัดการผู้ลงทะเบียน (regional_admin/central_admin)
```

## หน้า Landing ประกอบด้วย
- **Hero**: โลโก้ event, tagline "Scaling Health Innovation with AI, Trust, and Cyber Resilience", วันที่ 20-21 ก.ค. 2569, ปุ่มลงทะเบียน + countdown
- **About**: บริบทงาน, กลุ่มเป้าหมาย (120 รพ. / 400 คน)
- **Highlights**: 3 การ์ด — Medical AI, Cybersecurity/PDPA, Showcase นวัตกรรม
- **Agenda Preview**: Tab วัน 1 / วัน 2 พร้อม timeline ห้องประชุมใหญ่+ห้องย่อย
- **Speakers**: การ์ดวิทยากรหลัก (ผศ.นพ.สุรัตน์, เรือโทธีรพล, ร.ต.อ.อมรพันธุ์, พญ.วชิราภรณ์ ฯลฯ)
- **Venue**: รพ.ลำปาง อาคารผู้ป่วยนอก ชั้น 8 + Google Maps embed + ที่พักแนะนำ
- **CTA Register**: ปุ่มใหญ่ พร้อมตัวเลขเหลือที่นั่ง
- **Footer**: ผู้จัด (เขตสุขภาพที่ 1), ติดต่อ

## ระบบลงทะเบียน (Features ที่เลือก)

**ฟอร์ม** (validate ด้วย zod):
- ชื่อ-สกุล (คำนำหน้า/ตำแหน่ง)
- หน่วยงาน: dropdown 120 รพ.เขต 1 (ใช้ SearchableSelect ที่มีอยู่) + "อื่นๆ" (พิมพ์เอง)
- จังหวัด (auto-fill จาก รพ.)
- เบอร์โทร, อีเมล
- วันที่เข้าร่วม: วัน 1 / วัน 2 / ทั้ง 2 วัน
- Workshop bracket ช่วง 15.30-16.30 วัน 1 (จำกัดที่นั่ง 2 ห้อง)
- Showcase session bracket วัน 1/วัน 2 (ห้องใหญ่/ห้องย่อย)
- ข้อจำกัดอาหาร (ปกติ/ฮาลาล/มังสวิรัติ/แพ้อาหาร)
- ยินยอม PDPA

**Backend logic**:
- ตรวจ email/phone ซ้ำก่อนบันทึก
- Waitlist อัตโนมัติเมื่อครบ 400 คน (หรือครบ quota ห้องย่อย)
- สร้าง `registration_number` (RN-2026-00001)
- สร้าง QR payload = registration_number + hash

**อีเมลยืนยัน** (Resend, มี `RESEND_API_KEY` แล้ว):
- Edge function `send-event-confirmation`
- แนบ QR code, กำหนดการ, แผนที่, ปุ่มยกเลิก

**Check-in**:
- หน้า scan QR (`html5-qrcode`) — ต้อง login admin
- Toggle "เช็คอินวัน 1 / วัน 2"

**Admin Dashboard**:
- ตารางผู้ลงทะเบียน + filter (จังหวัด, วันเข้าร่วม, สถานะ, waitlist, check-in)
- ค้นหาชื่อ/หน่วยงาน
- Export Excel (ทั้งหมด/ตามจังหวัด)
- สถิติ: ยอดรวม, per จังหวัด, per รพ., per session
- ปุ่มยืนยัน/ยกเลิก/เลื่อนจาก waitlist
- Bulk email แจ้งเตือน

## รายละเอียดทางเทคนิค (สำหรับผู้พัฒนา)

**Database migration** (public schema + GRANT + RLS):

```sql
-- event_registrations
CREATE TABLE public.event_registrations (
  id uuid PK default gen_random_uuid(),
  event_code text NOT NULL default 'r1next2026',
  registration_number text UNIQUE NOT NULL,
  prefix text, full_name text NOT NULL, position text,
  organization_type text, -- 'hospital'|'health_office'|'other'
  hospital_id uuid REFERENCES hospitals,
  health_office_id uuid REFERENCES health_offices,
  organization_other text,
  province_id uuid REFERENCES provinces,
  phone text NOT NULL, email text NOT NULL,
  attend_day1 boolean, attend_day2 boolean,
  workshop_choice text, -- 'main'|'sub'
  showcase_day1 text, showcase_day2 text,
  dietary text, dietary_note text,
  pdpa_consent boolean NOT NULL default false,
  qr_token text UNIQUE NOT NULL,
  status text NOT NULL default 'confirmed', -- confirmed|waitlist|cancelled
  checkin_day1_at timestamptz, checkin_day2_at timestamptz,
  metadata jsonb, created_at, updated_at
);
CREATE INDEX ON event_registrations(event_code, status);
CREATE UNIQUE INDEX ON event_registrations(event_code, lower(email));

-- speakers/agenda เก็บใน seed data (จะใส่ในไฟล์ TS) เพื่อความเร็ว
```

**RLS**:
- INSERT: `anon` + `authenticated` (สร้าง registration ได้)
- SELECT: `authenticated` + role in (central_admin, regional) + service_role
- UPDATE (check-in/สถานะ): admin เท่านั้น
- SELECT ของตัวเอง: ใช้ `qr_token` ผ่าน RPC `get_my_registration(token)`

**Edge functions**:
- `create-event-registration` (public, rate limit, validate zod, ส่งเมล)
- `send-event-confirmation` (ผูก Resend)
- `checkin-event-registration` (auth admin)

**ไฟล์ frontend ที่จะสร้าง**:
- `src/pages/event/EventLanding.tsx`
- `src/pages/event/EventAgenda.tsx`
- `src/pages/event/EventSpeakers.tsx`
- `src/pages/event/EventVenue.tsx`
- `src/pages/event/EventRegister.tsx`
- `src/pages/event/EventRegisterSuccess.tsx`
- `src/pages/event/EventCheckin.tsx`
- `src/pages/event/EventAdminDashboard.tsx`
- `src/components/event/EventLayout.tsx` (แยก layout เฉพาะ event มี branding เอง)
- `src/components/event/AgendaTimeline.tsx`
- `src/components/event/SpeakerCard.tsx`
- `src/data/eventContent.ts` (agenda, speakers, seed)
- เพิ่มเมนู "R1 Digital Health Forum" ใน `PublicLayout.tsx`
- เพิ่ม routes ใน `App.tsx`

**Design tokens**:
- ใช้ semantic tokens ที่มีอยู่ + เพิ่ม accent event สี (เขียว/ทีล ต่างจาก CTAM+ primary น้ำเงิน) ใน `index.css`
- Countdown ใช้ hook เอง (ไม่ต้องพึ่ง lib)

**Libs ใหม่**: `qrcode` (สร้าง QR), `html5-qrcode` (scan), `date-fns` (มีแล้ว), `xlsx` (มีแล้วในโปรเจกต์)

## ลำดับการพัฒนา (Phases)

1. **Phase 1 — Promo Site (Read-only)**: Landing + Agenda + Speakers + Venue, ใช้ seed จาก TS file → ปล่อยได้ทันที
2. **Phase 2 — Registration**: DB migration + ฟอร์ม + edge function + อีเมลยืนยัน
3. **Phase 3 — Admin & Check-in**: Dashboard + Export + QR check-in
4. **Phase 4 — Polish**: Waitlist auto-promote, sms reminder (option), หน้าสรุปหลังงาน

รอคุณ approve เพื่อเริ่ม Phase 1 ก่อน (หรือระบุ scope ที่ต้องการเริ่ม)
