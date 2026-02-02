

# แผนการพัฒนาเมนู "รายงานงบประมาณประจำปี"

## สรุปภาพรวม
เพิ่มเมนูหลักใหม่ "รายงานงบประมาณประจำปี" ให้ผู้ใช้แต่ละระดับสามารถดูรายงานภาพรวมงบประมาณตามสิทธิ์ที่ควรได้ โดยจะแสดงข้อมูลงบประมาณจากตาราง `budget_records` ที่มีอยู่แล้ว

---

## สิทธิ์การเข้าถึงข้อมูลตามบทบาท

| บทบาท (Role) | ขอบเขตการเห็นข้อมูล |
|--------------|-------------------|
| hospital_it | เฉพาะโรงพยาบาลของตัวเอง |
| health_office | เฉพาะหน่วยงานของตัวเอง |
| provincial | โรงพยาบาลและหน่วยงานทั้งหมดในจังหวัด |
| regional | โรงพยาบาลและหน่วยงานทั้งหมดในเขตสุขภาพ |
| central_admin | ข้อมูลทุกหน่วยงานทั่วประเทศ |
| supervisor | ข้อมูลหน่วยงานในเขตสุขภาพที่รับผิดชอบ |

---

## ฟีเจอร์หลัก

1. **เลือกปีงบประมาณ** - Dropdown เลือกปีงบประมาณ (พ.ศ.)
2. **ตารางสรุปภาพรวม** - แสดงข้อมูลงบประมาณแยกตาม 17 หมวดหมู่ CTAM
3. **การรวมข้อมูล**:
   - hospital_it/health_office: แสดงเฉพาะข้อมูลหน่วยงานของตัวเอง
   - provincial: รวมยอดของทุกหน่วยงานในจังหวัด พร้อมตาราง drill-down
   - regional: รวมยอดของทุกหน่วยงานในเขตสุขภาพ พร้อมตาราง drill-down
   - central_admin: รวมยอดทั้งประเทศ พร้อม drill-down เป็นเขต/จังหวัด/หน่วยงาน
4. **Export** - สามารถดาวน์โหลดรายงานได้ (อนาคต)

---

## สิ่งที่ต้องทำ

### 1. เพิ่มเมนูใน Sidebar
- เพิ่มเมนู "รายงานงบประมาณประจำปี" หลังจากเมนู "คู่มือเอกสารสำหรับการนิเทศ"
- ใช้ icon `FileText` หรือ `DollarSign` จาก lucide-react
- แสดงสำหรับทุก roles ที่ authenticated

### 2. เพิ่ม RLS Policy สำหรับการอ่านข้อมูลตามสิทธิ์
ต้องเพิ่ม RLS policies เพื่อให้ผู้ใช้ระดับสูงสามารถดูข้อมูลของหน่วยงานในขอบเขตได้:
- provincial: ดูข้อมูลหน่วยงานในจังหวัด
- regional: ดูข้อมูลหน่วยงานในเขตสุขภาพ
- central_admin: ดูข้อมูลทุกหน่วยงาน
- supervisor: ดูข้อมูลหน่วยงานในเขตสุขภาพ

### 3. สร้างหน้า BudgetReport.tsx
**องค์ประกอบ UI:**
- Header แสดงชื่อหน้าและปีงบประมาณที่เลือก
- Dropdown เลือกปีงบประมาณ
- การ์ดสรุปยอดรวม
- ตารางแสดงข้อมูลตามระดับ:
  - สำหรับ hospital_it/health_office: ตาราง 17 หมวดหมู่ + งบประมาณ
  - สำหรับ provincial: ตารางหน่วยงานในจังหวัด + งบรวมแต่ละหน่วย + drill-down
  - สำหรับ regional: ตารางจังหวัด + งบรวม + drill-down ไปหน่วยงาน
  - สำหรับ central_admin: ตารางเขตสุขภาพ + drill-down ไปจังหวัด/หน่วยงาน

### 4. เพิ่ม Route ใน App.tsx
- Path: `/reports/budget`
- Protected Route สำหรับทุก authenticated users

---

## Database Migration (เพิ่ม RLS Policies)

