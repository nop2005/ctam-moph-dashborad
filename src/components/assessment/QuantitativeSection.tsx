import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileUpload } from './FileUpload';
import { CheckCircle2, XCircle, AlertCircle, Loader2, Award, Info, TrendingUp } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AssessmentItem = Database['public']['Tables']['assessment_items']['Row'];
type CTAMCategory = Database['public']['Tables']['ctam_categories']['Row'];
type ItemStatus = Database['public']['Enums']['item_status'];

interface QuantitativeSectionProps {
  assessmentId: string;
  categories: CTAMCategory[];
  items: AssessmentItem[];
  onItemsChange: (items: AssessmentItem[]) => void;
  readOnly: boolean;
}

interface QualityLevel {
  level: number;
  name: string;
  nameEn: string;
  minScore: number;
  maxScore: number;
  interpretation: string;
  developmentLevel: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const qualityLevels: QualityLevel[] = [
  {
    level: 5,
    name: 'ดีเยี่ยม',
    nameEn: 'Excellent',
    minScore: 86,
    maxScore: 100,
    interpretation: 'ผลลัพธ์โดดเด่น สร้างผลกระทบเชิงบวกต่อประชาชนและระบบบริการสาธารณสุขอย่างยั่งยืน',
    developmentLevel: 'ยั่งยืนและเป็นต้นแบบ',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-500',
  },
  {
    level: 4,
    name: 'ดี',
    nameEn: 'Good',
    minScore: 71,
    maxScore: 85,
    interpretation: 'ผลลัพธ์บรรลุเป้าหมายชัดเจน สร้างผลกระทบเชิงบวกต่อประชาชน แต่ควรพัฒนาระบบบริการสุขภาพอย่างต่อเนื่อง',
    developmentLevel: 'พัฒนาอย่างมั่นคง',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
  },
  {
    level: 3,
    name: 'พอใช้',
    nameEn: 'Fair',
    minScore: 56,
    maxScore: 70,
    interpretation: 'ผลลัพธ์อยู่ในระดับมาตรฐาน มีระบบบริการสุขภาพบางส่วนต้องปรับปรุง',
    developmentLevel: 'กำลังพัฒนา',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-500',
  },
  {
    level: 2,
    name: 'ต้องพัฒนา',
    nameEn: 'Developing',
    minScore: 41,
    maxScore: 55,
    interpretation: 'ผลลัพธ์ยังไม่บรรลุเป้าหมาย ต้องปรับกลยุทธ์หรือระบบสนับสนุน',
    developmentLevel: 'ต้องการการสนับสนุน',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-500',
  },
  {
    level: 1,
    name: 'ต้องเร่งแก้ไข',
    nameEn: 'Critical',
    minScore: 0,
    maxScore: 40,
    interpretation: 'ผลลัพธ์ไม่เป็นไปตามเป้าหมาย หรือเกิดผลกระทบในทางลบต่อประชาชนและระบบบริการสุขภาพ ต้องแก้ไขเร่งด่วน',
    developmentLevel: 'ต้องการฟื้นฟูระบบ',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
  },
];

const getQualityLevel = (percentScore: number): QualityLevel => {
  for (const level of qualityLevels) {
    if (percentScore >= level.minScore && percentScore <= level.maxScore) {
      return level;
    }
  }
  return qualityLevels[qualityLevels.length - 1];
};

const statusOptions: { value: ItemStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'pass', label: 'มี (Yes)', icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-success' },
  { value: 'fail', label: 'ไม่มี (No)', icon: <XCircle className="w-4 h-4" />, color: 'text-destructive' },
];

export function QuantitativeSection({
  assessmentId,
  categories,
  items,
  onItemsChange,
  readOnly,
}: QuantitativeSectionProps) {
  const { toast } = useToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const getItemForCategory = (categoryId: string) => {
    return items.find(item => item.category_id === categoryId);
  };

  const calculateProgress = () => {
    const passCount = items.filter(i => i.status === 'pass').length;
    const total = categories.length;
    return {
      pass: passCount,
      fail: total - passCount,
      percentage: total > 0 ? (passCount / total) * 100 : 0,
    };
  };

  const handleStatusChange = async (categoryId: string, newStatus: ItemStatus) => {
    const item = getItemForCategory(categoryId);
    if (!item) return;

    try {
      setSavingId(item.id);
      
      const score = newStatus === 'pass' ? 1 : 0;
      
      const { error } = await supabase
        .from('assessment_items')
        .update({ status: newStatus, score })
        .eq('id', item.id);

      if (error) throw error;

      onItemsChange(
        items.map(i => i.id === item.id ? { ...i, status: newStatus, score } : i)
      );

      // Auto expand accordion when status is selected
      if (!expandedItems.includes(categoryId)) {
        setExpandedItems(prev => [...prev, categoryId]);
      }

    } catch (error: any) {
      console.error('Error updating item:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const handleDescriptionChange = async (categoryId: string, description: string) => {
    const item = getItemForCategory(categoryId);
    if (!item) return;

    try {
      const { error } = await supabase
        .from('assessment_items')
        .update({ description })
        .eq('id', item.id);

      if (error) throw error;

      onItemsChange(
        items.map(i => i.id === item.id ? { ...i, description } : i)
      );

    } catch (error: any) {
      console.error('Error updating description:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const progress = calculateProgress();
  
  // Calculate score converted to 70% weight (out of 7 points)
  const scoreOut7 = (progress.percentage / 100) * 7;

  // Get quality level based on percentage
  const qualityLevel = getQualityLevel(progress.percentage);

  return (
    <div className="space-y-6">
      {/* Progress Summary & Interpretation Cards - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Progress Summary Card */}
        <Card className={`border-2 ${qualityLevel.borderColor}`}>
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-base">เชิงปริมาณ (Quantitative) - 70%</CardTitle>
              <CardDescription className="text-xs">
                ประเมินตามมาตรฐาน CTAM+ 17 หมวด
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {scoreOut7.toFixed(2)}<span className="text-sm text-muted-foreground">/7</span>
              </div>
              <div className="text-xs text-muted-foreground">คะแนน</div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-3">
              <Progress value={progress.percentage} className="h-2" />
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-success" />
                    <span>มี: {progress.pass}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-destructive" />
                    <span>ไม่มี: {progress.fail}</span>
                  </div>
                </div>
                <span className="font-medium">{progress.pass}/{categories.length} ({progress.percentage.toFixed(1)}%)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quality Level Interpretation Card */}
        <Card className={`border-2 ${qualityLevel.borderColor}`}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className={`w-4 h-4 ${qualityLevel.color}`} />
              การแปลผลระดับคุณภาพ
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 rounded-full hover:bg-muted">
                    <Info className="w-3 h-3 text-muted-foreground hover:text-primary" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-lg">ตารางการแปลผลระดับคุณภาพและระดับคะแนนการพัฒนา (5 ระดับ)</DialogTitle>
                  </DialogHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">ระดับคุณภาพ</th>
                          <th className="text-center py-3 px-4 font-medium">ช่วงคะแนน</th>
                          <th className="text-left py-3 px-4 font-medium">การแปลผลเชิงคุณภาพ</th>
                          <th className="text-center py-3 px-4 font-medium">ระดับการพัฒนา</th>
                        </tr>
                      </thead>
                      <tbody>
                        {qualityLevels.map((level) => (
                          <tr 
                            key={level.level} 
                            className={`border-b ${progress.percentage >= level.minScore && progress.percentage <= level.maxScore ? level.bgColor : ''}`}
                          >
                            <td className={`py-3 px-4 font-medium ${level.color}`}>
                              ระดับ {level.level} = {level.name} ({level.nameEn})
                            </td>
                            <td className={`py-3 px-4 text-center ${level.color}`}>
                              {level.level === 1 ? 'ต่ำกว่าหรือเท่ากับ 40' : `${level.minScore} - ${level.maxScore}`}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground">
                              {level.interpretation}
                            </td>
                            <td className={`py-3 px-4 text-center font-medium ${level.color}`}>
                              {level.developmentLevel}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`p-3 rounded-lg ${qualityLevel.bgColor} space-y-2`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className={`px-2 py-0.5 rounded-full ${qualityLevel.bgColor} border ${qualityLevel.borderColor}`}>
                    <span className={`font-bold text-sm ${qualityLevel.color}`}>
                      ระดับ {qualityLevel.level} = {qualityLevel.name}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {qualityLevel.level === 1 ? '≤40' : `${qualityLevel.minScore}-${qualityLevel.maxScore}`}%
                  </span>
                </div>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${qualityLevel.borderColor} ${qualityLevel.bgColor}`}>
                  <TrendingUp className={`w-3 h-3 ${qualityLevel.color}`} />
                  <span className={`font-medium text-xs ${qualityLevel.color}`}>{qualityLevel.developmentLevel}</span>
                </div>
              </div>
              <p className={`text-xs ${qualityLevel.color}`}>
                <strong>การแปลผล:</strong> {qualityLevel.interpretation}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categories */}
      <Card>
        <CardContent className="p-0">
          <Accordion 
            type="multiple" 
            className="w-full"
            value={expandedItems}
            onValueChange={setExpandedItems}
          >
            {categories.map((category, index) => {
              const item = getItemForCategory(category.id);
              const statusOption = statusOptions.find(s => s.value === item?.status);
              const showFileUpload = item?.status === 'pass';
              
              return (
                <AccordionItem key={category.id} value={category.id}>
                  <AccordionTrigger className="px-6 hover:no-underline">
                    <div className="flex items-center gap-4 text-left flex-1">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {category.order_number}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{category.name_th}</div>
                        <div className="text-sm text-muted-foreground">{category.name_en}</div>
                      </div>
                      {/* Status Selection in Trigger */}
                      <div 
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {statusOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!readOnly && savingId !== item?.id) {
                                handleStatusChange(category.id, option.value);
                              }
                            }}
                            disabled={readOnly || savingId === item?.id}
                            className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-all ${
                              item?.status === option.value 
                                ? `${option.color} border-current bg-background font-medium` 
                                : 'text-muted-foreground border-transparent hover:border-muted-foreground/30'
                            } ${readOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            {option.icon}
                            <span className="text-sm">{option.label}</span>
                          </button>
                        ))}
                        {savingId === item?.id && (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="space-y-6 pt-4 pl-12">
                      {/* Description */}
                      <div className="text-sm text-muted-foreground mb-4">
                        {category.description}
                      </div>

                      {/* Description/Notes */}
                      <div className="space-y-2">
                        <Label className="font-medium">รายละเอียด/หมายเหตุ</Label>
                        <Textarea
                          placeholder="อธิบายรายละเอียดเพิ่มเติม..."
                          value={item?.description || ''}
                          onChange={(e) => handleDescriptionChange(category.id, e.target.value)}
                          disabled={readOnly}
                          className="min-h-[100px]"
                        />
                      </div>

                      {/* File Upload - Only show when status is 'pass' (มี) */}
                      {showFileUpload && (
                        <div className="space-y-2">
                          <Label className="font-medium">แนบหลักฐาน</Label>
                          {item && (
                            <FileUpload
                              assessmentId={assessmentId}
                              assessmentItemId={item.id}
                              readOnly={readOnly}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}