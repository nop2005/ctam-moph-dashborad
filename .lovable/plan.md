

# แผนการพัฒนาเมนู "บันทึกงบประมาณประจำปี"

## สรุปภาพรวม
เพิ่มเมนูหลักใหม่ "บันทึกงบประมาณประจำปี" ให้หน่วยงาน (โรงพยาบาล/สสจ.) บันทึกงบประมาณแยกตามปีงบประมาณ และแยกรายข้อ CTAM 17 หมวดหมู่ พร้อมแก้ไขได้ตลอดเวลา

---

## ฟีเจอร์หลัก

1. **เลือกปีงบประมาณ** - Dropdown เลือกปี พ.ศ.
2. **แสดง 17 หมวดหมู่ CTAM** - แต่ละข้อมีช่องกรอกตัวเลขงบประมาณ
3. **คำนวณยอดรวม** - รวมงบทุกหมวดหมู่อัตโนมัติ
4. **แก้ไขได้ตลอดเวลา** - ไม่มี lock ผู้ใช้สามารถแก้ไขตัวเลขได้เสมอ
5. **บันทึกอัตโนมัติ** - Auto-save เมื่อเปลี่ยนค่า

---

## สิ่งที่ต้องทำ

### 1. สร้างตารางฐานข้อมูลใหม่

| คอลัมน์ | ชนิด | คำอธิบาย |
|---------|------|----------|
| id | UUID | Primary Key |
| hospital_id | UUID | FK → hospitals (nullable) |
| health_office_id | UUID | FK → health_offices (nullable) |
| fiscal_year | INTEGER | ปีงบประมาณ เช่น 2568, 2569 |
| category_id | UUID | FK → ctam_categories |
| budget_amount | NUMERIC(15,2) | จำนวนเงิน (บาท) |
| created_at | TIMESTAMP | วันที่สร้าง |
| updated_at | TIMESTAMP | วันที่แก้ไขล่าสุด |
| created_by | UUID | FK → profiles |

- เพิ่ม UNIQUE constraint: (hospital_id/health_office_id, fiscal_year, category_id)
- เพิ่ม RLS policies สำหรับ hospital_it และ health_office roles

### 2. เพิ่มเมนูใน Sidebar
- เพิ่มเมนู "บันทึกงบประมาณประจำปี" หลังจากเมนู "บุคลากรในหน่วยงาน"
- ใช้ icon `Wallet` หรือ `Banknote` จาก lucide-react
- แสดงเฉพาะ roles: `hospital_it`, `health_office`

### 3. สร้างหน้า BudgetRecording.tsx
**องค์ประกอบ UI:**
- Header แสดงชื่อหน้าและปีงบประมาณที่เลือก
- Dropdown เลือกปีงบประมาณ (พ.ศ. 2567-2575)
- ตารางแสดง 17 หมวดหมู่ CTAM พร้อม:
  - ลำดับที่
  - ชื่อหมวดหมู่ (ภาษาไทย)
  - ช่อง Input สำหรับกรอกงบประมาณ (format: เลขทศนิยม 2 ตำแหน่ง)
- แถวสรุปยอดรวมทั้งหมดด้านล่าง
- ปุ่มบันทึก (หรือ auto-save)

### 4. เพิ่ม Route ใน App.tsx
- Path: `/budget-recording`
- Protected Route สำหรับ roles: `hospital_it`, `health_office`

---

## รายละเอียดทางเทคนิค

### Database Migration SQL
```sql
CREATE TABLE public.budget_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE,
  health_office_id UUID REFERENCES public.health_offices(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  category_id UUID NOT NULL REFERENCES public.ctam_categories(id),
  budget_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  
  CONSTRAINT budget_hospital_or_office CHECK (
    (hospital_id IS NOT NULL AND health_office_id IS NULL) OR
    (hospital_id IS NULL AND health_office_id IS NOT NULL)
  ),
  CONSTRAINT unique_budget_hospital UNIQUE (hospital_id, fiscal_year, category_id),
  CONSTRAINT unique_budget_health_office UNIQUE (health_office_id, fiscal_year, category_id)
);

-- Trigger for updated_at
CREATE TRIGGER update_budget_records_updated_at
  BEFORE UPDATE ON public.budget_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE public.budget_records ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view/edit their own organization's budget
CREATE POLICY "Users can view own organization budget"
  ON public.budget_records FOR SELECT
  USING (
    hospital_id IN (SELECT hospital_id FROM profiles WHERE user_id = auth.uid())
    OR health_office_id IN (SELECT health_office_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own organization budget"
  ON public.budget_records FOR INSERT
  WITH CHECK (
    hospital_id IN (SELECT hospital_id FROM profiles WHERE user_id = auth.uid())
    OR health_office_id IN (SELECT health_office_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own organization budget"
  ON public.budget_records FOR UPDATE
  USING (
    hospital_id IN (SELECT hospital_id FROM profiles WHERE user_id = auth.uid())
    OR health_office_id IN (SELECT health_office_id FROM profiles WHERE user_id = auth.uid())
  );
```

### ไฟล์ที่ต้องสร้าง/แก้ไข

| ไฟล์ | การดำเนินการ |
|------|-------------|
| `src/pages/BudgetRecording.tsx` | สร้างใหม่ |
| `src/components/layout/AppSidebar.tsx` | เพิ่มเมนู |
| `src/App.tsx` | เพิ่ม Route |

### โครงสร้าง Component หลัก

```
BudgetRecording.tsx
├── Header (ชื่อหน้า + ปีงบประมาณ dropdown)
├── Card
│   └── Table
│       ├── TableHeader (ลำดับ, หมวดหมู่, งบประมาณ)
│       ├── TableBody (17 rows จาก ctam_categories)
│       │   └── Input (number) สำหรับแต่ละหมวด
│       └── TableFooter (รวมทั้งหมด)
└── Save Button / Auto-save indicator
```

---

## ขั้นตอนการ Implement

1. สร้าง migration สำหรับตาราง `budget_records`
2. สร้างหน้า `BudgetRecording.tsx` พร้อม UI ครบถ้วน
3. เพิ่มเมนูใน `AppSidebar.tsx`
4. เพิ่ม Route ใน `App.tsx`
5. ทดสอบการทำงาน

