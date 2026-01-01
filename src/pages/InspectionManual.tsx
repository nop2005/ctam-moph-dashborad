import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, FileText, Download, ExternalLink } from 'lucide-react';

interface ManualDocument {
  id: string;
  title: string;
  description: string;
  fileUrl?: string;
  externalUrl?: string;
}

const documents: ManualDocument[] = [
  {
    id: '1',
    title: 'คู่มือการประเมิน CTAM+ ฉบับสมบูรณ์',
    description: 'เอกสารอธิบายเกณฑ์การประเมินทั้งหมดรวมถึงวิธีการให้คะแนน',
  },
  {
    id: '2',
    title: 'แบบฟอร์มการนิเทศ',
    description: 'แบบฟอร์มสำหรับบันทึกผลการนิเทศหน่วยงาน',
  },
  {
    id: '3',
    title: 'เอกสารประกอบการบรรยาย',
    description: 'สไลด์และเอกสารประกอบการอบรมสำหรับผู้นิเทศ',
  },
  {
    id: '4',
    title: 'คู่มือการใช้งานระบบ CTAM+',
    description: 'คู่มือการใช้งานระบบสำหรับผู้ใช้งานทุกระดับ',
  },
  {
    id: '5',
    title: 'เกณฑ์การประเมินเชิงคุณภาพ',
    description: 'รายละเอียดเกณฑ์และวิธีการให้คะแนนด้านเชิงคุณภาพ',
  },
  {
    id: '6',
    title: 'เกณฑ์การประเมินเชิงผลกระทบ',
    description: 'รายละเอียดเกณฑ์และวิธีการให้คะแนนด้านเชิงผลกระทบ',
  },
];

export default function InspectionManual() {
  const handleDownload = (doc: ManualDocument) => {
    if (doc.fileUrl) {
      window.open(doc.fileUrl, '_blank');
    } else if (doc.externalUrl) {
      window.open(doc.externalUrl, '_blank');
    } else {
      // Placeholder - no file available yet
      alert('ไฟล์ยังไม่พร้อมให้ดาวน์โหลด');
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">คู่มือเอกสารสำหรับการนิเทศ</h1>
        <p className="text-muted-foreground">เอกสารและคู่มือสำหรับการตรวจราชการและการนิเทศ</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            รายการเอกสาร
          </CardTitle>
          <CardDescription>
            ดาวน์โหลดเอกสารและคู่มือที่จำเป็นสำหรับการนิเทศ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <Card key={doc.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base line-clamp-2">{doc.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-sm text-muted-foreground mb-4 flex-1">{doc.description}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => handleDownload(doc)}
                  >
                    {doc.externalUrl ? (
                      <>
                        <ExternalLink className="h-4 w-4" />
                        เปิดดู
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        ดาวน์โหลด
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
