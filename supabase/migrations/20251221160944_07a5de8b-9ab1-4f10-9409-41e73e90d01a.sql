-- =============================================
-- CTAM+ National Hospital Cybersecurity Assessment System
-- Phase 1: Core Database Structure
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUM TYPES
-- =============================================

-- User roles enum
CREATE TYPE public.user_role AS ENUM (
  'hospital_it',
  'provincial',
  'regional',
  'central_admin'
);

-- Assessment status enum
CREATE TYPE public.assessment_status AS ENUM (
  'draft',
  'submitted',
  'returned',
  'approved_provincial',
  'approved_regional',
  'completed'
);

-- Assessment item status enum
CREATE TYPE public.item_status AS ENUM (
  'pass',
  'fail',
  'partial',
  'not_applicable'
);

-- =============================================
-- MASTER DATA TABLES
-- =============================================

-- Health regions (เขตสุขภาพ 1-12)
CREATE TABLE public.health_regions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  region_number INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Provinces (จังหวัด)
CREATE TABLE public.provinces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  health_region_id UUID NOT NULL REFERENCES public.health_regions(id) ON DELETE RESTRICT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Hospitals (โรงพยาบาล)
CREATE TABLE public.hospitals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  province_id UUID NOT NULL REFERENCES public.provinces(id) ON DELETE RESTRICT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  hospital_type TEXT, -- รพศ., รพท., รพช., etc.
  bed_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- USER PROFILES TABLE
-- =============================================

CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role public.user_role NOT NULL DEFAULT 'hospital_it',
  -- Link to organization based on role
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
  province_id UUID REFERENCES public.provinces(id) ON DELETE SET NULL,
  health_region_id UUID REFERENCES public.health_regions(id) ON DELETE SET NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- CTAM+ CATEGORIES (17 หมวด)
-- =============================================

CREATE TABLE public.ctam_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number INTEGER NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  name_th TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert 17 CTAM+ categories
INSERT INTO public.ctam_categories (order_number, code, name_th, name_en, description, max_score) VALUES
(1, 'BACKUP', 'การสำรองข้อมูล', 'Backup', 'ระบบสำรองข้อมูลและการกู้คืน', 1),
(2, 'ANTIVIRUS', 'โปรแกรมป้องกันไวรัส', 'Antivirus', 'ซอฟต์แวร์ป้องกันมัลแวร์และไวรัส', 1),
(3, 'ACCESS_CONTROL', 'การควบคุมการเข้าถึง', 'Access Control', 'ระบบจัดการสิทธิ์การเข้าถึง', 1),
(4, 'PAM', 'การจัดการบัญชีพิเศษ', 'Privileged Access Management', 'การจัดการ Admin Account', 1),
(5, 'BCP_DRP', 'แผนความต่อเนื่องทางธุรกิจ', 'BCP/DRP', 'Business Continuity & Disaster Recovery Plan', 1),
(6, 'OS_PATCHING', 'การอัปเดต OS', 'OS Patching', 'การอัปเดตระบบปฏิบัติการ', 1),
(7, 'MFA', 'การยืนยันตัวตนหลายปัจจัย', 'Multi-Factor Authentication', 'MFA สำหรับระบบสำคัญ', 1),
(8, 'WAF', 'ไฟร์วอลล์เว็บแอปพลิเคชัน', 'Web Application Firewall', 'WAF ป้องกันเว็บแอปพลิเคชัน', 1),
(9, 'LOG_MGMT', 'การจัดการ Log', 'Log Management', 'ระบบเก็บและจัดการ Log', 1),
(10, 'SIEM', 'ระบบ SIEM', 'Security Information & Event Management', 'ระบบวิเคราะห์ความปลอดภัย', 1),
(11, 'VA_SCAN', 'การสแกนช่องโหว่', 'Vulnerability Assessment', 'การตรวจสอบช่องโหว่ระบบ', 1),
(12, 'UNUSED_SYSTEM', 'ปิดระบบที่ไม่ใช้', 'Disable Unused Systems', 'การปิดบริการที่ไม่จำเป็น', 1),
(13, 'SW_PATCHING', 'การอัปเดตซอฟต์แวร์', 'Software Patching', 'การอัปเดตแอปพลิเคชัน', 1),
(14, 'NETWORK_SEG', 'การแบ่งเครือข่าย', 'Network Segmentation', 'VLAN/Subnet แยกโซน', 1),
(15, 'SW_LICENSE', 'ลิขสิทธิ์ซอฟต์แวร์', 'Software License', 'การใช้ซอฟต์แวร์ถูกลิขสิทธิ์', 1),
(16, 'PENTEST', 'การทดสอบเจาะระบบ', 'Penetration Testing', 'การทดสอบความปลอดภัยเชิงรุก', 1),
(17, 'POLICY', 'นโยบายและการฝึกอบรม', 'Policy & Training', 'นโยบาย IT Security และการอบรม', 1);