```sql
-- Policy: Provincial can view budget records in their province
CREATE POLICY "Provincial can view province budget records"
  ON public.budget_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'provincial'::user_role
        AND (
          budget_records.hospital_id IN (
            SELECT h.id FROM hospitals h WHERE h.province_id = p.province_id
          )
          OR budget_records.health_office_id IN (
            SELECT ho.id FROM health_offices ho WHERE ho.province_id = p.province_id
          )
        )
    )
  );

-- Policy: Regional can view budget records in their region
CREATE POLICY "Regional can view region budget records"
  ON public.budget_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN provinces prov ON prov.health_region_id = p.health_region_id
      WHERE p.user_id = auth.uid()
        AND p.role = 'regional'::user_role
        AND (
          budget_records.hospital_id IN (
            SELECT h.id FROM hospitals h WHERE h.province_id = prov.id
          )
          OR budget_records.health_office_id IN (
            SELECT ho.id FROM health_offices ho WHERE ho.health_region_id = p.health_region_id
          )
        )
    )
  );

-- Policy: Central admin can view all budget records
CREATE POLICY "Central admin can view all budget records"
  ON public.budget_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'central_admin'::user_role
    )
  );

-- Policy: Supervisor can view budget records in their region
CREATE POLICY "Supervisor can view region budget records"
  ON public.budget_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN provinces prov ON prov.health_region_id = p.health_region_id
      WHERE p.user_id = auth.uid()
        AND p.role = 'supervisor'::user_role
        AND (
          budget_records.hospital_id IN (
            SELECT h.id FROM hospitals h WHERE h.province_id = prov.id
          )
          OR budget_records.health_office_id IN (
            SELECT ho.id FROM health_offices ho WHERE ho.health_region_id = p.health_region_id
          )
        )
    )
  );
```

---

## ไฟล์ที่ต้องสร้าง/แก้ไข

| ไฟล์ | การดำเนินการ |
|------|-------------|
| `src/pages/BudgetReport.tsx` | สร้างใหม่ |
| `src/components/layout/AppSidebar.tsx` | เพิ่มเมนู |
| `src/App.tsx` | เพิ่ม Route |
| Database migration | เพิ่ม RLS policies |

---

## โครงสร้าง Component หลัก

```text
BudgetReport.tsx
├── Header (ชื่อหน้า + ปีงบประมาณ dropdown)
├── Summary Cards (ยอดรวมงบประมาณ, จำนวนหน่วยงาน)
├── Main Content (ขึ้นอยู่กับ role)
│   ├── [hospital_it/health_office] ตารางหมวดหมู่ 17 ข้อ
│   ├── [provincial] ตารางหน่วยงานในจังหวัด + drill-down
│   ├── [regional/supervisor] ตารางจังหวัด + drill-down
│   └── [central_admin] ตารางเขตสุขภาพ + drill-down
└── Footer (Export buttons - อนาคต)
```

---

## UI สำหรับแต่ละระดับผู้ใช้

### hospital_it / health_office
- แสดงตาราง 17 หมวดหมู่ CTAM พร้อมงบประมาณของหน่วยงานตัวเอง
- ยอดรวมงบประมาณ

### provincial
- Summary: จำนวนโรงพยาบาล/สสอ. ที่บันทึกงบประมาณ, ยอดรวมทั้งจังหวัด
- ตารางแสดงรายชื่อหน่วยงาน + ยอดรวมงบแต่ละหน่วย
- คลิกเพื่อดูรายละเอียด 17 หมวดหมู่ของแต่ละหน่วยงาน

### regional / supervisor
- Summary: จำนวนจังหวัด, จำนวนหน่วยงานที่บันทึก, ยอดรวมทั้งเขต
- ตารางแสดงรายชื่อจังหวัด + ยอดรวมงบแต่ละจังหวัด
- คลิกจังหวัดเพื่อดูรายชื่อหน่วยงาน
- คลิกหน่วยงานเพื่อดูรายละเอียด 17 หมวดหมู่

### central_admin
- Summary: ยอดรวมทั้งประเทศ, จำนวนหน่วยงานที่บันทึก
- ตารางแสดงรายชื่อเขตสุขภาพ + ยอดรวมงบแต่ละเขต
- Drill-down: เขต → จังหวัด → หน่วยงาน → รายละเอียด 17 ข้อ

---

## ขั้นตอนการ Implement

1. สร้าง migration สำหรับ RLS policies ใหม่
2. สร้างหน้า `BudgetReport.tsx` พร้อม UI ตาม role
3. เพิ่มเมนูใน `AppSidebar.tsx`
4. เพิ่ม Route ใน `App.tsx`
5. ทดสอบการทำงานกับแต่ละ role

