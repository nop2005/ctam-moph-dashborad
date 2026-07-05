import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain,
  Shield,
  Sparkles,
  Calendar,
  MapPin,
  Users,
  Building2,
  Clock,
  UtensilsCrossed,
  Mic,
  Presentation,
  Coffee,
  Award,
  Mail,
  Navigation,
} from "lucide-react";
import {
  EVENT_INFO,
  HIGHLIGHTS,
  AGENDA_DAY1,
  AGENDA_DAY2,
  SPEAKERS,
  type AgendaItem,
} from "@/data/eventContent";

function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, new Date(target).getTime() - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return { days, hours, minutes, seconds, done: diff === 0 };
}

const iconMap = { brain: Brain, shield: Shield, sparkles: Sparkles } as const;

function typeIcon(type?: AgendaItem["type"]) {
  switch (type) {
    case "break":
      return <Coffee className="h-4 w-4" />;
    case "ceremony":
      return <Award className="h-4 w-4" />;
    case "workshop":
      return <Presentation className="h-4 w-4" />;
    case "panel":
      return <Mic className="h-4 w-4" />;
    default:
      return <Sparkles className="h-4 w-4" />;
  }
}

function roomLabel(room?: AgendaItem["room"]) {
  if (!room) return null;
  if (room === "main") return <Badge variant="secondary">ห้องประชุมใหญ่</Badge>;
  if (room === "sub") return <Badge variant="outline">ห้องประชุมย่อย</Badge>;
  return <Badge className="bg-accent text-accent-foreground">ทั้ง 2 ห้อง</Badge>;
}

