import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";
import { EVENT_INFO } from "@/data/eventContent";

export interface BadgeAttendee {
  id: string;
  registration_no: string;
  full_name: string;
  position?: string | null;
  organization: string;
  province?: string | null;
  attend_day1?: boolean;
  attend_day2?: boolean;
}

const SPONSORS = ["KBTG", "AWS", "สกมช.", "สปสช.", "เขตสุขภาพที่ 1"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  attendees: BadgeAttendee[];
}

export function EventBadgePrint({ open, onOpenChange, attendees }: Props) {
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || attendees.length === 0) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const map: Record<string, string> = {};
      for (const a of attendees) {
        const payload = JSON.stringify({
          no: a.registration_no,
          name: a.full_name,
          org: a.organization,
          event: EVENT_INFO.code,
        });
        map[a.id] = await QRCode.toDataURL(payload, { margin: 1, width: 220 });
      }
      if (!cancelled) {
        setQrMap(map);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, attendees]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="print:hidden">
          <div className="flex items-center justify-between">
            <DialogTitle>ตัวอย่างป้ายคล้องคอ ({attendees.length} ใบ)</DialogTitle>
            <Button onClick={() => window.print()} disabled={loading || attendees.length === 0}>
              <Printer className="h-4 w-4 mr-1" /> พิมพ์
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            แนะนำ: พิมพ์บนกระดาษ A4 (2 ใบ/แผ่น) แล้วตัดตามรอย ใส่ซองพลาสติกคล้องคอ 10×14 ซม.
          </p>
        </DialogHeader>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            กำลังสร้าง QR Code...
          </div>
        ) : (
          <div className="badge-print-area">
            {attendees.map((a) => (
              <div key={a.id} className="badge-card">
                <div className="badge-header">
                  <div className="badge-event-title">R1 Digital Health Forum 2026</div>
                  <div className="badge-event-sub">{EVENT_INFO.dateText}</div>
                  <div className="badge-event-sub">{EVENT_INFO.venueShort}</div>
                </div>

                <div className="badge-name">{a.full_name}</div>
                {a.position && <div className="badge-position">{a.position}</div>}
                <div className="badge-org">{a.organization}</div>
                {a.province && <div className="badge-province">จ.{a.province}</div>}

                <div className="badge-qr-row">
                  {qrMap[a.id] && (
                    <img src={qrMap[a.id]} alt="QR" className="badge-qr" />
                  )}
                  <div className="badge-qr-meta">
                    <div className="badge-regno">{a.registration_no}</div>
                    <div className="badge-days">
                      {a.attend_day1 && <span>DAY 1</span>}
                      {a.attend_day2 && <span>DAY 2</span>}
                    </div>
                  </div>
                </div>

                <div className="badge-sponsors">
                  <div className="badge-sponsors-label">ผู้สนับสนุน</div>
                  <div className="badge-sponsors-list">{SPONSORS.join(" · ")}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <style>{`
          .badge-print-area {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8mm;
            padding: 4mm;
            background: #f3f4f6;
          }
          .badge-card {
            width: 100mm;
            height: 140mm;
            background: white;
            border: 1px dashed #94a3b8;
            padding: 6mm 6mm 4mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            text-align: center;
            font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
            color: #0f172a;
            page-break-inside: avoid;
          }
          .badge-header {
            border-bottom: 2px solid #0ea5e9;
            padding-bottom: 3mm;
            margin-bottom: 4mm;
          }
          .badge-event-title {
            font-weight: 800;
            font-size: 13pt;
            color: #0369a1;
            letter-spacing: 0.3px;
          }
          .badge-event-sub { font-size: 8pt; color: #475569; margin-top: 1mm; }
          .badge-name {
            font-size: 20pt;
            font-weight: 800;
            line-height: 1.1;
            margin-top: 2mm;
          }
          .badge-position { font-size: 10pt; color: #475569; margin-top: 1.5mm; }
          .badge-org { font-size: 11pt; font-weight: 600; margin-top: 3mm; color: #0f172a; }
          .badge-province { font-size: 9pt; color: #64748b; margin-top: 1mm; }
          .badge-qr-row {
            display: flex; align-items: center; justify-content: center;
            gap: 4mm; margin-top: auto; padding-top: 4mm;
          }
          .badge-qr { width: 28mm; height: 28mm; }
          .badge-qr-meta { text-align: left; }
          .badge-regno {
            font-family: 'JetBrains Mono', monospace;
            font-size: 12pt; font-weight: 700; color: #0369a1;
          }
          .badge-days { display: flex; gap: 4px; margin-top: 2mm; }
          .badge-days span {
            font-size: 8pt; font-weight: 700;
            background: #0ea5e9; color: white;
            padding: 1px 6px; border-radius: 3px;
          }
          .badge-sponsors {
            border-top: 1px solid #e2e8f0;
            margin-top: 3mm; padding-top: 2mm;
          }
          .badge-sponsors-label { font-size: 7pt; color: #94a3b8; }
          .badge-sponsors-list { font-size: 8pt; font-weight: 600; color: #334155; margin-top: 1mm; }

          @media print {
            @page { size: A4; margin: 6mm; }
            body * { visibility: hidden !important; }
            .badge-print-area, .badge-print-area * { visibility: visible !important; }
            .badge-print-area {
              position: absolute; left: 0; top: 0;
              background: white !important;
              padding: 0; gap: 4mm;
            }
            .badge-card { border: 1px dashed #cbd5e1; }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
