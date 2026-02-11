

# แผนการสร้าง Role "CEO" ใหม่

## สรุปสิ่งที่ต้องทำ

สร้าง role ใหม่ชื่อ "ceo" สำหรับผู้อำนวยการโรงพยาบาล โดยสามารถดูรายงานทุกประเภทได้ แต่ไม่เห็น 3 เมนู:
- หน้าหลักแบบประเมิน (Dashboard)
- บุคลากร (Personnel Admin)
- จัดการระบบ > จัดการผู้ใช้งาน (User Management)

ทดลองสร้างที่จังหวัดเชียงใหม่ก่อน รูปแบบ: `ceo@รหัสรพ` เช่น `ceo@11130`, รหัสผ่าน = รหัสรพ

---

## ขั้นตอนการดำเนินการ

### 1. เพิ่ม "ceo" ใน user_role enum (Database Migration)

เพิ่มค่า `'ceo'` เข้าไปใน enum `user_role` ที่มีอยู่แล้วในฐานข้อมูล

### 2. อัปเดต AuthContext

เพิ่ม `'ceo'` เข้าไปใน type `UserRole` ใน `src/contexts/AuthContext.tsx`

### 3. อัปเดต ProtectedRoute

เพิ่ม `'ceo'` เข้าไปใน `allowedRoles` type ใน `src/components/auth/ProtectedRoute.tsx`

### 4. อัปเดต Sidebar (AppSidebar.tsx)

ปรับเมนูให้ role `ceo` สามารถเห็น:
- แดชบอร์ดทั่วไป (reports submenu)
- รายงานเชิงวิเคราะห์
- รายงานตรวจราชการ
- คู่มือเอกสารสำหรับการนิเทศ
- รายงานงบประมาณประจำปี
- รายงานบุคลากร

**ไม่เห็น:**
- หน้าหลักแบบประเมิน
- บุคลากรในหน่วยงาน / บุคลากร (personnel-admin)
- จัดการระบบ (admin section ทั้งหมด)

### 5. อัปเดต Route permissions (App.tsx)

เพิ่ม `'ceo'` เข้าไปใน `allowedRoles` สำหรับ route ที่ CEO ต้องเข้าถึงได้ เช่น:
- `/reports`, `/reports/quantitative`, `/reports/impact` ฯลฯ (เปิดอยู่แล้วเพราะไม่มี allowedRoles)
- `/reports/personnel` - เพิ่ม 'ceo'

### 6. กำหนดหน้า Default สำหรับ CEO

เมื่อ CEO login จะ redirect ไปที่หน้า `/reports` แทน `/dashboard` เพราะไม่มีสิทธิ์เข้า dashboard

### 7. สร้าง Edge Function สำหรับสร้าง CEO Users

สร้าง edge function `create-ceo-users` ที่:
- รับ `province_id` เป็น parameter
- ดึงรายชื่อ รพ. ทั้งหมดในจังหวัด
- สร้าง user ด้วย email = `ceo@{hospital_code}` เช่น `ceo@11130`
- password = hospital_code
- ตั้ง role = 'ceo', hospital_id, province_id
- full_name = "ผู้อำนวยการโรงพยาบาล {ชื่อ รพ.}"
- is_active = false (รอ approve)

### 8. เพิ่มปุ่มสร้าง CEO Users ในหน้า SuperAdmin

เพิ่มปุ่ม "สร้าง user CEO ทั้งจังหวัด" ในหน้า SuperAdmin ให้ central_admin ใช้งานได้

### 9. อัปเดต RLS Policies

เพิ่ม 'ceo' ใน RLS policies ที่จำเป็นให้ CEO สามารถ SELECT ข้อมูลรายงานได้:
- assessments (SELECT - เห็นข้อมูล รพ. ตัวเอง)
- assessment_items, qualitative_scores, impact_scores (SELECT)
- hospitals, provinces, health_regions (มี public SELECT อยู่แล้ว)

### 10. อัปเดต Dashboard stats function

เพิ่ม 'ceo' เข้าไปใน `get_dashboard_stats` function ให้กรองข้อมูลตาม hospital_id ของ CEO

---

## รายละเอียดทางเทคนิค

### Database Migration SQL

```sql
ALTER TYPE public.user_role ADD VALUE 'ceo';
```

### RLS Policies ที่ต้องเพิ่ม

CEO ต้องการ SELECT access สำหรับ:
- `assessments` - ดูแบบประเมินของ รพ. ตัวเอง (เพื่อดูรายงาน)
- `assessment_items` - ดูรายละเอียดแบบประเมิน
- `qualitative_scores`, `impact_scores` - ดูคะแนน
- ตารางอื่นๆ ที่เกี่ยวกับรายงานที่มี public/authenticated SELECT อยู่แล้ว

### ไฟล์ที่ต้องแก้ไข

1. `src/contexts/AuthContext.tsx` - เพิ่ม 'ceo' ใน UserRole type
2. `src/components/auth/ProtectedRoute.tsx` - เพิ่ม 'ceo' ใน allowedRoles type
3. `src/components/layout/AppSidebar.tsx` - ปรับเมนูสำหรับ role ceo
4. `src/App.tsx` - เพิ่ม 'ceo' ใน allowedRoles ของ routes ที่เกี่ยวข้อง
5. `src/pages/Login.tsx` - ปรับ redirect logic สำหรับ ceo
6. `supabase/functions/create-ceo-users/index.ts` - Edge function ใหม่
7. `src/pages/SuperAdmin.tsx` - เพิ่มปุ่มสร้าง CEO users

