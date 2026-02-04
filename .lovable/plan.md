
# แผนการเพิ่มเมนู "รายงานบุคลากร" เป็นเมนูหลัก

## สรุปความต้องการ
เพิ่มเมนูหลัก "รายงานบุคลากร" แยกต่างหากจากเมนูย่อยอื่นๆ พร้อมตัวกรองแบบลำดับขั้น (เขต -> จังหวัด -> หน่วยงาน) และแสดงคอลัมน์จำนวนใบรับรอง + ชื่อใบรับรองของบุคลากรแต่ละคน

---

## ไฟล์ที่ต้องสร้าง/แก้ไข

| ไฟล์ | การดำเนินการ |
|------|--------------|
| `src/pages/PersonnelReport.tsx` | สร้างใหม่ |
| `src/App.tsx` | เพิ่ม route `/reports/personnel` |
| `src/components/layout/AppSidebar.tsx` | เพิ่มเมนูหลักใน `menuItems` |

---

## 1. สร้างหน้ารายงานบุคลากรใหม่

### ตัวกรองแบบ Cascade (ลำดับขั้น)

| ตัวกรอง | รายละเอียด |
|---------|------------|
| เขตสุขภาพ | เลือกเขต 1-13 (SearchableSelect) |
| จังหวัด | กรองตามเขตที่เลือก (auto-reset เมื่อเปลี่ยนเขต) |
| หน่วยงาน | กรองตามจังหวัด (รวมทั้ง hospitals และ health_offices) |
| ตำแหน่ง | กรองตามตำแหน่งบุคลากร |

### ตารางแสดงผล

| คอลัมน์ | ที่มาข้อมูล |
|---------|------------|
| ลำดับ | Running number |
| ชื่อ-นามสกุล | `personnel.title_prefix + first_name + last_name` |
| หน่วยงาน | `hospitals.name` หรือ `health_offices.name` |
| จังหวัด | `provinces.name` |
| ตำแหน่ง | `personnel.position` |
| เบอร์โทร | `personnel.phone` |
| วันที่เริ่มทำงาน | `personnel.start_date` (พ.ศ.) |
| จำนวนใบรับรอง | นับจาก `personnel_certificates` |
| ชื่อใบรับรอง | รายชื่อใบรับรองคั่นด้วย `, ` |

### สิทธิ์การเข้าถึง (Role-Based)

| Role | การเข้าถึง |
|------|-----------|
| central_admin | เห็นทุกเขต/จังหวัด/หน่วยงาน |
| regional | เห็นเฉพาะเขตของตนเอง |
| provincial | เห็นเฉพาะจังหวัดของตนเอง (ตัวกรองจังหวัดถูก lock) |

---

## 2. เพิ่มเมนูหลักใน Sidebar

เพิ่มใน `menuItems` array (ไม่ใช่ analyticalReportSubItems):

```text
{
  title: "รายงานบุคลากร",
  url: "/reports/personnel",
  icon: Users,
  roles: ["provincial", "regional", "central_admin"]
}
```

ตำแหน่ง: วางหลังเมนู "บุคลากร" (personnel-admin) ซึ่งมีสำหรับ provincial/regional อยู่แล้ว

---

## 3. เพิ่ม Route ใน App.tsx

```text
<Route 
  path="/reports/personnel" 
  element={
    <ProtectedRoute allowedRoles={['provincial', 'regional', 'central_admin']}>
      <PersonnelReport />
    </ProtectedRoute>
  } 
/>
```

---

## 4. ฟีเจอร์เสริม

- ปุ่ม "Export Excel" ส่งออกข้อมูลพร้อมจำนวนและชื่อใบรับรอง
- ปุ่ม "ล้างตัวกรอง" เคลียร์ค่าทั้งหมด
- แสดงจำนวนบุคลากรทั้งหมดที่กรองได้

---

## รายละเอียดทางเทคนิค

### การดึงข้อมูล

1. **Reference Data**: ดึง health_regions, provinces, hospitals, health_offices สำหรับตัวกรอง
2. **Personnel Data**: ดึง personnel พร้อม joins กับ hospitals/health_offices และ provinces
3. **Certificates**: ดึง personnel_certificates แยกแล้ว group by personnel_id ใน client-side

### Cascade Filter Logic

```text
1. เมื่อเลือกเขต -> reset จังหวัด และ หน่วยงาน เป็น "all"
2. เมื่อเลือกจังหวัด -> reset หน่วยงาน เป็น "all"
3. กรองตำแหน่ง client-side
```

### การแสดงใบรับรอง

```text
- ดึง personnel_certificates ทั้งหมดสำหรับ personnel_ids ที่แสดง
- Group by personnel_id และนับจำนวน
- รวมชื่อใบรับรองด้วย .join(", ")
- แสดงในคอลัมน์ตาราง
```

---

## ลำดับขั้นตอนการพัฒนา

1. สร้างไฟล์ `PersonnelReport.tsx` พร้อม layout และ filter พื้นฐาน
2. เพิ่มการดึงข้อมูล reference (regions, provinces, hospitals, health_offices)
3. เพิ่มการดึงข้อมูล personnel พร้อม joins
4. เพิ่มการดึง personnel_certificates และ group ตาม personnel_id
5. สร้างตารางแสดงผลพร้อมคอลัมน์ใบรับรอง
6. เพิ่ม role-based access control
7. เพิ่มปุ่ม Export Excel
8. เพิ่ม route ใน App.tsx
9. เพิ่มเมนูหลักใน AppSidebar.tsx (menuItems array)