-- =============================================
-- ASSESSMENTS TABLE
-- =============================================

CREATE TABLE public.assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE RESTRICT,
  fiscal_year INTEGER NOT NULL, -- ปีงบประมาณ
  assessment_period TEXT NOT NULL, -- เช่น "รอบ 6 เดือน", "รอบ 10 เดือน"
  status public.assessment_status NOT NULL DEFAULT 'draft',
  -- Scores
  quantitative_score NUMERIC(5,2), -- คะแนนเชิงปริมาณ (70%)
  qualitative_score NUMERIC(5,2), -- คะแนนเชิงคุณภาพ (15%)
  impact_score NUMERIC(5,2), -- คะแนนเชิงผลกระทบ (15%)
  total_score NUMERIC(5,2), -- คะแนนรวม
  -- User tracking
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  submitted_at TIMESTAMP WITH TIME ZONE,
  submitted_by UUID REFERENCES public.profiles(id),
  -- Provincial approval
  provincial_approved_at TIMESTAMP WITH TIME ZONE,
  provincial_approved_by UUID REFERENCES public.profiles(id),
  provincial_comment TEXT,
  -- Regional approval
  regional_approved_at TIMESTAMP WITH TIME ZONE,
  regional_approved_by UUID REFERENCES public.profiles(id),
  regional_comment TEXT,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Unique constraint
  UNIQUE(hospital_id, fiscal_year, assessment_period)
);

-- =============================================
-- ASSESSMENT ITEMS (17 หมวด per assessment)
-- =============================================

CREATE TABLE public.assessment_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.ctam_categories(id) ON DELETE RESTRICT,
  status public.item_status NOT NULL DEFAULT 'fail',
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  description TEXT, -- คำอธิบายเพิ่มเติม
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(assessment_id, category_id)
);

-- =============================================
-- QUALITATIVE SCORES (เชิงคุณภาพ 15%)
-- =============================================

CREATE TABLE public.qualitative_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL UNIQUE REFERENCES public.assessments(id) ON DELETE CASCADE,
  -- Sustainable Cybersecurity
  uses_opensource BOOLEAN DEFAULT false,
  uses_freeware BOOLEAN DEFAULT false,
  sustainable_score NUMERIC(5,2) DEFAULT 0,
  -- Leadership & Teamwork
  has_ciso BOOLEAN DEFAULT false,
  has_dpo BOOLEAN DEFAULT false,
  has_it_security_team BOOLEAN DEFAULT false,
  annual_training_count INTEGER DEFAULT 0,
  leadership_score NUMERIC(5,2) DEFAULT 0,
  -- Total qualitative score
  total_score NUMERIC(5,2) DEFAULT 0,
  evaluated_by UUID REFERENCES public.profiles(id),
  evaluated_at TIMESTAMP WITH TIME ZONE,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- IMPACT SCORES (เชิงผลกระทบ 15%)
-- =============================================

