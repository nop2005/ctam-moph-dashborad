-- Add columns to track email sending status
ALTER TABLE assessments 
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS email_sent_by UUID REFERENCES profiles(id);

COMMENT ON COLUMN assessments.email_sent_at IS 'วันเวลาที่ส่งอีเมลไปยัง ศทส.สป.';
COMMENT ON COLUMN assessments.email_sent_by IS 'ผู้ที่กดส่งอีเมล (regional admin)';