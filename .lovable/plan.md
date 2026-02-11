

# เพิ่มสิทธิ์ Drill Down สำหรับ CEO เหมือน Admin จังหวัด

## สรุป

เพิ่ม report access policies สำหรับ role `ceo` ในตาราง `report_access_policies` โดยคัดลอกค่าจาก `provincial` ทั้ง 3 ประเภทรายงาน (overview, quantitative, impact)

## สิ่งที่ต้องทำ

### 1. เพิ่มข้อมูล report_access_policies สำหรับ CEO

เพิ่ม 3 แถวใน `report_access_policies` โดยใช้ค่าเดียวกับ provincial:

| report_type | drill_to_province | drill_to_hospital | view_same_province_hospitals |
|---|---|---|---|
| overview | own_region | own_province | true |
| quantitative | all | all | true |
| impact | all | all | true |

### 2. ตรวจสอบโค้ดหน้ารายงาน

ตรวจสอบว่าหน้ารายงาน (Reports, ReportsQuantitative, ReportsImpact) ใช้ `useReportAccessPolicy` hook อยู่แล้วหรือไม่ ถ้าใช้อยู่แล้วก็ไม่ต้องแก้โค้ดเพิ่มเพราะ hook จะอ่าน policy จาก role ของ user โดยอัตโนมัติ

## รายละเอียดทางเทคนิค

- ใช้ INSERT เพิ่มข้อมูลใน `report_access_policies` (ไม่ต้อง migration เพราะเป็นการเพิ่มข้อมูล ไม่ใช่เปลี่ยนโครงสร้าง)
- Hook `useReportAccessPolicy` จะ match policy ตาม `profile.role` และ `reportType` โดยอัตโนมัติ ดังนั้นเมื่อเพิ่ม policy แล้ว CEO จะได้สิทธิ์ drill down ตามที่กำหนดทันที