function AgendaList({ items }: { items: AgendaItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((it, i) => {
        const isBreak = it.type === "break";
        return (
          <div
            key={i}
            className={`flex gap-4 rounded-xl border p-4 transition-colors ${
              isBreak ? "bg-muted/40 border-dashed" : "bg-card hover:border-primary/40"
            }`}
          >
            <div className="flex-shrink-0 flex flex-col items-center gap-1 w-28 text-center">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{it.time}</span>
              <span className="text-xs text-muted-foreground">น.</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 flex-wrap">
                <span className={`mt-0.5 ${isBreak ? "text-muted-foreground" : "text-primary"}`}>
                  {typeIcon(it.type)}
                </span>
                <h3 className={`font-semibold ${isBreak ? "text-muted-foreground" : "text-foreground"}`}>
                  {it.title}
                </h3>
                {roomLabel(it.room)}
              </div>
              {it.detail && <p className="text-sm text-muted-foreground mt-1">{it.detail}</p>}
              {it.speaker && (
                <p className="text-sm mt-1.5 text-foreground/80">
                  <span className="text-xs uppercase tracking-wide text-primary font-medium">วิทยากร: </span>
                  {it.speaker}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function EventR1Next2026() {
  const navigate = useNavigate();
  const { days, hours, minutes, seconds, done } = useCountdown(EVENT_INFO.startDate);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <PublicLayout>
      <div className="space-y-16 pb-8">
        {/* HERO */}
        <section
          id="hero"
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/95 to-accent p-8 md:p-14 text-primary-foreground shadow-lg"
        >
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />

          <div className="relative z-10 max-w-4xl">
            <Badge className="bg-white/20 text-white border-0 backdrop-blur mb-4">
              R1 Digital Health Forum · ครั้งที่ 1
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight drop-shadow">
              {EVENT_INFO.name}
            </h1>
            <p className="text-lg md:text-2xl font-semibold mt-3 text-white/95">
              {EVENT_INFO.tagline}
            </p>
            <p className="text-base md:text-lg text-white/85 mt-2">{EVENT_INFO.taglineTh}</p>

            <div className="flex flex-wrap gap-4 mt-6 text-sm md:text-base">
              <div className="flex items-center gap-2 bg-white/15 rounded-full px-4 py-2 backdrop-blur">
                <Calendar className="h-4 w-4" />
                <span>{EVENT_INFO.dateText}</span>
              </div>
              <div className="flex items-center gap-2 bg-white/15 rounded-full px-4 py-2 backdrop-blur">
                <MapPin className="h-4 w-4" />
                <span>{EVENT_INFO.venueShort}</span>
              </div>
              <div className="flex items-center gap-2 bg-white/15 rounded-full px-4 py-2 backdrop-blur">
                <Users className="h-4 w-4" />
                <span>{EVENT_INFO.totalSeats} ที่นั่ง · {EVENT_INFO.totalHospitals} รพ.</span>
              </div>
            </div>

            {/* Countdown */}
            {!done && (
              <div className="mt-8 flex gap-3 md:gap-4 flex-wrap">
                {[
                  { label: "วัน", value: days },
                  { label: "ชั่วโมง", value: hours },
                  { label: "นาที", value: minutes },
                  { label: "วินาที", value: seconds },
                ].map((c) => (
                  <div
                    key={c.label}
                    className="bg-white/15 backdrop-blur rounded-xl px-4 py-3 min-w-[76px] text-center border border-white/20"
                  >
                    <div className="text-2xl md:text-3xl font-bold tabular-nums">
                      {String(c.value).padStart(2, "0")}
                    </div>
                    <div className="text-xs text-white/80 mt-0.5">{c.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-3 mt-8">
              <Button
                size="lg"
                variant="secondary"
                className="text-primary font-semibold"
                onClick={() => scrollTo("register")}
              >
                ลงทะเบียนเข้าร่วม
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="text-white hover:bg-white/20"
                onClick={() => scrollTo("agenda")}
              >
                ดูกำหนดการ
              </Button>
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" className="max-w-5xl mx-auto text-center space-y-4">
          <Badge variant="outline" className="border-primary/40 text-primary">เกี่ยวกับงาน</Badge>
          <h2 className="text-2xl md:text-3xl font-bold">{EVENT_INFO.fullName}</h2>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
            ภายใต้โครงการส่งเสริมการใช้งานแพลตฟอร์มสุขภาพดิจิทัลเพื่อการดูแลสุขภาพเชิงรุกของประชาชน
            ครอบคลุมภาคสาธารณสุข มหาวิทยาลัย เอกชน และท้องถิ่น
            เน้นเนื้อหา <strong>AI, Cybersecurity และ PDPA</strong> เพื่อยกระดับการบริการสุขภาพเชิงรุก
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="h-8 w-8 text-primary mx-auto mb-2" />
                <div className="text-3xl font-bold text-primary">{EVENT_INFO.totalSeats}</div>
                <div className="text-sm text-muted-foreground">ผู้เข้าร่วม</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Building2 className="h-8 w-8 text-primary mx-auto mb-2" />
                <div className="text-3xl font-bold text-primary">{EVENT_INFO.totalHospitals}</div>
                <div className="text-sm text-muted-foreground">โรงพยาบาลในเขต 1</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Calendar className="h-8 w-8 text-primary mx-auto mb-2" />
                <div className="text-3xl font-bold text-primary">2</div>
                <div className="text-sm text-muted-foreground">วันเต็ม</div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* HIGHLIGHTS */}
        <section id="highlights" className="space-y-6">
          <div className="text-center space-y-2">
            <Badge variant="outline" className="border-primary/40 text-primary">Highlights</Badge>
            <h2 className="text-2xl md:text-3xl font-bold">สิ่งที่คุณจะได้รับ</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {HIGHLIGHTS.map((h) => {
              const Icon = iconMap[h.icon as keyof typeof iconMap] ?? Sparkles;
              return (
                <Card key={h.title} className="border-t-4 border-t-primary hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{h.title}</CardTitle>
                    <p className="text-sm font-medium text-accent">{h.subtitle}</p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{h.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* AGENDA */}
        <section id="agenda" className="space-y-6">
          <div className="text-center space-y-2">
            <Badge variant="outline" className="border-primary/40 text-primary">กำหนดการ</Badge>
            <h2 className="text-2xl md:text-3xl font-bold">กำหนดการ 2 วัน</h2>
            <p className="text-muted-foreground">{EVENT_INFO.dateText}</p>
          </div>

          <Tabs defaultValue="day1" className="w-full">
            <TabsList className="grid grid-cols-2 max-w-md mx-auto">
              <TabsTrigger value="day1">
                วันที่ 1 · PDPA & Cybersecurity
              </TabsTrigger>
              <TabsTrigger value="day2">
                วันที่ 2 · AI & Proactive Care
              </TabsTrigger>
            </TabsList>
            <TabsContent value="day1" className="mt-6">
              <div className="mb-4 p-4 rounded-lg bg-primary/5 border border-primary/20 text-center">
                <p className="text-sm font-medium text-primary">จันทร์ 20 กรกฎาคม 2569 · นวัตกรรมสุขภาพและการคุ้มครองข้อมูล</p>
                <p className="text-xs text-muted-foreground mt-1">เน้นการสร้างพื้นฐานความปลอดภัยและการปฏิบัติตามกฎหมายในการใช้ดิจิทัลแพลตฟอร์ม</p>
              </div>
              <AgendaList items={AGENDA_DAY1} />
            </TabsContent>
            <TabsContent value="day2" className="mt-6">
              <div className="mb-4 p-4 rounded-lg bg-primary/5 border border-primary/20 text-center">
                <p className="text-sm font-medium text-primary">อังคาร 21 กรกฎาคม 2569 · ก้าวสู่อนาคตด้วยปัญญาประดิษฐ์</p>
                <p className="text-xs text-muted-foreground mt-1">เน้นการนำ AI มาประยุกต์ใช้เพื่อเพิ่มประสิทธิภาพการบริการเชิงรุก</p>
              </div>
              <AgendaList items={AGENDA_DAY2} />
            </TabsContent>
          </Tabs>
        </section>

        {/* SPEAKERS */}
        <section id="speakers" className="space-y-6">
          <div className="text-center space-y-2">
            <Badge variant="outline" className="border-primary/40 text-primary">Speakers</Badge>
            <h2 className="text-2xl md:text-3xl font-bold">วิทยากร</h2>
            <p className="text-muted-foreground">ผู้เชี่ยวชาญด้าน AI, Cybersecurity, PDPA และสาธารณสุขดิจิทัล</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SPEAKERS.map((s) => (
              <Card key={s.name} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-lg flex-shrink-0">
                      {s.name.charAt(s.name.startsWith("ผศ") || s.name.startsWith("ร.ต") || s.name.startsWith("เรือ") ? 3 : 0) || s.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground leading-tight">{s.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{s.title}</p>
                      <p className="text-xs text-muted-foreground">{s.organization}</p>
                      <Badge variant="secondary" className="mt-2 text-xs">
                        {s.topic}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* VENUE */}
        <section id="venue" className="space-y-6">
          <div className="text-center space-y-2">
            <Badge variant="outline" className="border-primary/40 text-primary">สถานที่จัดงาน</Badge>
            <h2 className="text-2xl md:text-3xl font-bold">{EVENT_INFO.venue}</h2>
            <p className="text-muted-foreground">{EVENT_INFO.address}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="aspect-video rounded-2xl overflow-hidden border shadow-sm">
              <iframe
                title="แผนที่โรงพยาบาลลำปาง"
                src={`https://www.google.com/maps?q=${encodeURIComponent(EVENT_INFO.mapsQuery)}&output=embed`}
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    การเดินทาง
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>• <strong>รถยนต์</strong>: ห่างจากตัวเมืองลำปางประมาณ 3 กม. มีลานจอดรถในโรงพยาบาล</p>
                  <p>• <strong>เครื่องบิน</strong>: สนามบินลำปาง ห่างประมาณ 5 กม. (แท็กซี่ ~15 นาที)</p>
                  <p>• <strong>รถไฟ</strong>: สถานีรถไฟลำปาง ห่างประมาณ 4 กม.</p>
                </CardContent>
                <CardContent className="pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      window.open(
                        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(EVENT_INFO.mapsQuery)}`,
                        "_blank",
                      )
                    }
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    เปิด Google Maps นำทาง
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UtensilsCrossed className="h-5 w-5 text-primary" />
                    ที่พักแนะนำใกล้ รพ.ลำปาง
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <p>• Wienglakor Hotel (~1 กม.)</p>
                  <p>• Lampang River Lodge (~2 กม.)</p>
                  <p>• Auangkham Resort (~2.5 กม.)</p>
                  <p>• เวียงหลวงลำปาง (~3 กม.)</p>
                  <p className="text-xs pt-2 italic">ผู้เข้าร่วมจองที่พักด้วยตนเอง</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* REGISTER CTA */}
        <section
          id="register"
          className="rounded-3xl bg-gradient-to-br from-primary to-accent p-8 md:p-14 text-primary-foreground text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,white_0%,transparent_50%)] opacity-10" />
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <Sparkles className="h-10 w-10 mx-auto opacity-90" />
            <h2 className="text-2xl md:text-4xl font-bold">พร้อมแล้ว มาร่วมงานกับเรา</h2>
            <p className="text-white/90 md:text-lg">
              รับสมัครเข้าร่วมงาน {EVENT_INFO.totalSeats} ท่าน · ฟรี ไม่มีค่าใช้จ่าย
            </p>
            <div className="pt-2">
              <Button
                size="lg"
                variant="secondary"
                className="text-primary font-semibold text-lg h-14 px-10"
                disabled
              >
                เปิดลงทะเบียนเร็ว ๆ นี้
              </Button>
              <p className="text-xs text-white/80 mt-3">
                (ระบบลงทะเบียนออนไลน์อยู่ระหว่างการพัฒนา — ติดต่อผู้จัดโดยตรงในระหว่างนี้)
              </p>
            </div>
            <div className="pt-4 flex items-center justify-center gap-2 text-sm text-white/90">
              <Mail className="h-4 w-4" />
              <a href={`mailto:${EVENT_INFO.contactEmail}`} className="underline underline-offset-4">
                {EVENT_INFO.contactEmail}
              </a>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <section className="text-center text-sm text-muted-foreground space-y-1 pt-6 border-t">
          <p className="font-medium text-foreground">จัดโดย {EVENT_INFO.organizer}</p>
          <p>ศูนย์เทคโนโลยีสารสนเทศและการสื่อสาร สำนักงานปลัดกระทรวงสาธารณสุข</p>
        </section>
      </div>
    </PublicLayout>
  );
}
