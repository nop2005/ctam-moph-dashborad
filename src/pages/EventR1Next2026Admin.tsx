import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Users, Download, Search, Mail, MailCheck, Loader2, IdCard } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { EventBadgePrint } from "@/components/event/EventBadgePrint";

const DIETARY_LABEL: Record<string, string> = {
  normal: "อาหารทั่วไป",
  vegetarian: "มังสวิรัติ",
  vegan: "เจ/วีแกน",
  halal: "ฮาลาล",
  allergy: "แพ้อาหาร",
};

export default function EventR1Next2026Admin() {
  const [search, setSearch] = useState("");
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [badgeOpen, setBadgeOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["event-registrations", "r1next2026"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("*")
        .eq("event_code", "r1next2026")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (dayFilter === "day1") rows = rows.filter((r) => r.attend_day1);
    else if (dayFilter === "day2") rows = rows.filter((r) => r.attend_day2);
    else if (dayFilter === "both") rows = rows.filter((r) => r.attend_day1 && r.attend_day2);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.full_name?.toLowerCase().includes(q) ||
          r.organization?.toLowerCase().includes(q) ||
          r.province?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.registration_no?.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [data, search, dayFilter]);

  const stats = useMemo(() => {
    const rows = data ?? [];
    return {
      total: rows.length,
      day1: rows.filter((r) => r.attend_day1).length,
      day2: rows.filter((r) => r.attend_day2).length,
      emailed: rows.filter((r) => r.email_sent_at).length,
    };
  }, [data]);

  function exportExcel() {
    const rows = (filtered ?? []).map((r, i) => ({
      "#": i + 1,
      "เลขที่": r.registration_no,
      "ชื่อ-นามสกุล": r.full_name,
      "ตำแหน่ง": r.position,
      "หน่วยงาน": r.organization,
      "จังหวัด": r.province,
      "อีเมล": r.email,
      "เบอร์โทร": r.phone,
      "Day 1": r.attend_day1 ? "✓" : "",
      "Day 2": r.attend_day2 ? "✓" : "",
      "อาหาร": DIETARY_LABEL[r.dietary] ?? r.dietary,
      "หมายเหตุอาหาร": r.dietary_note ?? "",
      "หมายเหตุ": r.notes ?? "",
      "ส่งอีเมลแล้ว": r.email_sent_at ? new Date(r.email_sent_at).toLocaleString("th-TH") : "-",
      "ลงทะเบียนเมื่อ": new Date(r.created_at).toLocaleString("th-TH"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registrations");
    XLSX.writeFile(wb, `R1Forum2026-Registrations-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function resendEmail(id: string) {
    try {
      const { error } = await supabase.functions.invoke("send-event-registration-email", {
        body: { registration_id: id },
      });
      if (error) throw error;
      toast({ title: "ส่งอีเมลอีกครั้งสำเร็จ" });
      refetch();
    } catch (e) {
      toast({
        title: "ส่งอีเมลไม่สำเร็จ",
        description: e instanceof Error ? e.message : "โปรดลองอีกครั้ง",
        variant: "destructive",
      });
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            ผู้ลงทะเบียน — R1 Digital Health Forum 2026
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            รายชื่อผู้ลงทะเบียนเข้าร่วมงาน จัดการและส่งออกข้อมูล
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "รวมทั้งหมด", value: stats.total, color: "from-cyan-500 to-blue-500" },
            { label: "Day 1", value: stats.day1, color: "from-cyan-500 to-teal-500" },
            { label: "Day 2", value: stats.day2, color: "from-violet-500 to-purple-500" },
            { label: "ส่งอีเมลแล้ว", value: stats.emailed, color: "from-emerald-500 to-green-500" },
          ].map((s) => (
            <Card key={s.label} className="overflow-hidden">
              <div className={`h-1 bg-gradient-to-r ${s.color}`} />
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-3xl font-bold mt-1">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
              <CardTitle className="text-base">รายชื่อผู้ลงทะเบียน ({filtered.length})</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาชื่อ/หน่วยงาน/อีเมล/เลขที่"
                    className="pl-9 w-72"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={dayFilter} onValueChange={setDayFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกวัน</SelectItem>
                    <SelectItem value="day1">เข้า Day 1</SelectItem>
                    <SelectItem value="day2">เข้า Day 2</SelectItem>
                    <SelectItem value="both">เข้าทั้ง 2 วัน</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => setBadgeOpen(true)}
                  variant="outline"
                  disabled={!filtered.length}
                >
                  <IdCard className="h-4 w-4 mr-1" />
                  พิมพ์ป้ายคล้องคอ {selected.size > 0 ? `(${selected.size})` : `(ทั้งหมด ${filtered.length})`}
                </Button>
                <Button onClick={exportExcel} variant="outline" disabled={!filtered.length}>
                  <Download className="h-4 w-4 mr-1" /> Export Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                กำลังโหลด...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                ยังไม่มีผู้ลงทะเบียน
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox
                          checked={filtered.length > 0 && filtered.every((r) => selected.has(r.id))}
                          onCheckedChange={(v) => {
                            if (v) setSelected(new Set(filtered.map((r) => r.id)));
                            else setSelected(new Set());
                          }}
                        />
                      </TableHead>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>เลขที่</TableHead>
                      <TableHead>ชื่อ-นามสกุล</TableHead>
                      <TableHead>หน่วยงาน</TableHead>
                      <TableHead>จังหวัด</TableHead>
                      <TableHead>วัน</TableHead>
                      <TableHead>อาหาร</TableHead>
                      <TableHead>ติดต่อ</TableHead>
                      <TableHead>อีเมล</TableHead>
                      <TableHead className="text-right">การจัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r, i) => (
                      <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(r.id)}
                            onCheckedChange={(v) => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (v) next.add(r.id);
                                else next.delete(r.id);
                                return next;
                              });
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{r.registration_no}</TableCell>
                        <TableCell>
                          <div className="font-medium">{r.full_name}</div>
                          <div className="text-xs text-muted-foreground">{r.position}</div>
                        </TableCell>
                        <TableCell className="text-sm">{r.organization}</TableCell>
                        <TableCell className="text-sm">{r.province}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {r.attend_day1 && <Badge variant="secondary" className="text-xs">D1</Badge>}
                            {r.attend_day2 && <Badge variant="secondary" className="text-xs">D2</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {DIETARY_LABEL[r.dietary] ?? r.dietary}
                          {r.dietary_note && (
                            <div className="text-muted-foreground">({r.dietary_note})</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>{r.email}</div>
                          <div className="text-muted-foreground">{r.phone}</div>
                        </TableCell>
                        <TableCell>
                          {r.email_sent_at ? (
                            <Badge variant="outline" className="text-emerald-700 border-emerald-300 gap-1">
                              <MailCheck className="h-3 w-3" /> ส่งแล้ว
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 border-amber-300">
                              ยังไม่ส่ง
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => resendEmail(r.id)}>
                            <Mail className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
