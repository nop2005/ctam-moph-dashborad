import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AssessmentHeader } from '@/components/assessment/AssessmentHeader';
import { QuantitativeSection } from '@/components/assessment/QuantitativeSection';
import { QualitativeSection } from '@/components/assessment/QualitativeSection';
import { ImpactSection } from '@/components/assessment/ImpactSection';
import { AssessmentSummary } from '@/components/assessment/AssessmentSummary';

import { ApprovalWorkflow } from '@/components/assessment/ApprovalWorkflow';
import { SectionApproval } from '@/components/assessment/SectionApproval';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Assessment = Database['public']['Tables']['assessments']['Row'];
type AssessmentItem = Database['public']['Tables']['assessment_items']['Row'];
type CTAMCategory = Database['public']['Tables']['ctam_categories']['Row'];
type QualitativeScore = Database['public']['Tables']['qualitative_scores']['Row'];
type ImpactScore = Database['public']['Tables']['impact_scores']['Row'];

export default function Assessment() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [categories, setCategories] = useState<CTAMCategory[]>([]);
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [qualitativeScore, setQualitativeScore] = useState<QualitativeScore | null>(null);
  const [impactScore, setImpactScore] = useState<ImpactScore | null>(null);
  const [activeTab, setActiveTab] = useState('quantitative');

  const isReadOnly = assessment?.status !== 'draft' && assessment?.status !== 'returned';
  const canEdit = profile?.role === 'hospital_it' && !isReadOnly;
  const canReview = (profile?.role === 'provincial' && assessment?.status === 'submitted') ||
                   (profile?.role === 'regional' && assessment?.status === 'approved_provincial');
  const canApprove = profile?.role === 'central_admin';

  useEffect(() => {
    if (id) {
      loadAssessmentData();
    }
  }, [id]);

  const loadAssessmentData = async () => {
    try {
      setLoading(true);

      // Load categories
      const { data: categoriesData, error: catError } = await supabase
        .from('ctam_categories')
        .select('*')
        .order('order_number');

      if (catError) throw catError;
      setCategories(categoriesData || []);

      // Load assessment
      const { data: assessmentData, error: assessError } = await supabase
        .from('assessments')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (assessError) throw assessError;
      if (!assessmentData) {
        toast({ title: 'ไม่พบแบบประเมิน', variant: 'destructive' });
        navigate('/assessments');
        return;
      }
      setAssessment(assessmentData);

      // Load assessment items
      const { data: itemsData, error: itemsError } = await supabase
        .from('assessment_items')
        .select('*')
        .eq('assessment_id', id);

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      // Load qualitative score
      const { data: qualData } = await supabase
        .from('qualitative_scores')
        .select('*')
        .eq('assessment_id', id)
        .maybeSingle();
      setQualitativeScore(qualData);

      // Load impact score
      const { data: impactData } = await supabase
        .from('impact_scores')
        .select('*')
        .eq('assessment_id', id)
        .maybeSingle();
      setImpactScore(impactData);

    } catch (error: any) {
      console.error('Error loading assessment:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!assessment) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AssessmentHeader 
          assessment={assessment} 
          onRefresh={loadAssessmentData}
          canEdit={canEdit}
        />

        {/* Approval Workflow Stepper */}
        <ApprovalWorkflow status={assessment.status} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-3xl h-auto bg-muted">
            <TabsTrigger value="quantitative" className="text-lg py-3 border border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">เชิงปริมาณ (70%)</TabsTrigger>
            <TabsTrigger value="qualitative" className="text-lg py-3 border border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">เชิงคุณภาพ (15%)</TabsTrigger>
            <TabsTrigger value="impact" className="text-lg py-3 border border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">ผลกระทบ (15%)</TabsTrigger>
            <TabsTrigger value="summary" className="text-lg py-3 border border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">สรุปผล</TabsTrigger>
          </TabsList>

          <TabsContent value="quantitative" className="space-y-4">
            <QuantitativeSection
              assessmentId={assessment.id}
              categories={categories}
              items={items}
              onItemsChange={setItems}
              readOnly={!canEdit}
            />
            {/* Section-level approval for quantitative */}
            <SectionApproval 
              assessment={assessment} 
              sectionType="quantitative" 
              onRefresh={loadAssessmentData} 
            />
          </TabsContent>

          <TabsContent value="qualitative" className="space-y-4">
            <QualitativeSection
              assessmentId={assessment.id}
              qualitativeScore={qualitativeScore}
              onScoreChange={setQualitativeScore}
              readOnly={!canEdit && !canReview && !canApprove}
            />
            {/* Section-level approval for qualitative */}
            <SectionApproval 
              assessment={assessment} 
              sectionType="qualitative" 
              onRefresh={loadAssessmentData} 
            />
          </TabsContent>

          <TabsContent value="impact" className="space-y-4">
            <ImpactSection
              assessmentId={assessment.id}
              impactScore={impactScore}
              onScoreChange={setImpactScore}
              readOnly={!canEdit && !canReview && !canApprove}
            />
            {/* Section-level approval for impact */}
            <SectionApproval 
              assessment={assessment} 
              sectionType="impact" 
              onRefresh={loadAssessmentData} 
            />
          </TabsContent>

          <TabsContent value="summary">
            <AssessmentSummary
              assessment={assessment}
              items={items}
              categories={categories}
              qualitativeScore={qualitativeScore}
              impactScore={impactScore}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}