CREATE TABLE public.impact_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL UNIQUE REFERENCES public.assessments(id) ON DELETE CASCADE,
  -- Cyber Incident
  had_incident BOOLEAN DEFAULT false,
  incident_recovery_hours INTEGER, -- ชั่วโมงในการกู้คืน
  incident_score NUMERIC(5,2) DEFAULT 0,
  -- Data Breach
  had_data_breach BOOLEAN DEFAULT false,
  breach_severity TEXT, -- none, minor, major, critical
  breach_penalty_level INTEGER, -- ระดับโทษตาม สคส.
  breach_score NUMERIC(5,2) DEFAULT 0,
  -- Total impact score
  total_score NUMERIC(5,2) DEFAULT 0,
  evaluated_by UUID REFERENCES public.profiles(id),
  evaluated_at TIMESTAMP WITH TIME ZONE,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- EVIDENCE FILES (หลักฐาน)
-- =============================================

CREATE TABLE public.evidence_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_item_id UUID NOT NULL REFERENCES public.assessment_items(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Storage path
  file_size INTEGER,
  file_type TEXT, -- MIME type
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- APPROVAL HISTORY (Audit Log)
-- =============================================

CREATE TABLE public.approval_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- submit, approve, return, complete
  from_status public.assessment_status NOT NULL,
  to_status public.assessment_status NOT NULL,
  performed_by UUID NOT NULL REFERENCES public.profiles(id),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_provinces_health_region ON public.provinces(health_region_id);
CREATE INDEX idx_hospitals_province ON public.hospitals(province_id);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_hospital ON public.profiles(hospital_id);
CREATE INDEX idx_profiles_province ON public.profiles(province_id);
CREATE INDEX idx_profiles_health_region ON public.profiles(health_region_id);
CREATE INDEX idx_assessments_hospital ON public.assessments(hospital_id);
CREATE INDEX idx_assessments_status ON public.assessments(status);
CREATE INDEX idx_assessments_fiscal_year ON public.assessments(fiscal_year);
CREATE INDEX idx_assessment_items_assessment ON public.assessment_items(assessment_id);
CREATE INDEX idx_evidence_files_item ON public.evidence_files(assessment_item_id);
CREATE INDEX idx_approval_history_assessment ON public.approval_history(assessment_id);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_health_regions_updated_at
  BEFORE UPDATE ON public.health_regions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_provinces_updated_at
  BEFORE UPDATE ON public.provinces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hospitals_updated_at
  BEFORE UPDATE ON public.hospitals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assessments_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assessment_items_updated_at
  BEFORE UPDATE ON public.assessment_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_qualitative_scores_updated_at
  BEFORE UPDATE ON public.qualitative_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_impact_scores_updated_at
  BEFORE UPDATE ON public.impact_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.health_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ctam_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualitative_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impact_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_history ENABLE ROW LEVEL SECURITY;

-- Master data: readable by all authenticated users
CREATE POLICY "Health regions are viewable by all authenticated users" 
  ON public.health_regions FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Provinces are viewable by all authenticated users" 
  ON public.provinces FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Hospitals are viewable by all authenticated users" 
  ON public.hospitals FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "CTAM categories are viewable by all authenticated users" 
  ON public.ctam_categories FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Profiles: users can see their own profile, admins can see all
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = user_id);

-- Assessments: complex visibility based on role
CREATE POLICY "Hospital IT can view own hospital assessments" 
  ON public.assessments FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.hospital_id = assessments.hospital_id
    )
  );

CREATE POLICY "Hospital IT can create own hospital assessments" 
  ON public.assessments FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.hospital_id = assessments.hospital_id
      AND profiles.role = 'hospital_it'
    )
  );

CREATE POLICY "Hospital IT can update draft assessments" 
  ON public.assessments FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.hospital_id = assessments.hospital_id
      AND profiles.role = 'hospital_it'
    )
    AND status IN ('draft', 'returned')
  );

-- Provincial can view all assessments in their province
CREATE POLICY "Provincial can view province assessments" 
  ON public.assessments FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.hospitals h ON h.province_id = p.province_id
      WHERE p.user_id = auth.uid() 
      AND p.role = 'provincial'
      AND h.id = assessments.hospital_id
    )
  );

