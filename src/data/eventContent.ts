export const EVENT_INFO = {
  code: "r1next2026",
  name: "R1Next 2026",
  fullName: "เวทีนวัตกรรมและแลกเปลี่ยนเรียนรู้ R1 Digital Health Forum ครั้งที่ 1",
  tagline: "Scaling Health Innovation with AI, Trust, and Cyber Resilience",
  taglineTh: "ยกระดับนวัตกรรมสุขภาพเขต 1 ด้วย AI ความเชื่อมั่น และความปลอดภัยทางไซเบอร์",
  startDate: "2026-07-20T08:30:00+07:00",
  endDate: "2026-07-21T16:30:00+07:00",
  dateText: "จันทร์ 20 – อังคาร 21 กรกฎาคม 2569",
  venue: "โรงพยาบาลลำปาง ห้องประชุม อาคารผู้ป่วยนอก ชั้น 8",
  venueShort: "รพ.ลำปาง",
  address: "280 ถ.พหลโยธิน ต.หัวเวียง อ.เมือง จ.ลำปาง 52000",
  mapsQuery: "โรงพยาบาลลำปาง อาคารผู้ป่วยนอก",
  targetAudience: "ผู้บริหาร เจ้าหน้าที่ IT และผู้ปฏิบัติงานคลินิก จาก รพ.ในเขตสุขภาพที่ 1",
  totalHospitals: 120,
  totalSeats: 400,
  organizer: "ศูนย์เฝ้าระวังความมั่นคงปลอดภัยไซเบอร์ เขตสุขภาพที่ 1 (CISO R1)",
  contactEmail: "ciso.r1@moph.go.th",
};

export const HIGHLIGHTS = [
  {
    title: "Medical AI",
    subtitle: "จากพื้นฐานสู่การใช้งานจริง",
    description: "อัพเดตแนวโน้ม AI ทางการแพทย์ และการนำมาประยุกต์ในหน่วยบริการ",
    icon: "brain",
  },
  {
    title: "Cybersecurity & PDPA",
    subtitle: "ความปลอดภัยและกฎหมายคุ้มครองข้อมูล",
    description: "ยกระดับความมั่นคงปลอดภัยไซเบอร์ พร้อมกรอบ Data Governance ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล",
    icon: "shield",
  },
  {
    title: "Showcase นวัตกรรม",
    subtitle: "แลกเปลี่ยนเรียนรู้จากพื้นที่จริง",
    description: "โรงพยาบาลชั้นนำในเขต 1-2 นำเสนอผลงานดิจิทัลสุขภาพและ Telemedicine",
    icon: "sparkles",
  },
];

export interface AgendaItem {
  time: string;
  title: string;
  detail?: string;
  speaker?: string;
  room?: "main" | "sub" | "both";
  type?: "break" | "ceremony" | "session" | "workshop" | "panel";
}

export const AGENDA_DAY1: AgendaItem[] = [
  { time: "08.30 – 09.00", title: "ลงทะเบียน", type: "break" },
  {
    time: "09.00 – 09.30",
    title: "พิธีเปิด",
    detail: "ประธานกล่าวเปิดงานและบรรยายทิศทาง Digital Health ในเขตสุขภาพที่ 1",
    type: "ceremony",
  },
  {
    time: "09.30 – 10.45",
    title: "Medical AI: Basic to Advance",
    speaker:
      "ผศ.นพ.สุรัตน์ ตันประเวช (มช.) และ AI Update โดย KBTG",
    room: "main",
    type: "session",
  },
  { time: "10.45 – 11.00", title: "พักรับประทานอาหารว่าง / เยี่ยมชมบูธ", type: "break" },
  {
    time: "11.00 – 12.00",
    title: "Cybersecurity and Data Governance",
    speaker: "เรือโทธีรพล หนองหว้า ผู้อำนวยการฝ่ายบริหารจัดการข้อมูลภัยคุกคามทางไซเบอร์ (สกมช.)",
    room: "main",
    type: "session",
  },
  { time: "12.00 – 13.00", title: "พักรับประทานอาหารกลางวัน / เยี่ยมชมบูธ", type: "break" },
  {
    time: "13.00 – 13.30",
    title: "AI Next Gen and Cloud",
    speaker: "บริษัท AWS",
    room: "main",
    type: "session",
  },
  {
    time: "13.00 – 15.30",
    title: "Generative AI (ห้องประชุมย่อย)",
    speaker: "พญ.วชิราภรณ์ อรุโณทอง รอง ผอ.รพ.ลำปาง + ทีม รพ.ลำปาง",
    room: "sub",
    type: "session",
  },
  {
    time: "13.30 – 15.30",
    title: "Showcase: นวัตกรรมดิจิทัลสุขภาพ",
    detail: "รพ.พุทธชินราช (เขต 2) / สสจ.ลำปาง / สสจ.ลำพูน / สสจ.เชียงใหม่",
    room: "main",
    type: "panel",
  },
  { time: "15.30 – 15.45", title: "พักรับประทานอาหารว่าง / เยี่ยมชมบูธ", type: "break" },
  {
    time: "15.45 – 16.30",
    title: "Workshop: ประเมินความเสี่ยงข้อมูล PDPA & Cybersecurity",
    detail: "แบ่ง 2 ห้อง (ห้องใหญ่ / ห้องย่อย)",
    room: "both",
    type: "workshop",
  },
];

