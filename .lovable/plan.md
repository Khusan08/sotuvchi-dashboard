
# Google Sheets Sinxronizatsiyani To'liq Qayta Loyihalash

## Hozirgi Muammo

Google Apps Script ichida `SHEETS_SYNC_WEBHOOK_URL` degan Script Property o'rnatilmagan. Bu holda Apps Script webhook'dan data olib kelolmaydi va xato qaytaradi.

## Yechim: Google Sheets API orqali To'g'ridan-To'g'ri Yozish

Apps Script'ni butunlay olib tashlab, **Google Sheets API**'ga to'g'ridan-to'g'ri yozadigan yangi Edge Function yaratamiz. `GOOGLE_SERVICE_ACCOUNT_KEY` allaqachon mavjud, shuning uchun bu ishlaydi.

---

## Arxitektura

```text
┌─────────────────┐       ┌─────────────────────────┐       ┌──────────────┐
│   Frontend      │──────▶│  sheets-sync-direct     │──────▶│ Google       │
│   (Orders.tsx)  │       │  (Edge Function)        │       │ Sheets API   │
└─────────────────┘       └─────────────────────────┘       └──────────────┘
                                    │
                                    ▼
                          ┌─────────────────┐
                          │  Supabase DB    │
                          │  (orders table) │
                          └─────────────────┘
```

---

## Amalga Oshirish Bosqichlari

### 1-bosqich: Yangi Edge Function yaratish
`supabase/functions/sheets-sync-direct/index.ts` - Google Sheets API v4 orqali to'g'ridan-to'g'ri yozadigan function

**Funksiyalar:**
- Supabase'dan barcha buyurtmalarni oladi
- Google Sheets API'ga autentifikatsiya qiladi (Service Account)
- Sheetga yangi qator qo'shadi yoki mavjud qatorni yangilaydi

### 2-bosqich: Ustunlar tuzilishini sizning sheetga moslashtirish

Rasimdan ko'rinadigan ustunlar (K dan R gacha):
| K | L | M | N | O | P | Q | R |
|---|---|---|---|---|---|---|---|
| Note | Qoldiq | Status | Sotuvchi | Izoh | Buyurtma sanasi | Phone 2 | Sales |

**Siz tanlagan formatlar:**
- **Sana formati:** `dd.MM.yyyy HH:mm` (masalan: 04.02.2026 14:42)
- **Status:** Uzbekcha (Jarayonda / Tugallandi / Bekor qilindi)

### 3-bosqich: Frontend'ni yangilash
`src/pages/Orders.tsx` va `src/pages/AllOrders.tsx` fayllarida `trigger-sheets-sync` o'rniga yangi `sheets-sync-direct` funksiyasini chaqirish

---

## Texnik Tafsilotlar

### Google Sheets API Autentifikatsiyasi
```text
GOOGLE_SERVICE_ACCOUNT_KEY (mavjud) → JWT token yaratish → Sheets API
```

### Ustunlar Mapping (16 ta ustun)

| # | Ustun nomi | Ma'lumot manbasi |
|---|------------|------------------|
| A | telegram_message_id | orders.telegram_message_id |
| B | message | "Yangi buyurtma #773" format |
| C | order_number | orders.order_number |
| D | customer_name | orders.customer_name |
| E | customer_phone | orders.customer_phone |
| F | address | region + district |
| G | products | ["Kitob1","Kitob2"] format |
| H | total_amount | orders.total_amount |
| I | advance_payment | orders.advance_payment |
| J | remaining_payment | total - advance |
| K | status | "Jarayonda" / "Tugallandi" / "Bekor qilindi" |
| L | seller_name | profiles.full_name |
| M | notes | orders.notes |
| N | created_at | dd.MM.yyyy HH:mm format |
| O | customer_phone2 | orders.customer_phone2 |
| P | source | "WEB" |

### Status Tarjimasi
```text
pending    → "Jarayonda"
delivered  → "Tugallandi"  
cancelled  → "Bekor qilindi"
```

---

## Kerakli O'zgarishlar

| Fayl | O'zgarish |
|------|-----------|
| `supabase/functions/sheets-sync-direct/index.ts` | Yangi fayl - Google Sheets API'ga to'g'ridan-to'g'ri yozish |
| `supabase/config.toml` | Yangi function qo'shish |
| `src/pages/Orders.tsx` | `trigger-sheets-sync` → `sheets-sync-direct` |
| `src/pages/AllOrders.tsx` | `trigger-sheets-sync` → `sheets-sync-direct` |
| `supabase/functions/sheets-sync-webhook/index.ts` | O'chiriladi (endi kerak emas) |
| `supabase/functions/trigger-sheets-sync/index.ts` | O'chiriladi (endi kerak emas) |

---

## Afzalliklari

1. **Apps Script shart emas** - Google Console'da hech narsa sozlash kerak emas
2. **To'liq nazorat** - barcha logika Edge Function ichida
3. **Xatolarni debug qilish oson** - barcha loglar Supabase'da
4. **Tezroq** - 1 ta API call o'rniga 2 ta (trigger → webhook) emas

---

## Talab qilinadigan Secret

`GOOGLE_SERVICE_ACCOUNT_KEY` - **allaqachon mavjud** ✅
`GOOGLE_SHEETS_SPREADSHEET_ID` - **allaqachon mavjud** ✅

---

## Keyingi Qadam

Tasdiqlasangiz, men:
1. Yangi `sheets-sync-direct` Edge Function yarataman
2. Frontend'ni yangilayman
3. Eski funksiyalarni o'chiraman
4. Test qilaman
