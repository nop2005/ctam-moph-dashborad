import { useState, useCallback, useRef, useEffect } from 'react';
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
  onAllFilesAttached?: (allAttached: boolean) => void;
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

// Sub-options when "มี (Yes)" is selected
const subOptions = [
  { value: 'private', label: 'เอกชน' },
  { value: 'opensource', label: 'Open Source/Freeware' },
  { value: 'mixed', label: 'ใช้รวมกัน Open Source+เอกชน' },
  { value: 'other', label: 'อื่นๆ' },
];

export function QuantitativeSection({
  assessmentId,
  categories,
  items,
  onItemsChange,
  onAllFilesAttached,
  readOnly,
}: QuantitativeSectionProps) {
  const { toast } = useToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [localDescriptions, setLocalDescriptions] = useState<Record<string, string>>({});
  const [subOptionSelections, setSubOptionSelections] = useState<Record<string, string>>({});
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
  const [fileCountsLoaded, setFileCountsLoaded] = useState(false);
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  // Load file counts from database on mount (before FileUpload components render)
  useEffect(() => {
    const loadFileCounts = async () => {
      if (items.length === 0) {
        setFileCountsLoaded(true);
        return;
      }
      
      try {
        const itemIds = items.map(item => item.id);
        const { data, error } = await supabase
          .from('evidence_files')
          .select('assessment_item_id')
          .in('assessment_item_id', itemIds);
        
        if (error) throw error;
        
        // Count files per item
        const counts: Record<string, number> = {};
        itemIds.forEach(id => { counts[id] = 0; });
        data?.forEach(file => {
          counts[file.assessment_item_id] = (counts[file.assessment_item_id] || 0) + 1;
        });
        
        setFileCounts(counts);
      } catch (error) {
        console.error('Error loading file counts:', error);
      } finally {
        setFileCountsLoaded(true);
      }
    };
    
    loadFileCounts();
  }, [items]);

  // Initialize local descriptions and sub-option selections from items
  useEffect(() => {
    const descriptions: Record<string, string> = {};
    const selections: Record<string, string> = {};
    items.forEach(item => {
      descriptions[item.category_id] = item.description || '';
      // Parse sub-option from description if exists (format: "[sub_option]rest of description")
      if (item.description) {
        const match = item.description.match(/^\[(\w+)\]/);
        if (match) {
          selections[item.category_id] = match[1];
        }
      }
    });
    setLocalDescriptions(descriptions);
    setSubOptionSelections(selections);
  }, [items]);

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

  const saveDescription = useCallback(async (categoryId: string, description: string) => {
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
  }, [items, onItemsChange, toast]);

  const handleDescriptionChange = useCallback((categoryId: string, description: string) => {
    // Update local state immediately for responsive UI
    setLocalDescriptions(prev => ({ ...prev, [categoryId]: description }));

    // Clear existing timer
    if (debounceTimers.current[categoryId]) {
      clearTimeout(debounceTimers.current[categoryId]);
    }

    // Set new debounce timer (save after 800ms of no typing)
    debounceTimers.current[categoryId] = setTimeout(() => {
      saveDescription(categoryId, description);
    }, 800);
  }, [saveDescription]);

  const handleSubOptionChange = useCallback(async (categoryId: string, subOption: string) => {
    setSubOptionSelections(prev => ({ ...prev, [categoryId]: subOption }));

    const item = getItemForCategory(categoryId);
    if (!item) return;

    try {
      // Get current description without the sub-option prefix
      const currentDesc = localDescriptions[categoryId] || '';
      const cleanDesc = currentDesc.replace(/^\[\w+\]\s*/, '');
      const newDescription = `[${subOption}] ${cleanDesc}`.trim();

      const { error } = await supabase
        .from('assessment_items')
        .update({ description: newDescription })
        .eq('id', item.id);

      if (error) throw error;

      setLocalDescriptions(prev => ({ ...prev, [categoryId]: newDescription }));
      onItemsChange(
        items.map(i => i.id === item.id ? { ...i, description: newDescription } : i)
      );
    } catch (error: any) {
      console.error('Error updating sub-option:', error);
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  }, [items, onItemsChange, toast, localDescriptions]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  // Check if a category requires sub-option but hasn't selected one
  const isSubOptionRequired = (categoryId: string): boolean => {
    const item = getItemForCategory(categoryId);
    return item?.status === 'pass' && !subOptionSelections[categoryId];
  };

  // Check if a category requires file but hasn't attached one
  const isFileRequired = (categoryId: string): boolean => {
    const item = getItemForCategory(categoryId);
    if (!item || item.status !== 'pass') return false;
    const fileCount = fileCounts[item.id] || 0;
    return fileCount === 0;
  };

  // Handle file count change from FileUpload component
  const handleFileCountChange = useCallback((itemId: string, count: number) => {
    setFileCounts(prev => ({ ...prev, [itemId]: count }));
  }, []);

  // Check if all pass items have at least one file attached
  useEffect(() => {
    const passItems = items.filter(item => item.status === 'pass');
    const allHaveFiles = passItems.every(item => (fileCounts[item.id] || 0) > 0);
    onAllFilesAttached?.(allHaveFiles);
  }, [items, fileCounts, onAllFilesAttached]);

  // Check if a category is complete (has sub-option selected AND has file attached)
  const isCategoryComplete = (categoryId: string): boolean => {
    const item = getItemForCategory(categoryId);
    if (!item) return true; // No item = can proceed
    if (item.status !== 'pass') return true; // Not pass = no requirements
    
    // Must have sub-option selected AND at least one file
    const hasSubOption = !!subOptionSelections[categoryId];
    const hasFile = (fileCounts[item.id] || 0) > 0;
    return hasSubOption && hasFile;
  };

  // Check if user can interact with a specific category (all previous items with 'pass' must be complete)
  const canInteractWithCategory = (categoryIndex: number): boolean => {
    // Wait for file counts to load before blocking
    if (!fileCountsLoaded) return true;
    
    for (let i = 0; i < categoryIndex; i++) {
      const prevCategory = categories[i];
      if (!isCategoryComplete(prevCategory.id)) {
        return false;
      }
    }
    return true;
  };

  // Get the first incomplete category index (needs sub-option selection OR file upload)
  const getFirstIncompleteIndex = (): number => {
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      if (!isCategoryComplete(category.id)) {
        return i;
      }
    }
    return -1; // All complete
  };

  // Get reason why category is incomplete
  const getIncompleteReason = (categoryId: string): string => {
    const item = getItemForCategory(categoryId);
    if (!item || item.status !== 'pass') return '';
    
    const hasSubOption = !!subOptionSelections[categoryId];
    const hasFile = (fileCounts[item.id] || 0) > 0;
    
    if (!hasSubOption && !hasFile) {
      return 'กรุณาเลือกประเภทระบบ/เครื่องมือ และแนบหลักฐาน';
    } else if (!hasSubOption) {
      return 'กรุณาเลือกประเภทระบบ/เครื่องมือ';
    } else if (!hasFile) {
      return 'กรุณาแนบหลักฐานอย่างน้อย 1 ไฟล์';
    }
    return '';
  };

  // Count items missing files
  const getMissingFilesCount = (): number => {
    return items.filter(item => item.status === 'pass' && (fileCounts[item.id] || 0) === 0).length;
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
                        {(() => {
                          const canInteract = canInteractWithCategory(index);
                          const firstIncompleteIdx = getFirstIncompleteIndex();
                          const isBlocked = !canInteract;
                          
                          return statusOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isBlocked) {
                                  const blockedCategory = categories[firstIncompleteIdx];
                                  const reason = getIncompleteReason(blockedCategory.id);
                                  toast({
                                    title: 'กรุณาทำข้อก่อนหน้าให้ครบก่อน',
                                    description: `ข้อ ${blockedCategory.order_number} (${blockedCategory.name_th}): ${reason}`,
                                    variant: 'destructive'
                                  });
                                  // Expand the incomplete item
                                  if (!expandedItems.includes(blockedCategory.id)) {
                                    setExpandedItems(prev => [...prev, blockedCategory.id]);
                                  }
                                  return;
                                }
                                if (!readOnly && savingId !== item?.id) {
                                  handleStatusChange(category.id, option.value);
                                }
                              }}
                              disabled={readOnly || savingId === item?.id}
                              className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-all ${
                                item?.status === option.value 
                                  ? `${option.color} border-current bg-background font-medium` 
                                  : 'text-muted-foreground border-transparent hover:border-muted-foreground/30'
                              } ${readOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${isBlocked ? 'opacity-50' : ''}`}
                            >
                              {option.icon}
                              <span className="text-sm">{option.label}</span>
                            </button>
                          ));
                        })()}
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

                      {/* Sub-options - Only show when status is 'pass' (มี) - Required */}
                      {showFileUpload && (
                        <div className="space-y-2">
                          <Label className="font-medium">
                            ประเภทของระบบ/เครื่องมือที่ใช้ <span className="text-destructive">*</span>
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {subOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => !readOnly && handleSubOptionChange(category.id, option.value)}
                                disabled={readOnly}
                                className={`px-4 py-2 rounded-lg border-2 transition-all text-sm ${
                                  subOptionSelections[category.id] === option.value
                                    ? 'border-primary bg-primary/10 text-primary font-medium'
                                    : 'border-muted hover:border-muted-foreground/50 text-muted-foreground'
                                } ${readOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                          {!subOptionSelections[category.id] && !readOnly && (
                            <p className="text-sm text-destructive">กรุณาเลือกตัวเลือกข้อใดข้อหนึ่ง</p>
                          )}
                        </div>
                      )}

                      {/* Description/Notes */}
                      <div className="space-y-2">
                        <Label className="font-medium">รายละเอียด/หมายเหตุ</Label>
                        <Textarea
                          placeholder="อธิบายรายละเอียดเพิ่มเติม..."
                          value={localDescriptions[category.id] ?? item?.description ?? ''}
                          onChange={(e) => handleDescriptionChange(category.id, e.target.value)}
                          disabled={readOnly}
                          className="min-h-[100px]"
                        />
                      </div>

                      {/* File Upload - Only show when status is 'pass' (มี) - Required */}
                      {showFileUpload && (
                        <div className="space-y-2">
                          <Label className="font-medium">
                            แนบหลักฐาน <span className="text-destructive">*</span>
                          </Label>
                          {item && (
                            <>
                              <FileUpload
                                assessmentId={assessmentId}
                                assessmentItemId={item.id}
                                readOnly={readOnly}
                                disabled={!subOptionSelections[category.id]}
                                onFileCountChange={(count) => handleFileCountChange(item.id, count)}
                              />
                              {isFileRequired(category.id) && !readOnly && (
                                <p className="text-sm text-destructive">กรุณาแนบไฟล์หลักฐานอย่างน้อย 1 ไฟล์</p>
                              )}
                            </>
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