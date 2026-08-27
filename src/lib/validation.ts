import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max);

export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Telefon raqami juda qisqa")
  .max(20, "Telefon raqami juda uzun")
  .regex(/^[+0-9()\-\s]+$/, "Telefon raqami noto'g'ri");

export const leadSchema = z.object({
  customer_name: trimmed(120).min(2, "Mijoz ismi kamida 2 ta belgi"),
  customer_phone: phoneSchema,
  lead_type: trimmed(60).optional().or(z.literal("")),
  notes: trimmed(1000).optional().or(z.literal("")),
  activity: trimmed(120).optional().or(z.literal("")),
  source: trimmed(120).optional().or(z.literal("")),
});

export const productSchema = z.object({
  name: trimmed(150).min(2, "Mahsulot nomi kamida 2 ta belgi"),
  description: trimmed(2000).optional().or(z.literal("")),
  price: z
    .number({ invalid_type_error: "Narx noto'g'ri" })
    .finite()
    .min(0, "Narx manfiy bo'lishi mumkin emas")
    .max(1_000_000_000, "Narx juda katta"),
});

export const taskSchema = z.object({
  title: trimmed(150).min(2, "Vazifa nomi kamida 2 ta belgi"),
  description: trimmed(2000).optional().or(z.literal("")),
  due_date: z.string().trim().min(1, "Muddat kiritilishi kerak"),
});

export const orderSchema = z.object({
  customer_name: trimmed(120).min(2, "Mijoz ismi kamida 2 ta belgi"),
  customer_phone: phoneSchema,
  customer_phone2: phoneSchema.optional().or(z.literal("")),
  region: trimmed(100).optional().or(z.literal("")),
  district: trimmed(100).optional().or(z.literal("")),
  notes: trimmed(1000).optional().or(z.literal("")),
});

export const sellerSchema = z.object({
  full_name: trimmed(120).min(2, "Ism kamida 2 ta belgi"),
  email: z.string().trim().email("Email noto'g'ri").max(255),
  password: z.string().min(8, "Parol kamida 8 ta belgi").max(72),
  phone: phoneSchema.optional().or(z.literal("")),
  role: z.enum(["admin", "rop", "sotuvchi"], { errorMap: () => ({ message: "Rol noto'g'ri" }) }),
});

/** Returns the first validation error message, or null when input is valid. */
export function firstError(result: z.SafeParseReturnType<unknown, unknown>): string | null {
  if (result.success) return null;
  return result.error.errors[0]?.message ?? "Ma'lumotlar noto'g'ri";
}
