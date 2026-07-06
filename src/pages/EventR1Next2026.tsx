import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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
  Zap,
  Lock,
  Cpu,
  ArrowRight,
} from "lucide-react";
import {
  EVENT_INFO,
  HIGHLIGHTS,
  AGENDA_DAY1,
  AGENDA_DAY2,
  SPEAKERS,
  type AgendaItem,
} from "@/data/eventContent";
import heroBg from "@/assets/event/hero-bg.jpg";
import aiShield from "@/assets/event/ai-shield.png";
import day1Banner from "@/assets/event/day1-banner.jpg";
import day2Banner from "@/assets/event/day2-banner.jpg";
import venueBannerAsset from "@/assets/event/venue-lampang-real.png.asset.json";
const venueBanner = venueBannerAsset.url;
import { AmbientSoundToggle } from "@/components/event/AmbientSoundToggle";

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

function parseTime(range: string): [number, number] {
  const m = range.match(/(\d{1,2})[.:](\d{2})\s*[–\-]\s*(\d{1,2})[.:](\d{2})/);
  if (!m) return [0, 0];
  return [parseInt(m[1]) * 60 + parseInt(m[2]), parseInt(m[3]) * 60 + parseInt(m[4])];
}

function AgendaItemCard({ it, compact = false, hideRoomBadge = false }: { it: AgendaItem; compact?: boolean; hideRoomBadge?: boolean }) {
  const isBreak = it.type === "break";
  return (
    <div
      className={`flex gap-4 rounded-xl border p-4 h-full transition-all ${
        isBreak
          ? "bg-muted/40 border-dashed"
          : "bg-card hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
      }`}
    >
      {!compact && (
        <div className="flex-shrink-0 flex flex-col items-center gap-1 w-28 text-center">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">{it.time}</span>
          <span className="text-xs text-muted-foreground">น.</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        {compact && (
          <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">{it.time} น.</span>
          </div>
        )}
        <div className="flex items-start gap-2 flex-wrap">
          <span className={`mt-0.5 ${isBreak ? "text-muted-foreground" : "text-primary"}`}>
            {typeIcon(it.type)}
          </span>
          <h3 className={`font-semibold ${isBreak ? "text-muted-foreground" : "text-foreground"}`}>
            {it.title}
          </h3>
          {!hideRoomBadge && roomLabel(it.room)}
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
}

function AgendaList({ items }: { items: AgendaItem[] }) {
  type Group =
    | { kind: "single"; item: AgendaItem }
    | { kind: "split"; main: AgendaItem[]; sub: AgendaItem[] }
    | { kind: "mainOnly"; items: AgendaItem[]; preItems?: AgendaItem[] }
    | { kind: "subOnly"; items: AgendaItem[] };
  const groups: Group[] = [];
  let i = 0;
  while (i < items.length) {
    const cur = items[i];
    if (cur.room === "main" || cur.room === "sub") {
      let j = i;
      const run: AgendaItem[] = [];
      while (j < items.length && (items[j].room === "main" || items[j].room === "sub")) {
        run.push(items[j]);
        j++;
      }
      const hasMain = run.some((r) => r.room === "main");
      const hasSub = run.some((r) => r.room === "sub");
      if (run.length > 1 && hasMain && hasSub) {
        groups.push({
          kind: "split",
          main: run.filter((r) => r.room === "main"),
          sub: run.filter((r) => r.room === "sub"),
        });
        i = j;
        continue;
      }
      if (run.length > 1 && hasMain && !hasSub) {
        // Pull preceding single items without a room into this morning block
        const preItems: AgendaItem[] = [];
        while (groups.length > 0 && groups[groups.length - 1].kind === "single") {
          const last = groups[groups.length - 1] as { kind: "single"; item: AgendaItem };
          if (!last.item.room) {
            preItems.unshift(last.item);
            groups.pop();
          } else {
            break;
          }
        }
        groups.push({ kind: "mainOnly", items: run, preItems: preItems.length > 0 ? preItems : undefined });
        i = j;
        continue;
      }
      if (run.length > 1 && !hasMain && hasSub) {
        groups.push({ kind: "subOnly", items: run });
        i = j;
        continue;
      }
    }
    groups.push({ kind: "single", item: cur });
    i += 1;
  }

  return (
    <div className="space-y-3">
      {groups.map((g, idx) => {
        if (g.kind === "single") return <AgendaItemCard key={idx} it={g.item} />;
        if (g.kind === "mainOnly") {
          const allItems = g.preItems ? [...g.preItems, ...g.items] : g.items;
          return (
            <div key={idx} className="rounded-xl border border-primary/20 bg-primary/[0.02] p-3">
              <div className="mb-2 text-center">
                <Badge variant="secondary" className="text-sm">ห้องประชุมใหญ่</Badge>
              </div>
              <div className="flex flex-col gap-3">
                {allItems.map((it, j) => (
                  <AgendaItemCard key={j} it={it} compact hideRoomBadge />
                ))}
              </div>
            </div>
          );
        }
        if (g.kind === "subOnly") {
          return (
            <div key={idx} className="rounded-xl border border-primary/20 bg-primary/[0.02] p-3">
              <div className="mb-2 text-center">
                <Badge variant="outline" className="text-sm">ห้องประชุมย่อย</Badge>
              </div>
              <div className="flex flex-col gap-3">
                {g.items.map((it, j) => (
                  <AgendaItemCard key={j} it={it} compact hideRoomBadge />
                ))}
              </div>
            </div>
          );
        }
        return (
          <div key={idx} className="rounded-xl border border-primary/20 bg-primary/[0.02] p-3">
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div className="text-center">
                <Badge variant="secondary" className="text-sm">ห้องประชุมใหญ่</Badge>
              </div>
              <div className="text-center">
                <Badge variant="outline" className="text-sm">ห้องประชุมย่อย</Badge>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
              <div className="flex flex-col gap-3 h-full">
                {g.main.map((it, j) => (
                  <div key={j} className="flex-1 min-h-0"><AgendaItemCard it={it} compact hideRoomBadge /></div>
                ))}
              </div>
              <div className="flex flex-col gap-3 h-full">
                {g.sub.map((it, j) => (
                  <div key={j} className="flex-1 min-h-0"><AgendaItemCard it={it} compact hideRoomBadge /></div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}



/** Speaker avatar: real photo when provided, otherwise gradient + initial */
function SpeakerAvatar({ name, photo }: { name: string; photo?: string }) {
  const prefixes = ["ผศ.นพ.", "ผศ.", "รศ.นพ.", "รศ.", "นพ.", "พญ.", "ร.ต.อ.", "เรือโท ", "เรือโท", "ทีมวิทยากร "];
  let clean = name;
  for (const p of prefixes) if (clean.startsWith(p)) { clean = clean.slice(p.length); break; }
  const initial = clean.trim().charAt(0) || name.charAt(0);
  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[hsl(190_95%_55%)] via-[hsl(217_91%_55%)] to-[hsl(265_85%_60%)] blur-sm opacity-50" />
      {photo ? (
        <img
          src={photo}
          alt={name}
          loading="lazy"
          className="relative w-24 h-24 rounded-full object-cover ring-2 ring-white/90 shadow-lg"
        />
      ) : (
        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[hsl(190_95%_55%)] via-[hsl(217_91%_50%)] to-[hsl(265_85%_55%)] flex items-center justify-center text-white font-bold text-2xl shadow-lg">
          {initial}
        </div>
      )}
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
      <AmbientSoundToggle />
      <div className="space-y-16 pb-24">
        {/* HERO */}
        <section
          id="hero"
          className="relative overflow-hidden rounded-3xl event-hero-gradient shadow-2xl"
        >
          {/* Background image */}
          <img
            src={heroBg}
            alt=""
            aria-hidden
            width={1920}
            height={1024}
            className="absolute inset-0 w-full h-full object-cover opacity-55 mix-blend-screen"
          />
          {/* Grid overlay */}
          <div className="absolute inset-0 event-grid-overlay pointer-events-none" />
          {/* Dark gradient for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(222_60%_8%)]/95 via-[hsl(222_60%_10%)]/70 to-transparent" />
          {/* Floating particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 22 }).map((_, i) => {
              const left = (i * 37) % 100;
              const delay = (i * 0.4) % 6;
              const size = 2 + (i % 4);
              const bottom = -10 + ((i * 13) % 40);
              return (
                <span
                  key={i}
                  className="absolute rounded-full bg-cyan-300 animate-event-particle"
                  style={{
                    left: `${left}%`,
                    bottom: `${bottom}%`,
                    width: size,
                    height: size,
                    animationDelay: `${delay}s`,
                    boxShadow: "0 0 8px hsl(190 95% 65%)",
                  }}
                />
              );
            })}
          </div>

          {/* Floating shield graphic (desktop only) */}
          <img
            src={aiShield}
            alt=""
            aria-hidden
            width={520}
            height={520}
            className="hidden lg:block absolute -right-8 top-1/2 -translate-y-1/2 w-[420px] xl:w-[520px] animate-event-float animate-event-glow pointer-events-none select-none"
          />

          <div className="relative z-10 max-w-4xl p-8 md:p-14 lg:p-16 text-white">
            <Badge className="bg-white/10 text-cyan-100 border border-cyan-300/40 backdrop-blur mb-5 gap-1.5">
              <Sparkles className="h-3 w-3" />
              AI × Cybersecurity in Healthcare · เขตสุขภาพที่ 1
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight">
              <span className="event-text-gradient">R1 Digital Health</span>
              <br />
              <span className="text-white">Forum 2026</span>
            </h1>
            <p className="text-lg md:text-2xl font-medium mt-4 text-cyan-100/95">
              {EVENT_INFO.tagline}
            </p>
            <p className="text-sm md:text-base text-white/75 mt-2 max-w-2xl">{EVENT_INFO.taglineTh}</p>

            <div className="flex flex-wrap gap-3 mt-7 text-sm">
              <div className="flex items-center gap-2 event-glass rounded-full px-4 py-2 text-cyan-50">
                <Calendar className="h-4 w-4 text-cyan-300" />
                <span>{EVENT_INFO.dateText}</span>
              </div>
              <div className="flex items-center gap-2 event-glass rounded-full px-4 py-2 text-cyan-50">
                <MapPin className="h-4 w-4 text-cyan-300" />
                <span>{EVENT_INFO.venueShort}</span>
              </div>
              <div className="flex items-center gap-2 event-glass rounded-full px-4 py-2 text-cyan-50">
                <Users className="h-4 w-4 text-cyan-300" />
                <span>{EVENT_INFO.totalSeats} ที่นั่ง · {EVENT_INFO.totalHospitals} รพ.</span>
              </div>
            </div>

            {/* Countdown */}
            {!done && (
              <div className="mt-8">
                <p className="text-xs uppercase tracking-widest text-cyan-300/80 mb-3">นับถอยหลังสู่งาน</p>
                <div className="flex gap-3 md:gap-4 flex-wrap">
                  {[
                    { label: "วัน", value: days },
                    { label: "ชั่วโมง", value: hours },
                    { label: "นาที", value: minutes },
                    { label: "วินาที", value: seconds },
                  ].map((c) => (
                    <div
                      key={c.label}
                      className="event-glass event-glow-border rounded-2xl px-5 py-3 min-w-[92px] text-center"
                    >
                      <div className="text-3xl md:text-4xl font-bold tabular-nums event-text-gradient">
                        {String(c.value).padStart(2, "0")}
                      </div>
                      <div className="text-[11px] text-cyan-100/80 mt-1 tracking-widest uppercase">{c.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 mt-9">
              <Button
                size="lg"
                className="bg-gradient-to-r from-cyan-400 to-violet-500 hover:from-cyan-300 hover:to-violet-400 text-slate-900 font-semibold shadow-[0_0_30px_hsl(190_95%_55%/0.5)] border-0"
                asChild
              >
                <Link to="/public/event/r1next2026/register">
                  ลงทะเบียนเข้าร่วม
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="bg-white/5 text-white border-white/30 hover:bg-white/15 hover:text-white backdrop-blur"
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
            {[
              { icon: Users, value: EVENT_INFO.totalSeats, label: "ผู้เข้าร่วม" },
              { icon: Building2, value: EVENT_INFO.totalHospitals, label: "โรงพยาบาลในเขต 1" },
              { icon: Calendar, value: 2, label: "วันเต็ม" },
            ].map(({ icon: Icon, value, label }) => (
              <Card key={label} className="group relative overflow-hidden border-primary/20 hover:border-primary/50 transition-all hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="pt-6 text-center relative">
                  <Icon className="h-8 w-8 text-primary mx-auto mb-2" />
                  <div className="text-3xl font-bold event-text-gradient">{value}</div>
                  <div className="text-sm text-muted-foreground">{label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* SPEAKERS */}
        <section id="speakers" className="space-y-6">
          <div className="text-center space-y-2 pb-10">
            <Badge variant="outline" className="border-primary/40 text-primary">Speakers</Badge>
            <h2 className="text-2xl md:text-3xl font-bold">วิทยากร</h2>
            <p className="text-muted-foreground">ผู้เชี่ยวชาญด้าน AI, Cybersecurity, PDPA และสาธารณสุขดิจิทัล</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 !mt-32">
            {SPEAKERS.map((s) => (
              <Card
                key={s.name}
                className="group relative border-primary/15 hover:border-primary/50 hover:-translate-y-1 hover:shadow-xl transition-all"
              >
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-cyan-400 via-primary to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="pt-24 pb-6 px-5 relative">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                    <SpeakerAvatar name={s.name} photo={s.photo} />
                  </div>
                  <div className="flex-1 min-w-0 text-center">
                    <h3 className="font-semibold text-foreground leading-tight">{s.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.organization}</p>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {s.topic}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
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
                <Card
                  key={h.title}
                  className="group relative overflow-hidden border-primary/15 hover:border-primary/50 transition-all hover:-translate-y-1 hover:shadow-xl"
                >
                  {/* gradient border shimmer */}
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-primary to-violet-500" />
                  <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors" />
                  <CardHeader className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Icon className="h-7 w-7 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{h.title}</CardTitle>
                    <p className="text-sm font-medium text-accent">{h.subtitle}</p>
                  </CardHeader>
                  <CardContent className="relative">
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
                <Lock className="h-4 w-4 mr-1.5" /> Day 1 · Security
              </TabsTrigger>
              <TabsTrigger value="day2">
                <Cpu className="h-4 w-4 mr-1.5" /> Day 2 · AI
              </TabsTrigger>
            </TabsList>

            <TabsContent value="day1" className="mt-6 space-y-4">
              <div className="relative rounded-2xl overflow-hidden aspect-[24/7] md:aspect-[32/7]">
                <img
                  src={day1Banner}
                  alt="Day 1 — PDPA & Cybersecurity"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/60 to-transparent" />
                <div className="absolute inset-0 flex items-center px-6 md:px-10">
                  <div>
                    <Badge className="bg-cyan-400/20 text-cyan-100 border border-cyan-300/40 mb-2">
                      <Lock className="h-3 w-3 mr-1" /> วันที่ 1
                    </Badge>
                    <h3 className="text-xl md:text-2xl font-bold text-white">PDPA & Cybersecurity</h3>
                    <p className="text-sm md:text-base text-cyan-100/80 mt-1">
                      จันทร์ 20 ก.ค. 2569 · นวัตกรรมสุขภาพและการคุ้มครองข้อมูล
                    </p>
                  </div>
                </div>
              </div>
              <AgendaList items={AGENDA_DAY1} />
            </TabsContent>

            <TabsContent value="day2" className="mt-6 space-y-4">
              <div className="relative rounded-2xl overflow-hidden aspect-[24/7] md:aspect-[32/7]">
                <img
                  src={day2Banner}
                  alt="Day 2 — AI & Proactive Care"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/60 to-transparent" />
                <div className="absolute inset-0 flex items-center px-6 md:px-10">
                  <div>
                    <Badge className="bg-violet-400/20 text-violet-100 border border-violet-300/40 mb-2">
                      <Cpu className="h-3 w-3 mr-1" /> วันที่ 2
                    </Badge>
                    <h3 className="text-xl md:text-2xl font-bold text-white">AI & Proactive Care</h3>
                    <p className="text-sm md:text-base text-violet-100/80 mt-1">
                      อังคาร 21 ก.ค. 2569 · ก้าวสู่อนาคตด้วยปัญญาประดิษฐ์
                    </p>
                  </div>
                </div>
              </div>
              <AgendaList items={AGENDA_DAY2} />
            </TabsContent>
          </Tabs>
        </section>


        {/* VENUE */}
        <section id="venue" className="space-y-6">
          <div className="relative rounded-3xl overflow-hidden">
            <img
              src={venueBanner}
              alt=""
              aria-hidden
              className="w-full h-64 md:h-72 object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-slate-950/40" />
            <div className="absolute inset-0 flex items-end p-6 md:p-10">
              <div>
                <Badge variant="outline" className="border-primary/40 text-primary bg-background/80 backdrop-blur mb-2">
                  สถานที่จัดงาน
                </Badge>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">{EVENT_INFO.venue}</h2>
                <p className="text-muted-foreground text-sm md:text-base mt-1">{EVENT_INFO.address}</p>
              </div>
            </div>
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
          className="relative overflow-hidden rounded-3xl event-hero-gradient p-8 md:p-14 text-white text-center"
        >
          <div className="absolute inset-0 event-grid-overlay" />
          <img
            src={aiShield}
            alt=""
            aria-hidden
            className="hidden md:block absolute -left-10 top-1/2 -translate-y-1/2 w-56 opacity-40 animate-event-float"
          />
          <img
            src={aiShield}
            alt=""
            aria-hidden
            className="hidden md:block absolute -right-10 top-1/2 -translate-y-1/2 w-56 opacity-40 animate-event-float"
            style={{ animationDelay: "2s" }}
          />
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full event-glass border border-emerald-300/40 text-emerald-100 text-xs uppercase tracking-widest">
              <Sparkles className="h-3.5 w-3.5" />
              เปิดรับสมัครแล้ว
            </div>
            <h2 className="text-3xl md:text-5xl font-bold">
              <span className="event-text-gradient">พร้อมแล้ว</span>
              <br />
              <span className="text-white">มาร่วมงานกับเรา</span>
            </h2>
            <p className="text-white/85 md:text-lg">
              รับสมัครเข้าร่วมงาน {EVENT_INFO.totalSeats} ท่าน · ฟรี ไม่มีค่าใช้จ่าย
            </p>
            <div className="pt-2">
              <Button
                size="lg"
                className="bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-900 font-semibold text-lg h-14 px-10 border-0 shadow-[0_0_30px_hsl(190_95%_55%/0.5)] hover:from-cyan-300 hover:to-violet-400"
                asChild
              >
                <Link to="/public/event/r1next2026/register">
                  ลงทะเบียนเข้าร่วมงาน
                  <ArrowRight className="h-5 w-5 ml-1" />
                </Link>
              </Button>
            </div>
            <div className="pt-4 flex items-center justify-center gap-2 text-sm text-cyan-100">
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