CREATE POLICY "Provincial can update submitted assessments" 
  ON public.assessments FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.hospitals h ON h.province_id = p.province_id
      WHERE p.user_id = auth.uid() 
      AND p.role = 'provincial'
      AND h.id = assessments.hospital_id
    )
    AND status = 'submitted'
  );

-- Regional can view all assessments in their region
CREATE POLICY "Regional can view region assessments" 
  ON public.assessments FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.provinces prov ON prov.health_region_id = p.health_region_id
      JOIN public.hospitals h ON h.province_id = prov.id
      WHERE p.user_id = auth.uid() 
      AND p.role = 'regional'
      AND h.id = assessments.hospital_id
    )
  );

CREATE POLICY "Regional can update provincial-approved assessments" 
  ON public.assessments FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.provinces prov ON prov.health_region_id = p.health_region_id
      JOIN public.hospitals h ON h.province_id = prov.id
      WHERE p.user_id = auth.uid() 
      AND p.role = 'regional'
      AND h.id = assessments.hospital_id
    )
    AND status = 'approved_provincial'
  );

-- Central admin can view and manage all
CREATE POLICY "Central admin can view all assessments" 
  ON public.assessments FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'central_admin'
    )
  );

CREATE POLICY "Central admin can manage all assessments" 
  ON public.assessments FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'central_admin'
    )
  );

-- Assessment items follow assessment visibility
CREATE POLICY "Assessment items follow assessment visibility" 
  ON public.assessment_items FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = assessment_items.assessment_id
    )
  );

CREATE POLICY "Assessment items can be managed by assessment owner" 
  ON public.assessment_items FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      JOIN public.profiles p ON p.hospital_id = a.hospital_id
      WHERE a.id = assessment_items.assessment_id
      AND p.user_id = auth.uid()
    )
  );

-- Qualitative scores: viewable by assessment viewers, editable by provincial/regional
CREATE POLICY "Qualitative scores follow assessment visibility" 
  ON public.qualitative_scores FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = qualitative_scores.assessment_id
    )
  );

CREATE POLICY "Provincial/Regional can manage qualitative scores" 
  ON public.qualitative_scores FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('provincial', 'regional', 'central_admin')
    )
  );

-- Impact scores: similar to qualitative
CREATE POLICY "Impact scores follow assessment visibility" 
  ON public.impact_scores FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = impact_scores.assessment_id
    )
  );

CREATE POLICY "Provincial/Regional can manage impact scores" 
  ON public.impact_scores FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('provincial', 'regional', 'central_admin')
    )
  );

-- Evidence files follow assessment item visibility
CREATE POLICY "Evidence files follow assessment item visibility" 
  ON public.evidence_files FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.assessment_items ai
      WHERE ai.id = evidence_files.assessment_item_id
    )
  );

CREATE POLICY "Evidence files can be managed by assessment owner" 
  ON public.evidence_files FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.assessment_items ai
      JOIN public.assessments a ON a.id = ai.assessment_id
      JOIN public.profiles p ON p.hospital_id = a.hospital_id
      WHERE ai.id = evidence_files.assessment_item_id
      AND p.user_id = auth.uid()
    )
  );

-- Approval history: viewable by assessment viewers
CREATE POLICY "Approval history follows assessment visibility" 
  ON public.approval_history FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = approval_history.assessment_id
    )
  );

CREATE POLICY "Approval history can be created by authenticated users" 
  ON public.approval_history FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Central admin can manage master data
CREATE POLICY "Central admin can manage health regions" 
  ON public.health_regions FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'central_admin'
    )
  );

CREATE POLICY "Central admin can manage provinces" 
  ON public.provinces FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'central_admin'
    )
  );

CREATE POLICY "Central admin can manage hospitals" 
  ON public.hospitals FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'central_admin'
    )
  );

CREATE POLICY "Central admin can manage profiles" 
  ON public.profiles FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() 
      AND p.role = 'central_admin'
    )
  );

-- =============================================
-- FUNCTION: Create profile on user signup
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();