-- อัปเดต profile ของ user 41106@ctam.moph เพื่อให้ทำแบบประเมินในนาม สำนักงานเขตสุขภาพที่ 1 ได้
UPDATE profiles
SET 
  role = 'health_office',
  health_region_id = '4639574e-9516-4d23-9a8d-b40fba044b54',  -- เขตสุขภาพที่ 1
  health_office_id = '494cc365-00c1-4185-b998-b1e05c07cd44'   -- สำนักงานเขตสุขภาพที่ 1
WHERE email = '41106@ctam.moph';