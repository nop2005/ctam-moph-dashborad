
# แผนเปิดระบบลงทะเบียน R1 Digital Health Forum 2026

## ภาพรวม
เปลี่ยนปุ่ม "ลงทะเบียน (เร็วๆ นี้)" ให้ใช้งานได้จริง — เก็บข้อมูลผู้ลงทะเบียนในฐานข้อมูล, ส่งอีเมลยืนยันอัตโนมัติ, และมีหน้า admin สำหรับดู/ส่งออกรายชื่อ

---

## 1. ฐานข้อมูล (Lovable Cloud)

สร้างตาราง `event_registrations`:

| คอลัมน์ | ประเภท | หมายเหตุ |
|---|---|---|
| `id` | uuid PK | |
| `registration_no` | text unique | รูปแบบ `R1F26-00001` (auto-increment) |
| `full_name` | text | คำนำหน้า + ชื่อ + นามสกุล |
| `position` | text | ตำแหน่ง |
| `organization` | text | หน่วยงาน/โรงพยาบาล |
| `province` | text | จังหวัด |
| `email` | text | (validated, unique per event) |
| `phone` | text | |
| `attend_day1` / `attend_day2` | boolean | เลือกวันที่จะเข้าร่วม |
| `dietary` | text | ปกติ / มังสวิรัติ / ฮาลาล / แพ้อาหาร (+ ระบุ) |
| `notes` | text nullable | หมายเหตุเพิ่มเติม |
| `email_sent_at` | timestamptz nullable | |
| `created_at` | timestamptz default now() | |

**RLS policies:**
- `INSERT` — เปิดให้ `anon` และ `authenticated` (ใครก็ลงทะเบียนได้)
- `SELECT / UPDATE / DELETE` — เฉพาะ `central_admin` และ `regional` (เขต 1)
- GRANT ตามมาตรฐาน `anon INSERT`, `authenticated ALL`, `service_role ALL`

## 2. หน้า Public Registration

**Route ใหม่:** `/public/event/r1next2026/register`

- ฟอร์ม React Hook Form + Zod validation
  - จำกัดความยาว, ตรวจ email format, บังคับเลือกอย่างน้อย 1 วัน
- Checkbox Day 1 / Day 2 / ทั้งสองวัน
- Field เมนูอาหาร (dropdown + textarea แพ้อาหาร)
- ปุ่ม Submit → เขียนลง DB → เรียก edge function ส่งอีเมล → แสดงหน้า Success พร้อมหมายเลขลงทะเบียน

## 3. Edge Function ส่งอีเมลยืนยัน

**Function ใหม่:** `send-registration-confirmation`

- ใช้ `RESEND_API_KEY` ที่มีอยู่แล้ว
- Template อีเมล (HTML) ประกอบด้วย:
  - หัวจดหมาย + logo งาน
  - หมายเลขลงทะเบียน (ตัวใหญ่ชัดเจน)
  - สรุปวัน/สถานที่/เวลา
  - รายละเอียดที่ผู้ใช้กรอก (เพื่อ verify)
  - ข้อความติดต่อผู้จัดหากต้องการแก้ไข
- อัปเดต `email_sent_at` หลังส่งสำเร็จ

## 4. อัปเดตหน้า Event เดิม

`src/pages/EventR1Next2026.tsx`:
- ปุ่ม "ลงทะเบียน" ใน Hero + Sticky bar → เปลี่ยนจาก `disabled` เป็น `Link` ไปหน้าฟอร์ม
- เพิ่ม badge "เปิดรับสมัครแล้ว" สีเขียว
- (คงไว้) Countdown ยังทำงานตามเดิม

## 5. หน้า Admin ดูรายชื่อ

**Route ใหม่ (protected):** `/event/r1next2026/registrations`
- เห็นได้เฉพาะ `central_admin` และ `regional` (health_region เขต 1)
- ตารางแสดง: no., ชื่อ, หน่วยงาน, จังหวัด, วันที่เข้าร่วม, email, สถานะส่งอีเมล
- Filter: วัน (Day 1/2/ทั้งคู่), จังหวัด, ค้นหาชื่อ
- Search box + สรุปยอดรวมด้านบน (จำนวนทั้งหมด / Day 1 / Day 2)
- ปุ่ม **Export Excel** (ใช้ xlsx ที่มีอยู่แล้ว)
- ปุ่มลิงก์เข้าเมนู "ผู้ลงทะเบียนงาน R1" ใน sidebar (เฉพาะ role ที่มีสิทธิ์)

---

## รายละเอียดเชิงเทคนิค

### ไฟล์ใหม่
- `supabase/migrations/*_event_registrations.sql`
- `supabase/functions/send-registration-confirmation/index.ts`
- `src/pages/EventR1Next2026Register.tsx` (ฟอร์มสาธารณะ)
- `src/pages/EventR1Next2026Admin.tsx` (แอดมิน)
- `src/lib/eventRegistrationSchema.ts` (Zod)

### ไฟล์ที่แก้
- `src/App.tsx` — เพิ่ม 2 routes ใหม่
- `src/pages/EventR1Next2026.tsx` — เปิดปุ่มลงทะเบียน
- `src/components/layout/AppSidebar.tsx` — เมนู admin

### สิ่งที่ **ไม่ทำ** ใน phase นี้
- ไม่มีระบบ QR check-in หน้างาน (ทำได้ภายหลัง)
- ไม่จำกัดจำนวนผู้ลงทะเบียน (เพิ่มได้ทีหลังถ้าต้องการ)
- ไม่มีระบบยกเลิก/แก้ไขโดยผู้ใช้เอง — ให้ติดต่อผู้จัดผ่านอีเมล
- ไม่ต้องล็อกอินเพื่อลงทะเบียน (public form)

---

## ขั้นตอนใช้งานหลัง deploy
1. ผู้เข้าร่วมเปิดหน้างาน → กด "ลงทะเบียน" → กรอกฟอร์ม → รับอีเมลยืนยันพร้อมเลขที่
2. Admin เข้า `/event/r1next2026/registrations` → ดู/กรอง/export รายชื่อ
3. วันงาน: พิมพ์รายชื่อจาก Excel ไปเช็คหน้างาน

พร้อมเริ่มไหมครับ?
