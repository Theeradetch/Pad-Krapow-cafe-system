# wk14-quality-review.md — สรุปผลตรวจคุณภาพโค้ด

**ระบบ:** Pad-Krapow-cafe-system
**ขอบเขตที่ตรวจ:** ทุก endpoint ใน `code/src/routes/` (16 endpoints) และโค้ดที่เกี่ยวข้องใน controllers, models, middleware, หน้าจอใน `code/public/`
**วันที่ตรวจ:** 30/10/2026

## Endpoints ที่ตรวจ

- **Auth:** `POST /api/auth/login`, `GET /api/auth/me`
- **Branches:** `GET /api/branches`
- **Menu:** `GET /api/menu`, `GET /api/menu/low-stock`, `GET /api/menu/categories`, `GET /api/menu/:menuId`, `POST /api/menu`, `PATCH /api/menu/:menuId`, `PATCH /api/menu/:menuId/stock`, `DELETE /api/menu/:menuId`
- **Orders:** `POST /api/orders`, `GET /api/orders`, `GET /api/orders/:orderId`
- **Reports:** `GET /api/reports/sales`, `GET /api/reports/monthly`

## ผล Checklist

| หัวข้อ | ผลตรวจ | หลักฐาน |
|---|---|---|
| ตรวจข้อมูลนำเข้า (Input Validation) | **ผ่าน** — ทุก endpoint ตรวจชนิด/ช่วงค่าที่ server ด้วย `utils/validate.js` วันที่ต้องมีอยู่จริงในปฏิทิน จำกัดขนาด body 100 KB จำนวนรายการ ≤ 50 จำนวนต่อเมนู ≤ 100 | TC-16, TC-32, TC-44, unit tests |
| ยืนยันตัวตน (Authentication) | **ผ่าน** — ทุก endpoint ยกเว้น login ต้องมี JWT, รหัสผ่านเป็น bcrypt, จำกัดการเดารหัสผ่าน | TC-01 ถึง TC-05 |
| จำกัดสิทธิ์ / IDOR | **ผ่าน** — `resolveBranchId()` และ `assertCanAccessBranch()` กันบาริสต้าเข้าถึงสาขาอื่น, `requireRole('owner')` กันการแก้เมนู, `employeeId` เอาจาก token ไม่ใช่จาก body | TC-06, TC-07, TC-14, TC-21, TC-30 |
| SQL Injection | **ผ่าน** — ใช้ parameterized query (`?`) ทุกคำสั่ง ชื่อคอลัมน์ใน `MenuModel.update` มาจาก whitelist ในโค้ด ไม่ได้มาจากผู้ใช้ | TC-44 (ส่ง `' OR 1=1--` ใน query string ได้ 400) |
| XSS | **ผ่าน** — ข้อมูลจากฐานข้อมูลผ่าน `esc()` ก่อนใส่ HTML ทุกจุด และมี Content-Security-Policy ห้าม inline script | ตรวจโค้ด `public/js/*.js`, TC-50 |
| Error handling | **ผ่าน** — error handler กลางแปลงเป็น JSON ภาษาไทย ไม่ส่ง stack trace ให้ผู้ใช้ JSON เสียได้ 400 | TC-17, TC-50 |
| Transaction / Race condition ของสต็อก | **ผ่าน** — สร้างออเดอร์ใน transaction เดียว ล็อกแถวด้วย `FOR UPDATE` เรียงตาม `menu_id` กัน deadlock มี CHECK `stock_quantity >= 0` เป็นด่านสุดท้าย | TC-15, TC-20 |
| ความถูกต้องของเงิน | **ผ่าน** — ราคาจากฐานข้อมูลเท่านั้น คิดเป็นสตางค์ (จำนวนเต็ม) ไม่มีปัญหาทศนิยม | TC-13, unit tests |
| ความลับในโค้ด | **ผ่าน** — ไม่มีรหัสผ่าน/secret ใน repository, `.env` อยู่ใน `.gitignore` มีเฉพาะ `.env.example` | ตรวจ repository |

## ประเด็นที่ควรปรับปรุง (ยังไม่ได้แก้ — เรียงตามความเสี่ยง)

1. **ปานกลาง: ยังไม่มี HTTPS**
   ถ้าใช้แค่ใน WiFi ของร้านความเสี่ยงต่ำ แต่ถ้าเปิดให้เข้าจากนอกร้าน token และรหัสผ่านจะวิ่งเป็นข้อความธรรมดา ต้องติดตั้ง reverse proxy (เช่น Caddy/Nginx) พร้อมใบรับรอง
2. **ปานกลาง: token เก็บใน `localStorage`**
   ถ้ามีช่องโหว่ XSS ในอนาคต token อาจถูกขโมยได้ ตอนนี้ลดความเสี่ยงด้วย CSP และ `esc()` ทางที่ปลอดภัยกว่าคือเก็บใน cookie แบบ `HttpOnly` + `SameSite=Strict`
