## การใช้ AI ในงานนี้ (AI Usage Declaration)

### 1. ใช้ AI หรือไม่?

- [ ] ไม่ได้ใช้ AI
- [x] ใช้ AI (กรุณาระบุรายละเอียด)

### 2. เครื่องมือ AI ที่ใช้

- Claude (Anthropic)

## 3. งานส่วนไหนใช้ AI

- [x] **Backend Development** — เขียนโค้ดส่วนใหญ่ใน `code/src/` ได้แก่ `app.js`, `server.js`, `config/db.js`, `middleware/auth.js`, controllers 5 ไฟล์, routes 5 ไฟล์, `models/Order.js`, `employeeModel.js`, `reportModel.js` และปรับปรุง `orderModel.js` / `menuModel.js` เดิมของกลุ่ม
- [x] **Frontend Development** — หน้าจอใน `code/public/` (login, POS, เมนูและสต็อก, รายงาน, ใบเสร็จ) ตาม Wireframe สัปดาห์ 10 ของกลุ่ม
- [x] **Database** — ปรับ `wk07-schema.sql` (เพิ่มคอลัมน์และ CHECK) และสคริปต์ `scripts/setup-db.js`
- [x] **Test Case Design & Testing** — ชุดทดสอบอัตโนมัติ `code/test/` (41 tests) และ End-to-End ผ่านเบราว์เซอร์ ผลอยู่ใน `wk13-test-cases.md`
- [x] **Requirement Update** — ร่าง Requirement Revision Log และคำตอบท้ายบทใน `wk03-requirements.md`, คำตอบท้ายบทใน `wk04-user-stories.md`
- [x] **Documentation** — `wk10-srs.md`, ปรับ `wk11-architecture.md` ให้ครบ 4+1 View, ปรับ `wk12-usability-testing.md`, `wk14-quality-review.md`, `README.md`, diagram ใหม่ใน `docs/diagrams/` และรายงานฉบับสมบูรณ์

## 4. Prompt ที่ใช้ (ตัวอย่าง)

"เทียบ repository ของกลุ่มเรากับอีกกลุ่มว่าขาดอะไร" และ "ทำส่วนที่กลุ่มเราขาดให้ครบ ทำให้รอบคอบ" โดยแนบ repository ของกลุ่ม AI อ่านเอกสาร wk01–wk12, diagram และ wireframe ของกลุ่มก่อนเขียนโค้ด

## 5. ผลลัพธ์จาก AI

ได้ระบบที่รันได้ครบ (login, รับออเดอร์, ตัดสต็อก, แจ้งเตือนสต็อก, ใบเสร็จ, จัดการเมนู, รายงานรายวัน/รายเดือน) พร้อมชุดทดสอบที่ผ่าน 41/41 บน MySQL 8.0 และ MariaDB 10.11 เอกสารที่ขาด และ diagram ที่ปรับให้ตรงกับโค้ด

## 6. การปรับแต่งของตัวเอง

⚠ **ส่วนนี้ต้องให้สมาชิกกรอกตามที่ทำจริงก่อนส่ง** ตัวอย่างสิ่งที่ควรทำและบันทึก:

- [ ] ติดตั้งและรันระบบบนเครื่องของสมาชิกอย่างน้อย 1 เครื่อง (`npm install`, `npm run db:setup:demo`, `npm start`, `npm test`)
- [ ] อ่านและอธิบายโค้ดส่วนที่ตัวเองรับผิดชอบได้ (ดูข้อ 3 ด้านล่าง)
- [ ] ทำ Usability Testing รอบใหม่กับระบบจริง แล้วแทนที่ข้อมูลสมมติใน `wk12-usability-testing.md`
- [ ] ตรวจและแก้ข้อความในเอกสารให้ตรงกับความเข้าใจของกลุ่ม

## 7. เหตุผลในการใช้ AI

กลุ่มมีเพียง model 2 ไฟล์และยังไม่มีระบบที่รันได้ จึงใช้ AI ช่วยสร้างส่วนที่ขาดให้สอดคล้องกับเอกสารที่กลุ่มออกแบบไว้แล้ว (requirement, user story, ER, sequence, wireframe) โดยกลุ่มต้องตรวจสอบ ทดสอบ และอธิบายผลงานได้เอง

## การยืนยัน