export const AGENDA_DAY2: AgendaItem[] = [
  {
    time: "09.00 – 10.30",
    title: "AI and Data Governance in PDPA: กรณีศึกษาในงานสาธารณสุข",
    speaker: "ร.ต.อ.อมรพันธุ์ นิติธีรานนท์ ผู้ทรงคุณวุฒิและผู้ช่วยเลขาธิการ คณะกรรมการคุ้มครองข้อมูลส่วนบุคคล",
    room: "main",
    type: "session",
  },
  { time: "10.30 – 10.45", title: "พักรับประทานอาหารว่าง / เยี่ยมชมบูธ", type: "break" },
  {
    time: "10.45 – 12.00",
    title: "Panel Discussion: Digital Platform - หมอพร้อมเพื่อยกระดับปฐมภูมิ",
    detail: "เสวนาการใช้ 'หมอพร้อม' และ Telemedicine",
    speaker:
      "นพ.ศุภโชค มาศปกรณ์ (รพ.เชียงราย), พญ.วชิราภรณ์ อรุโณทอง (รพ.ลำปาง), จนท.รพ.สต. จ.แพร่ / พิธีกร: นพ.ณัฏฐธนิน เศรษฐวณิชย์",
    room: "main",
    type: "panel",
  },
  { time: "12.00 – 13.00", title: "พักรับประทานอาหารกลางวัน / เยี่ยมชมบูธ", type: "break" },
  {
    time: "13.00 – 15.00",
    title: "Showcase: นวัตกรรมดิจิทัลสุขภาพ (ห้องใหญ่)",
    detail: "สสจ.เชียงราย / สสจ.แพร่ / สสจ.น่าน",
    room: "main",
    type: "panel",
  },
  {
    time: "13.00 – 15.00",
    title: "Showcase: นวัตกรรมดิจิทัลสุขภาพ (ห้องย่อย)",
    detail: "สสจ.พะเยา และจังหวัดอื่น ๆ",
    room: "sub",
    type: "panel",
  },
  { time: "15.00 – 15.15", title: "พักรับประทานอาหารว่าง / เยี่ยมชมบูธ", type: "break" },
  {
    time: "15.00 – 15.45",
    title: "สรุปบทเรียนและแนวทางการทำงาน",
    detail: "ถอดบทเรียนเพื่อนำไปใช้จริงในหน่วยบริการ",
    type: "ceremony",
  },
  { time: "15.45 – 16.30", title: "พิธีมอบเกียรติบัตรและปิดงาน", type: "ceremony" },
];

export interface Speaker {
  name: string;
  title: string;
  organization: string;
  topic: string;
  photo?: string;
}

import suratPhoto from "@/assets/event/speakers/surat-tanprawate.png.asset.json";
import teerapolPhoto from "@/assets/event/speakers/teerapol-nongwa.png.asset.json";
import amornpunPhoto from "@/assets/event/speakers/amornpun-nitithiranon.png.asset.json";

export const SPEAKERS: Speaker[] = [
  {
    name: "ผศ.นพ.สุรัตน์ ตันประเวช",
    title: "ผู้ช่วยคณบดีด้านวิจัย นวัตกรรม และวิเทศสัมพันธ์",
    organization: "รองหัวหน้าศูนย์นวัตกรรมสุขภาพ (MEDCHIC) คณะแพทยศาสตร์ มช.",
    topic: "Medical AI: Basic to Advance",
    photo: suratPhoto.url,
  },
  {
    name: "เรือโท ธีรพล หนองหว้า",
    title: "ผู้อำนวยการฝ่ายบริหารจัดการข้อมูลภัยคุกคามทางไซเบอร์",
    organization: "สำนักงานคณะกรรมการการรักษาความมั่นคงปลอดภัยไซเบอร์แห่งชาติ (สกมช.)",
    topic: "Cybersecurity and Data Governance",
    photo: teerapolPhoto.url,
  },
  {
    name: "ร.ต.อ.อมรพันธุ์ นิติธีรานนท์",
    title: "ผู้ทรงคุณวุฒิและผู้ช่วยเลขาธิการ",
    organization: "คณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (PDPC)",
    topic: "AI and Data Governance in PDPA: กรณีศึกษาสาธารณสุข",
  },
  {
    name: "พญ.วชิราภรณ์ อรุโณทอง",
    title: "รองผู้อำนวยการโรงพยาบาลลำปาง",
    organization: "โรงพยาบาลลำปาง",
    topic: "Generative AI ในงานโรงพยาบาล",
  },
  {
    name: "นพ.ศุภโชค มาศปกรณ์",
    title: "รองผู้อำนวยการโรงพยาบาลเชียงรายประชานุเคราะห์",
    organization: "โรงพยาบาลเชียงรายประชานุเคราะห์",
    topic: "Panel: หมอพร้อมและ Telemedicine",
  },
  {
    name: "นพ.ณัฏฐธนิน เศรษฐวณิชย์",
    title: "ผู้ช่วยผู้อำนวยการโรงพยาบาลแพร่",
    organization: "โรงพยาบาลแพร่",
    topic: "พิธีกร Panel Discussion",
  },
  {
    name: "ทีมวิทยากร KBTG",
    title: "AI Update",
    organization: "Kasikorn Business-Technology Group",
    topic: "AI Update จากภาคเอกชน",
  },
  {
    name: "ทีมวิทยากร AWS",
    title: "AI Next Gen and Cloud",
    organization: "Amazon Web Services",
    topic: "Cloud & Generative AI Infrastructure",
  },
];
