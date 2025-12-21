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
import { FileUpload } from './FileUpload';
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
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

const statusOptions: { value: ItemStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'pass', label: 'ผ่าน (Yes)', icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-success' },
  { value: 'partial', label: 'บางส่วน (Partial)', icon: <AlertCircle className="w-4 h-4" />, color: 'text-warning' },
  { value: 'fail', label: 'ไม่ผ่าน (No)', icon: <XCircle className="w-4 h-4" />, color: 'text-destructive' },
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

  const getItemForCategory = (categoryId: string) => {
    return items.find(item => item.category_id === categoryId);
  };

  const calculateProgress = () => {
    const passCount = items.filter(i => i.status === 'pass').length;
    const partialCount = items.filter(i => i.status === 'partial').length;
    const total = categories.length;
    return {
      pass: passCount,
      partial: partialCount,
      fail: total - passCount - partialCount,
      percentage: total > 0 ? ((passCount + partialCount * 0.5) / total) * 100 : 0,
    };
  };

  const handleStatusChange = async (categoryId: string, newStatus: ItemStatus) => {
    const item = getItemForCategory(categoryId);
    if (!item) return;

    try {
      setSavingId(item.id);
      
      const score = newStatus === 'pass' ? 1 : newStatus === 'partial' ? 0.5 : 0;
      
      const { error } = await supabase
        .from('assessment_items')
        .update({ status: newStatus, score })
        .eq('id', item.id);

      if (error) throw error;

      onItemsChange(
        items.map(i => i.id === item.id ? { ...i, status: newStatus, score } : i)
      );

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

  return (
    <div className="space-y-6">
      {/* Progress Summary */}
      <Card>
        <CardHeader>
          <CardTitle>เชิงปริมาณ (Quantitative) 70%</CardTitle>
          <CardDescription>
            ประเมินตามมาตรฐาน CTAM+ 17 หมวด
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={progress.percentage} className="h-3" />
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>ผ่าน: {progress.pass}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-warning" />
                  <span>บางส่วน: {progress.partial}</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-destructive" />
                  <span>ไม่ผ่าน: {progress.fail}</span>
                </div>
              </div>
              <span className="font-medium">{progress.percentage.toFixed(1)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardContent className="p-0">
          <Accordion type="multiple" className="w-full">
            {categories.map((category, index) => {
              const item = getItemForCategory(category.id);
              const statusOption = statusOptions.find(s => s.value === item?.status);
              
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
                      {item && (
                        <Badge 
                          variant="outline" 
                          className={`${statusOption?.color} border-current`}
                        >
                          {statusOption?.icon}
                          <span className="ml-1">{statusOption?.label}</span>
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="space-y-6 pt-4 pl-12">
                      {/* Description */}
                      <div className="text-sm text-muted-foreground mb-4">
                        {category.description}
                      </div>

                      {/* Status Selection */}
                      <div className="space-y-3">
                        <Label className="font-medium">สถานะการประเมิน</Label>
                        <RadioGroup
                          value={item?.status || 'fail'}
                          onValueChange={(value) => handleStatusChange(category.id, value as ItemStatus)}
                          disabled={readOnly || savingId === item?.id}
                          className="flex flex-wrap gap-4"
                        >
                          {statusOptions.map((option) => (
                            <div key={option.value} className="flex items-center space-x-2">
                              <RadioGroupItem value={option.value} id={`${category.id}-${option.value}`} />
                              <Label 
                                htmlFor={`${category.id}-${option.value}`}
                                className={`flex items-center gap-2 cursor-pointer ${option.color}`}
                              >
                                {option.icon}
                                {option.label}
                              </Label>
                            </div>
                          ))}
                          {savingId === item?.id && (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          )}
                        </RadioGroup>
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

                      {/* File Upload */}
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