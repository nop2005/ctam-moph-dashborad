import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

// Number of CTAM categories (17 categories)
const CTAM_CATEGORY_COUNT = 17;

interface MatchResult {
  unit_name: string;
  matched_to: string | null;
  matched_id: string | null;
  matched_type: "hospital" | "health_office" | null;
  similarity: number;
  status: "exact" | "fuzzy" | "unmatched";
}

interface ImportRow {
  unit_name: string;
  province: string;
  budgets: Record<string, number>;
}

interface PreviewResponse {
  success: boolean;
  mode: "preview";
  summary: {
    total: number;
    exact: number;
    fuzzy: number;
    unmatched: number;
  };
  matches: MatchResult[];
}

interface ImportResponse {
  success: boolean;
  mode: "import";
  imported: number;
  failed: number;
  errors: { unit_name: string; error: string }[];
  matches: MatchResult[];
}

interface BudgetImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const getCurrentFiscalYear = () => {
  const now = new Date();
  const thaiYear = now.getFullYear() + 543;
  return now.getMonth() >= 9 ? thaiYear + 1 : thaiYear;
};

export function BudgetImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: BudgetImportDialogProps) {
  const [fiscalYear, setFiscalYear] = useState(getCurrentFiscalYear());
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ImportRow[]>([]);
  const [previewResult, setPreviewResult] = useState<PreviewResponse | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fiscalYears = Array.from({ length: 9 }, (_, i) => getCurrentFiscalYear() - 4 + i);

  // Parse Excel file
  const parseExcel = (file: File): Promise<ImportRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as unknown[][];

          // Skip header row, parse data
          const rows: ImportRow[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as (string | number)[];
            if (!row[0]) continue; // Skip empty rows

            const unitName = String(row[0] || "").trim();
            const province = String(row[1] || "").trim();

            // Parse 17 category budgets (columns 3-19) - use order number as key (1-17)
            const budgets: Record<string, number> = {};
            for (let j = 0; j < CTAM_CATEGORY_COUNT; j++) {
              const value = row[j + 2];
              // Use order number (1-indexed) as the key
              budgets[(j + 1).toString()] = typeof value === "number" ? value : (parseFloat(String(value)) || 0);
            }

            rows.push({ unit_name: unitName, province, budgets });
          }

          resolve(rows);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  };

  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    try {
      const data = await parseExcel(selectedFile);
      setParsedData(data);
      toast.success(`พบข้อมูล ${data.length} รายการ`);
    } catch (error) {
      console.error("Error parsing Excel:", error);
      toast.error("ไม่สามารถอ่านไฟล์ Excel ได้");
      setFile(null);
      setParsedData([]);
    }
  };

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("import-budget", {
        body: {
          fiscal_year: fiscalYear,
          data: parsedData,
          mode: "preview",
        },
      });

      if (response.error) throw response.error;
      return response.data as PreviewResponse;
    },
    onSuccess: (data) => {
      setPreviewResult(data);
      setStep("preview");
    },
    onError: (error) => {
      console.error("Preview error:", error);
      toast.error("ไม่สามารถตรวจสอบข้อมูลได้");
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("import-budget", {
        body: {
          fiscal_year: fiscalYear,
          data: parsedData,
          mode: "import",
        },
      });

      if (response.error) throw response.error;
      return response.data as ImportResponse;
    },
    onSuccess: (data) => {
      setImportResult(data);
      setStep("result");
      if (data.imported > 0) {
        toast.success(`นำเข้าข้อมูลสำเร็จ ${data.imported} รายการ`);
        onSuccess?.();
      }
    },
    onError: (error) => {
      console.error("Import error:", error);
      toast.error("ไม่สามารถนำเข้าข้อมูลได้");
    },
  });

  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    setPreviewResult(null);
    setImportResult(null);
    setStep("upload");
    onOpenChange(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "exact":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "fuzzy":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "unmatched":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "exact":
        return <Badge variant="default" className="bg-green-600">ตรงกัน</Badge>;
      case "fuzzy":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">ใกล้เคียง</Badge>;
      case "unmatched":
        return <Badge variant="destructive">ไม่พบ</Badge>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            นำเข้าข้อมูลงบประมาณจาก Excel
          </DialogTitle>
          <DialogDescription>
            อัพโหลดไฟล์ Excel ที่มีข้อมูลงบประมาณตามหมวดหมู่ CTAM 17 ข้อ
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6 py-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>ปีงบประมาณ</Label>
                <Select
                  value={fiscalYear.toString()}
                  onValueChange={(v) => setFiscalYear(Number(v))}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fiscalYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        ปีงบประมาณ พ.ศ. {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>ไฟล์ Excel</Label>
                <div className="flex items-center gap-4">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-24 border-dashed flex flex-col gap-2"
                  >
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span>คลิกเพื่อเลือกไฟล์ Excel</span>
                  </Button>
                </div>
                {file && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>{file.name}</span>
                    <span className="text-primary">({parsedData.length} รายการ)</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFile(null);
                        setParsedData([]);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {parsedData.length > 0 && (
              <Alert>
                <AlertDescription>
                  พบข้อมูล <strong>{parsedData.length}</strong> หน่วยงาน
                  พร้อมงบประมาณ 17 หมวดหมู่ CTAM
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {step === "preview" && previewResult && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted text-center">
                <div className="text-2xl font-bold">{previewResult.summary.total}</div>
                <div className="text-sm text-muted-foreground">ทั้งหมด</div>
              </div>
              <div className="p-4 rounded-lg bg-green-50 text-center">
                <div className="text-2xl font-bold text-green-700">
                  {previewResult.summary.exact}
                </div>
                <div className="text-sm text-green-600">ตรงกัน</div>
              </div>
              <div className="p-4 rounded-lg bg-yellow-50 text-center">
                <div className="text-2xl font-bold text-yellow-700">
                  {previewResult.summary.fuzzy}
                </div>
                <div className="text-sm text-yellow-600">ใกล้เคียง</div>
              </div>
              <div className="p-4 rounded-lg bg-red-50 text-center">
                <div className="text-2xl font-bold text-red-700">
                  {previewResult.summary.unmatched}
                </div>
                <div className="text-sm text-red-600">ไม่พบ</div>
              </div>
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>ชื่อจาก Excel</TableHead>
                    <TableHead>จับคู่กับ</TableHead>
                    <TableHead className="w-24 text-center">ความใกล้เคียง</TableHead>
                    <TableHead className="w-24 text-center">สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewResult.matches.map((match, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>{match.unit_name}</TableCell>
                      <TableCell>
                        {match.matched_to || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {match.similarity > 0 ? `${match.similarity}%` : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(match.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {previewResult.summary.unmatched > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  มี {previewResult.summary.unmatched} หน่วยงานที่ไม่สามารถจับคู่ได้
                  ข้อมูลเหล่านี้จะไม่ถูกนำเข้า
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {step === "result" && importResult && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-lg bg-green-50 text-center">
                <div className="text-4xl font-bold text-green-700">
                  {importResult.imported}
                </div>
                <div className="text-sm text-green-600 mt-1">
                  นำเข้าสำเร็จ
                </div>
              </div>
              <div className="p-6 rounded-lg bg-red-50 text-center">
                <div className="text-4xl font-bold text-red-700">
                  {importResult.failed}
                </div>
                <div className="text-sm text-red-600 mt-1">ไม่สำเร็จ</div>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <ScrollArea className="h-48 border rounded-lg p-4">
                <div className="space-y-2">
                  {importResult.errors.map((err, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm text-red-600"
                    >
                      <AlertCircle className="h-4 w-4" />
                      <span>{err.unit_name}: {err.error}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                การนำเข้าข้อมูลเสร็จสิ้น สามารถดูข้อมูลในรายงานงบประมาณได้แล้ว
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                ยกเลิก
              </Button>
              <Button
                onClick={() => previewMutation.mutate()}
                disabled={parsedData.length === 0 || previewMutation.isPending}
              >
                {previewMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    กำลังตรวจสอบ...
                  </>
                ) : (
                  "ตรวจสอบข้อมูล"
                )}
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                ย้อนกลับ
              </Button>
              <Button
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    กำลังนำเข้า...
                  </>
                ) : (
                  `นำเข้าข้อมูล (${(previewResult?.summary.exact || 0) + (previewResult?.summary.fuzzy || 0)} รายการ)`
                )}
              </Button>
            </>
          )}

          {step === "result" && (
            <Button onClick={handleClose}>ปิด</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
