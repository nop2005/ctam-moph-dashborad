import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookOpen, Download, ExternalLink } from 'lucide-react';

interface ManualDocument {
  id: string;
  title: string;
  description: string;
  fileUrl?: string;
  externalUrl?: string;
  updatedAt: string;
}

const documents: ManualDocument[] = [
  {
    id: '1',
    title: 'คู่มือการประเมิน CTAM+ ฉบับสมบูรณ์',
    description: 'เอกสารอธิบายเกณฑ์การประเมินทั้งหมดรวมถึงวิธีการให้คะแนน',
    updatedAt: '2025-12-15',
  },
  {
    id: '2',
    title: 'แบบฟอร์มการนิเทศ',
    description: 'แบบฟอร์มสำหรับบันทึกผลการนิเทศหน่วยงาน',
    updatedAt: '2025-12-10',
  },
  {
    id: '3',
    title: 'เอกสารประกอบการบรรยาย',
    description: 'สไลด์และเอกสารประกอบการอบรมสำหรับผู้นิเทศ',
    updatedAt: '2025-12-08',
  },
  {
    id: '4',
    title: 'คู่มือการใช้งานระบบ CTAM+',
    description: 'คู่มือการใช้งานระบบสำหรับผู้ใช้งานทุกระดับ',
    updatedAt: '2025-12-05',
  },
  {
    id: '5',
    title: 'เกณฑ์การประเมินเชิงคุณภาพ',
    description: 'รายละเอียดเกณฑ์และวิธีการให้คะแนนด้านเชิงคุณภาพ',
    updatedAt: '2025-12-01',
  },
  {
    id: '6',
    title: 'เกณฑ์การประเมินเชิงผลกระทบ',
    description: 'รายละเอียดเกณฑ์และวิธีการให้คะแนนด้านเชิงผลกระทบ',
    updatedAt: '2025-11-28',
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อเอกสาร</TableHead>
                <TableHead>รายละเอียด</TableHead>
                <TableHead>วันที่อัปเดต</TableHead>
                <TableHead className="text-right">ดาวน์โหลด</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.title}</TableCell>
                  <TableCell className="text-muted-foreground">{doc.description}</TableCell>
                  <TableCell>{new Date(doc.updatedAt).toLocaleDateString('th-TH')}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