3. **ปานกลาง: ออกจากระบบแล้ว token ยังใช้ได้จนหมดอายุ (12 ชม.)**
   เพราะ JWT ไม่มีสถานะที่ server ถ้าพนักงานลาออกต้องรอ token หมดอายุ ควรลดอายุ token หรือเพิ่มตาราง token ที่ถูกเพิกถอน
4. **ต่ำ: ตัวนับการเดารหัสผ่านอยู่ในหน่วยความจำ**
   รีสตาร์ต server แล้วตัวนับหายไป และใช้ไม่ได้ถ้ารันหลาย process ระบบนี้รัน process เดียวจึงยอมรับได้
5. **ต่ำ: `stock_movement` ไม่ได้บันทึกว่าใครเติม/ปรับสต็อก**
   ควรเพิ่มคอลัมน์ `employee_id` เพื่อตรวจสอบย้อนหลังได้
6. **ต่ำ: ไม่มีการยกเลิก/คืนเงินออเดอร์**
   ถ้าพนักงานกดผิดต้องแก้ด้วยการปรับสต็อกเอง ยอดขายยังนับอยู่ ควรเพิ่มสถานะออเดอร์ `voided` ในรุ่นถัดไป
7. **ต่ำ: หน้า POS ดึงข้อมูลทุก 3 วินาที**
   เหมาะกับร้านที่มี 1–3 เครื่อง ถ้าเครื่องมากขึ้นควรเปลี่ยนเป็น WebSocket / Server-Sent Events
8. **ต่ำ: `GET /api/orders` คืนได้สูงสุด 200 รายการต่อวัน**
   พอสำหรับร้านขนาดเล็ก ถ้าเกินควรทำแบ่งหน้า (pagination)

## การแก้ไขที่ทำแล้ว (เทียบกับโค้ดเดิมก่อน Coding Sprint)

| # | ประเด็นในโค้ดเดิม | ความเสี่ยง | การแก้ |
|---|---|---|---|
| 1 | `createOrder` ลดสต็อกโดยไม่ตรวจว่าพอ | สูง — สต็อกติดลบ ขายของที่ไม่มี | ตรวจสต็อกหลังล็อกแถว ถ้าไม่พอ rollback ทั้งออเดอร์ + CHECK ในฐานข้อมูล |
| 2 | รับ `unitPrice` จาก client | สูง — แก้ราคาเองได้ | ใช้ราคาจาก `menu_item` เท่านั้น |
| 3 | รับ `employeeId` จาก client / ไม่มีระบบ login | สูง — บันทึกการขายในชื่อคนอื่น, ดูข้อมูลทุกสาขาได้ | เพิ่ม login (bcrypt + JWT) และตรวจสิทธิ์สาขา |
| 4 | ไม่มีการตรวจข้อมูลนำเข้า | ปานกลาง — จำนวนติดลบ/ทศนิยม ทำให้สต็อกเพิ่มขึ้นแทนที่จะลด | ตรวจทุก field ที่ controller |
| 5 | `MenuModel.updateStock` ลดสต็อกได้ไม่จำกัด | ปานกลาง | เพิ่มเงื่อนไข `AND stock_quantity >= ?` |
| 6 | ไม่บันทึก `stock_movement` | ต่ำ — ตรวจย้อนหลังไม่ได้ | บันทึกทุกครั้งที่สต็อกเปลี่ยน |
| 7 | schema ไม่มี CHECK constraint | ต่ำ | เพิ่ม CHECK ราคา/สต็อก/จำนวน/วิธีชำระ/เหตุผล |

## การทดสอบหลังแก้

- รันชุดทดสอบอัตโนมัติ `npm test` — **41/41 ผ่าน** บน MySQL 8.0.46 และ MariaDB 10.11 (รายละเอียดใน `wk13-test-cases.md`)
- ทดสอบ End-to-End ผ่านเบราว์เซอร์ 11 กรณี — ผ่านทั้งหมด
- ทดสอบการขายพร้อมกัน 8 คำขอ บนสต็อก 3 ชิ้น — ขายได้ 3 ปฏิเสธ 5 สต็อกไม่ติดลบ
- วัดเวลาบันทึกออเดอร์ 10 ครั้ง — ค่ากลาง 8 ms ช้าสุด 22 ms (NFR-01 กำหนดไม่เกิน 2 วินาที)
- **ยังไม่ได้ทดสอบ:** บนแท็บเล็ตจริงของร้าน, บนเครือข่าย WiFi จริง, และกับผู้ใช้จริง (ต้องทำใน Usability Testing รอบถัดไป)
