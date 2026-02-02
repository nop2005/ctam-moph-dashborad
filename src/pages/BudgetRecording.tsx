import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save, CheckCircle2, Wallet } from "lucide-react";
import { toast } from "sonner";

// Get current Thai Buddhist year
const getCurrentFiscalYear = () => {
  const now = new Date();
  const thaiYear = now.getFullYear() + 543;
  // If after October, it's the next fiscal year
  return now.getMonth() >= 9 ? thaiYear + 1 : thaiYear;
};

// Generate fiscal year options (2567-2575)
const fiscalYearOptions = Array.from({ length: 9 }, (_, i) => 2567 + i);

interface CtamCategory {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  order_number: number;
}

interface BudgetRecord {
  id: string;
  category_id: string;
  budget_amount: number;
  fiscal_year: number;
}

export default function BudgetRecording() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [fiscalYear, setFiscalYear] = useState<number>(getCurrentFiscalYear());
  const [budgetAmounts, setBudgetAmounts] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch CTAM categories
  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["ctam-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ctam_categories")
        .select("id, code, name_th, name_en, order_number")
        .order("order_number");
      if (error) throw error;
      return data as CtamCategory[];
    },
  });

  // Fetch existing budget records for the selected fiscal year
  const { data: existingRecords = [], isLoading: loadingRecords, refetch: refetchRecords } = useQuery({
    queryKey: ["budget-records", fiscalYear, profile?.hospital_id, profile?.health_office_id],
    queryFn: async () => {
      if (!profile) return [];
      
      let query = supabase
        .from("budget_records")
        .select("id, category_id, budget_amount, fiscal_year")
        .eq("fiscal_year", fiscalYear);

      if (profile.hospital_id) {
        query = query.eq("hospital_id", profile.hospital_id);
      } else if (profile.health_office_id) {
        query = query.eq("health_office_id", profile.health_office_id);
      } else {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BudgetRecord[];
    },
    enabled: !!profile && (!!profile.hospital_id || !!profile.health_office_id),
  });

  // Initialize budget amounts from existing records
  useEffect(() => {
    const amounts: Record<string, string> = {};
    categories.forEach((cat) => {
      const existingRecord = existingRecords.find((r) => r.category_id === cat.id);
      amounts[cat.id] = existingRecord ? existingRecord.budget_amount.toString() : "";
    });
    setBudgetAmounts(amounts);
    setHasUnsavedChanges(false);
  }, [categories, existingRecords]);

  // Handle budget amount change
  const handleAmountChange = (categoryId: string, value: string) => {
    // Allow empty string or valid numbers
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      setBudgetAmounts((prev) => ({ ...prev, [categoryId]: value }));
      setHasUnsavedChanges(true);
    }
  };

  // Calculate total
  const totalBudget = useMemo(() => {
    return Object.values(budgetAmounts).reduce((sum, amount) => {
      const num = parseFloat(amount) || 0;
      return sum + num;
    }, 0);
  }, [budgetAmounts]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("ไม่พบข้อมูลผู้ใช้");

      const hospital_id = profile.hospital_id || null;
      const health_office_id = profile.health_office_id || null;

      if (!hospital_id && !health_office_id) {
        throw new Error("ไม่พบข้อมูลหน่วยงาน");
      }

      // Prepare upsert data
      const upsertData = categories.map((cat) => ({
        hospital_id,
        health_office_id,
        fiscal_year: fiscalYear,
        category_id: cat.id,
        budget_amount: parseFloat(budgetAmounts[cat.id]) || 0,
        created_by: profile.id,
      }));

      // Delete existing records for this year first, then insert new ones
      // This is a workaround since upsert with composite unique constraints can be tricky
      
      const deleteQuery = supabase
        .from("budget_records")
        .delete()
        .eq("fiscal_year", fiscalYear);

      if (hospital_id) {
        await deleteQuery.eq("hospital_id", hospital_id);
      } else if (health_office_id) {
        await deleteQuery.eq("health_office_id", health_office_id);
      }

      // Insert new records
      const { error } = await supabase.from("budget_records").insert(upsertData);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกงบประมาณสำเร็จ");
      setHasUnsavedChanges(false);
      refetchRecords();
    },
    onError: (error) => {
      console.error("Error saving budget:", error);
      toast.error("เกิดข้อผิดพลาดในการบันทึก");
    },
  });

  const handleSave = () => {
    setIsSaving(true);
    saveMutation.mutate(undefined, {
      onSettled: () => setIsSaving(false),
    });
  };

  // Format number with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const isLoading = loadingCategories || loadingRecords;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Wallet className="h-7 w-7 text-primary" />
              บันทึกงบประมาณประจำปี
            </h1>
            <p className="text-muted-foreground mt-1">
              บันทึกงบประมาณแยกตามหมวดหมู่ CTAM+ 17 ข้อ
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={fiscalYear.toString()} onValueChange={(v) => setFiscalYear(parseInt(v))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="เลือกปีงบประมาณ" />
              </SelectTrigger>
              <SelectContent>
                {fiscalYearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    ปีงบประมาณ พ.ศ. {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : hasUnsavedChanges ? (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  บันทึก
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  บันทึกแล้ว
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Budget Table Card */}
        <Card>
          <CardHeader>
            <CardTitle>รายการงบประมาณ ปีงบประมาณ พ.ศ. {fiscalYear}</CardTitle>
            <CardDescription>กรอกจำนวนเงินงบประมาณ (บาท) สำหรับแต่ละหมวดหมู่</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center">ลำดับ</TableHead>
                    <TableHead className="w-24">รหัส</TableHead>
                    <TableHead>หมวดหมู่</TableHead>
                    <TableHead className="w-56 text-right">งบประมาณ (บาท)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category, index) => (
                    <TableRow key={category.id}>
                      <TableCell className="text-center font-medium">{index + 1}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{category.code}</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{category.name_th}</span>
                          <span className="text-muted-foreground text-sm ml-2">({category.name_en})</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={budgetAmounts[category.id] || ""}
                          onChange={(e) => handleAmountChange(category.id, e.target.value)}
                          className="w-full text-right font-mono"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={3} className="text-right font-semibold text-lg">
                      รวมทั้งหมด
                    </TableCell>
                    <TableCell className="text-right font-bold text-lg font-mono text-primary">
                      {formatNumber(totalBudget)} บาท
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
