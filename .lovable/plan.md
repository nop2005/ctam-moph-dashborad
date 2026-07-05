
# แผนเพิ่มภาพ/กราฟิกให้หน้า R1 Digital Health Forum 2026

เป้าหมาย: ทำให้หน้า `/public/event/r1next2026` ดู **ทันสมัย, ล้ำ, น่าตื่นเต้น** ด้วยธีม **AI + Cybersecurity in Healthcare** ชวนให้อยากลงทะเบียน

---

## 1. ภาพที่จะสร้างใหม่ (AI-generated)

สร้างด้วย `imagegen` เก็บที่ `src/assets/event/`:

| ไฟล์ | การใช้งาน | สไตล์ |
|---|---|---|
| `hero-bg.jpg` (1920x1024) | พื้นหลัง Hero เต็มจอ | Futuristic hospital + neural network glow, cyan/violet gradient, digital shield motif, cinematic dark tone |
| `ai-security-shield.png` (1024x1024, transparent) | Floating graphic ใน Hero | 3D holographic shield ล้อมด้วย DNA + circuit lines, glow effect |
| `agenda-day1.jpg` (1280x720) | Header ของ Tab Day 1 | Doctor + AI hologram interface, warm cyan light |
| `agenda-day2.jpg` (1280x720) | Header ของ Tab Day 2 | Cybersecurity operations center, dark blue with red alert accents |
| `venue-lampang.jpg` (1600x900) | Section สถานที่ | ภาพ modern conference hall ตกแต่งด้วย overlay กราฟิก tech |
| `pattern-grid.svg` | Background overlay | เส้นกริดโปร่งใส + จุด node แบบ network |

Speaker cards: ใช้ **avatar placeholder แบบ gradient + initials** (ไม่ generate หน้าคน เพื่อความสุภาพ) จนกว่าจะมีรูปจริง

---

## 2. ปรับ Hero Section

- พื้นหลัง: `hero-bg.jpg` + gradient overlay (dark → transparent)
- Animated elements:
  - Floating shield PNG (`animate-float` แบบ CSS keyframes)
  - Particle dots (CSS-only, ~20 จุด random position + `animate-pulse` delay ต่างกัน)
  - Countdown ใส่ **glass-morphism card** (backdrop-blur + border glow)
- Badge "AI x Cybersecurity in Healthcare" ด้านบน headline
- CTA ปุ่ม 2 ปุ่ม: primary glow + ghost outline

## 3. ปรับ Section อื่นๆ

- **Agenda tabs**: banner image ด้านบนแต่ละ tab + badge สีต่างกันตาม type (session/workshop/panel/break) ทำให้ contrast ชัดขึ้น
- **Speakers**: card เปลี่ยนเป็น gradient border + hover lift effect + avatar circle glow
- **Venue**: hero image ของ section + info cards แยก (การเดินทาง / ที่พัก / อาหาร) พร้อม icon
- **Sticky CTA bar** ล่างสุด (mobile): "เหลืออีก X วัน — ลงทะเบียน"

## 4. Design Tokens ที่จะเพิ่มใน `index.css`

เพิ่ม event-scoped tokens (ไม่กระทบธีมหลัก):
```css
--event-cyan: 190 95% 55%;
--event-violet: 265 85% 65%;
--event-glow: 0 0 40px hsl(var(--event-cyan) / 0.5);
--gradient-event-hero: linear-gradient(135deg, hsl(220 60% 8%), hsl(260 70% 15%));
--gradient-event-accent: linear-gradient(90deg, hsl(var(--event-cyan)), hsl(var(--event-violet)));
```
+ keyframes: `float`, `glow-pulse`, `particle-drift`

## 5. ไฟล์ที่จะแก้/เพิ่ม

- ใหม่: `src/assets/event/*` (6 ไฟล์ผ่าน imagegen)
- ใหม่: `src/components/event/HeroBackground.tsx` (particle + shield layer)
- ใหม่: `src/components/event/SpeakerAvatar.tsx` (gradient initials fallback)
- แก้: `src/pages/EventR1Next2026.tsx` (โครงสร้าง section ใหม่, ใช้ tokens)
- แก้: `src/index.css` (เพิ่ม event tokens + keyframes)

---

## ขอบเขต

- **ไม่แตะ backend / routing / เมนู** — เฉพาะภาพและการนำเสนอ
- **ไม่แก้เนื้อหา agenda / speakers / venue** — ใช้ข้อมูลเดิมจาก `eventContent.ts`
- ปุ่มลงทะเบียนยัง disabled รอ Phase 2

พร้อมเริ่มเลยไหมครับ? (การ generate ภาพ 6 ใบใช้เครดิตเล็กน้อย)
