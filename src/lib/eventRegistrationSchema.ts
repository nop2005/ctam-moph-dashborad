import { z } from "zod";

export const DIETARY_OPTIONS = [
  { value: "normal", label: "อาหารทั่วไป" },
  { value: "vegetarian", label: "มังสวิรัติ" },
  { value: "vegan", label: "เจ / วีแกน" },
  { value: "halal", label: "ฮาลาล" },
  { value: "allergy", label: "แพ้อาหาร (โปรดระบุ)" },
] as const;

export const eventRegistrationSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(2, { message: "กรุณากรอกชื่อ-นามสกุล" })
      .max(150, { message: "ชื่อยาวเกินไป (ไม่เกิน 150 ตัวอักษร)" }),
    position: z
      .string()
      .trim()
      .min(2, { message: "กรุณากรอกตำแหน่ง" })
      .max(150, { message: "ตำแหน่งยาวเกินไป" }),
    organization: z
      .string()
      .trim()
      .min(2, { message: "กรุณากรอกหน่วยงาน/โรงพยาบาล" })
      .max(200, { message: "ชื่อหน่วยงานยาวเกินไป" }),
    province: z
      .string()
      .trim()
      .min(2, { message: "กรุณากรอกจังหวัด" })
      .max(80, { message: "ชื่อจังหวัดยาวเกินไป" }),
    email: z
      .string()
      .trim()
      .email({ message: "รูปแบบอีเมลไม่ถูกต้อง" })
      .max(200, { message: "อีเมลยาวเกินไป" }),
    phone: z
      .string()
      .trim()
      .min(9, { message: "เบอร์โทรควรมีอย่างน้อย 9 หลัก" })
      .max(20, { message: "เบอร์โทรยาวเกินไป" })
      .regex(/^[0-9+\-\s()]+$/, { message: "เบอร์โทรควรมีเฉพาะตัวเลขและอักขระ + - ( )" }),
    attend_day1: z.boolean(),
    attend_day2: z.boolean(),
    dietary: z.enum(["normal", "vegetarian", "vegan", "halal", "allergy"]),
    dietary_note: z.string().trim().max(300).optional().or(z.literal("")),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((v) => v.attend_day1 || v.attend_day2, {
    message: "กรุณาเลือกวันที่เข้าร่วมอย่างน้อย 1 วัน",
    path: ["attend_day1"],
  })
  .refine((v) => v.dietary !== "allergy" || (v.dietary_note && v.dietary_note.length >= 2), {
    message: "กรุณาระบุอาหารที่แพ้",
    path: ["dietary_note"],
  });

export type EventRegistrationInput = z.infer<typeof eventRegistrationSchema>;