⚠ ข้าพเจ้าได้ตรวจสอบและทดสอบผลงานที่ AI ช่วยสร้างแล้ว และรับผิดชอบความถูกต้องของงานที่ส่ง — ลงชื่อ: ________________

---

## AI Usage Declaration — Coding Sprint สัปดาห์ที่ 13

### 1. Diagram/เอกสารต้นทางของ sprint นี้:

- Use Case / User Stories / Acceptance Criteria สัปดาห์ 4 (`wk04-user-stories.md`)
- Class Diagram สัปดาห์ 6 → `src/models/Order.js`
- ER Diagram และ Schema สัปดาห์ 7 → `db/schema.sql`
- Sequence Diagram สัปดาห์ 9 → `orderController.createOrder` + `OrderModel.createOrder`
- Wireframe และ Input/Output Design สัปดาห์ 10 → `public/*.html`
- Architecture สัปดาห์ 11 (Development View) → โครงสร้างโฟลเดอร์ `code/src/`

### 2. ส่วนที่ AI ช่วยเขียนโค้ด:

| ไฟล์ | ฟังก์ชันหลัก |
|---|---|
| `src/models/orderModel.js` | `createOrder` (ล็อกแถว `FOR UPDATE`, ตรวจสต็อก, ใช้ราคาจากฐานข้อมูล, เขียน `stock_movement`), `getById`, `listByBranchAndDate` |
| `src/models/menuModel.js` | `getByBranch`, `getById`, `getLowStock`, `updateStock`, `adjustStock`, `create`, `update`, `softDelete` |
| `src/models/Order.js` | `Order.addItem`, `removeItem`, `calculateTotal`, `OrderItem.getSubtotal` |
| `src/models/reportModel.js` | `getSummary`, `getSalesByMenu`, `getDailySales` |
| `src/controllers/*.js` | ตรวจข้อมูลนำเข้า + กติกาธุรกิจของ auth / branch / menu / order / report |
| `src/middleware/auth.js` | `authenticate`, `requireRole`, `resolveBranchId`, `assertCanAccessBranch` |
| `public/js/pos.js` | ตะกร้า, คำนวณยอด, ปุ่มยืนยันแบบป้องกันความผิดพลาด, ดึงสต็อกทุก 3 วินาที, ใบเสร็จ |
| `public/js/menu.js`, `report.js`, `common.js` | หน้าจัดการเมนู, รายงาน, ฟังก์ชันกลาง |
| `test/*.js` | ชุดทดสอบ 41 กรณี |

### 3. สมาชิกที่อธิบายโค้ดส่วนนี้ได้ (ต้องมีอย่างน้อย 1 คนต่อส่วน):

⚠ **ต้องกรอกก่อนส่ง และต้องอธิบายได้จริง** — แนะนำให้แบ่งตามชั้น:

| ส่วน | สมาชิก |
|---|---|
| ฐานข้อมูล + `orderModel.js` / `menuModel.js` (transaction, FOR UPDATE) | |
| Controllers + `middleware/auth.js` (validation, JWT, สิทธิ์สาขา) | |
| `reportModel.js` / `reportController.js` (SQL รายงาน) | |
| หน้าจอ `public/` (pos.js, menu.js, report.js) | |
| ชุดทดสอบ `test/` | |

### 4. โค้ด/schema/สถาปัตยกรรมมีจุดใดต่างจาก diagram เดิมหรือไม่:

- [ ] ไม่ต่าง
- [x] ต่าง — เหตุผล:
  1. Schema เพิ่ม `employee.username/password_hash`, `menu_item.low_stock_threshold/is_active`, `orders.total_amount`, `stock_movement.order_id/reason` และ CHECK constraints (เหตุผลท้ายไฟล์ `wk07-schema.sql`)
  2. Sequence: `employeeId` มาจาก token ไม่ใช่จาก body, ขั้นต่ำเป็นค่าต่อเมนูแทนค่าคงที่ 10, response เพิ่ม `totalAmount`
  3. Development View: Routes/Controllers จาก "แนวคิด" เป็นไฟล์จริง และเพิ่ม `middleware/auth.js`

  ได้ปรับปรุง diagram สัปดาห์นี้ให้ตรงแล้ว: [x] แล้ว — `wk07-er-diagram.png`, `wk11-development-view.png`, `wk11-physical-view.png`, `wk11-logical-view.png`, `wk13-sequence-create-order.png`, `wk13-sequence-sales-report.png` (ฉบับเดิมเก็บที่ `docs/images/v1/`)
