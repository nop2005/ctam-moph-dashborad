import { CheckCircle2, Clock, User, Building2, MapPin, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Database } from '@/integrations/supabase/types';

type AssessmentStatus = Database['public']['Enums']['assessment_status'];

interface ApprovalWorkflowProps {
  status: AssessmentStatus;
}

interface WorkflowStep {
  id: number;
  label: string;
  description: string;
  icon: React.ReactNode;
  statusMatch: AssessmentStatus[];
}

const workflowSteps: WorkflowStep[] = [
  {
    id: 1,
    label: 'โรงพยาบาล',
    description: 'สร้าง/แก้ไขแบบประเมิน',
    icon: <Building2 className="w-5 h-5" />,
    statusMatch: ['draft', 'returned'],
  },
  {
    id: 2,
    label: 'ส่งตรวจสอบ',
    description: 'รอ สสจ. ตรวจสอบ',
    icon: <Clock className="w-5 h-5" />,
    statusMatch: ['submitted'],
  },
  {
    id: 3,
    label: 'สสจ. อนุมัติ',
    description: 'ผ่านการตรวจสอบระดับจังหวัด',
    icon: <MapPin className="w-5 h-5" />,
    statusMatch: ['approved_provincial'],
  },
  {
    id: 4,
    label: 'เขตสุขภาพ อนุมัติ',
    description: 'ผ่านการตรวจสอบระดับเขต',
    icon: <Shield className="w-5 h-5" />,
    statusMatch: ['approved_regional'],
  },
  {
    id: 5,
    label: 'เสร็จสิ้น',
    description: 'การประเมินเสร็จสมบูรณ์',
    icon: <CheckCircle2 className="w-5 h-5" />,
    statusMatch: ['completed'],
  },
];

const getStepStatus = (step: WorkflowStep, currentStatus: AssessmentStatus): 'completed' | 'current' | 'waiting' | 'pending' => {
  // Get current step index - this is the step that was just completed
  const currentStepIndex = workflowSteps.findIndex(s => s.statusMatch.includes(currentStatus));
  const stepIndex = workflowSteps.indexOf(step);

  // Steps up to and including current step should be completed (green)
  if (stepIndex <= currentStepIndex) return 'completed';
  // Next step after current should be "waiting" (pulsing)
  if (stepIndex === currentStepIndex + 1) return 'waiting';
  return 'pending';
};

export function ApprovalWorkflow({ status }: ApprovalWorkflowProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">ขั้นตอนการอนุมัติ</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between relative">
          {/* Progress line */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted z-0" />
          
          {workflowSteps.map((step, index) => {
            const stepStatus = getStepStatus(step, status);
            
            return (
              <div key={step.id} className="flex flex-col items-center relative z-10 flex-1">
                {/* Step circle */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    stepStatus === 'completed'
                      ? 'bg-success text-success-foreground border-success'
                      : stepStatus === 'current'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : stepStatus === 'waiting'
                      ? 'bg-primary/20 text-primary border-primary animate-pulse'
                      : 'bg-muted text-muted-foreground border-muted'
                  }`}
                >
                  {stepStatus === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    step.icon
                  )}
                </div>
                
                {/* Step label */}
                <div className="mt-2 text-center">
                  <p
                    className={`text-xs font-medium ${
                      stepStatus === 'completed'
                        ? 'text-success'
                        : stepStatus === 'current'
                        ? 'text-primary'
                        : stepStatus === 'waiting'
                        ? 'text-primary animate-pulse'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground max-w-[80px] hidden md:block">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
