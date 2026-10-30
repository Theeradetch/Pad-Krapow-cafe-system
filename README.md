# กลุ่มที่ 1: Pad-Krapow-cafe

ระบบ POS ร้านกาแฟ **Pad-Krapow-cafe-system** — รับออเดอร์ คิดเงิน ตัดสต็อกอัตโนมัติ แจ้งเตือนสต็อกใกล้หมด ออกใบเสร็จ และสรุปยอดขายรายวัน/รายเดือน รองรับหลายสาขา

## รายชื่อสมาชิก

1. 67160031 นายธีรเดช อยู่คง
2. 67160030 นายดรัณภพ ทวีพูล
3. 67160039 นายภัคพล ใบเนียม
4. 67160047 นายอภิชาติ ชนะชัย
5. 67160018 นายภูมิพัฒน์ ขันอาสา

## เอกสารโครงงาน

- รายงานโครงงานฉบับสมบูรณ์: [PDF](docs/project-report.pdf), [DOCX](docs/project-report.docx)
- สัปดาห์ 1: [Team Charter](docs/wk01-team-charter.md)
- สัปดาห์ 2: [Feasibility Report](docs/wk02-feasibility-report.md), [BPMN As-Is](docs/images/as-is.png), [BPMN To-Be](docs/images/to-be.png)
- สัปดาห์ 3: [Requirements + Revision Log](docs/wk03-requirements.md)
- สัปดาห์ 4: [User Stories](docs/wk04-user-stories.md), [Use Case Diagram](docs/use-case-diagram.png)
- สัปดาห์ 5: [AI Disclosure](docs/ai-disclosure/wk05-ai-disclosure.md)
- สัปดาห์ 6: [Class Diagram](docs/wk06-class-diagram.png), [Object Diagram](docs/wk06-object-diagram.png)
- สัปดาห์ 7: [ER Diagram](docs/wk07-er-diagram.png), [Database Schema](docs/wk07-schema.sql)
- สัปดาห์ 9: [Sequence Diagram](docs/wk09-sequence-diagram.png), [AI Disclosure](docs/ai-disclosure/wk09-ai-disclosure.md)
- สัปดาห์ 10: [SRS](docs/wk10-srs.md), [Wireframe](docs/wk10-wireframe.docx), [Input/Output Design](docs/wk10-input-output-design.docx), [AI Disclosure](docs/ai-disclosure/wk10-ai-disclosure.md)
- สัปดาห์ 11: [Architecture (4+1 View)](docs/wk11-architecture.md), [Logical View](docs/wk11-logical-view.png), [Development View](docs/wk11-development-view.png), [Physical View](docs/wk11-physical-view.png)
- สัปดาห์ 12: [Usability Testing](docs/wk12-usability-testing.md)
- สัปดาห์ 13: [Test Cases & Integration](docs/wk13-test-cases.md), [Sequence: สร้างออเดอร์](docs/wk13-sequence-create-order.png), [Sequence: รายงานยอดขาย](docs/wk13-sequence-sales-report.png), [AI Disclosure](docs/ai-disclosure/wk13-ai-disclosure.md)
- สัปดาห์ 14: [รายงานตรวจสอบคุณภาพ](docs/wk14-quality-review.md)
- ภาพหน้าจอระบบ: [docs/images/screens/](docs/images/screens/)
- ไฟล์ต้นฉบับ diagram (Mermaid แก้ไขได้): [docs/diagrams/](docs/diagrams/) — diagram ฉบับก่อนปรับเก็บที่ [docs/images/v1/](docs/images/v1/)

## โครงสร้าง Repository

```
.
├── README.md
├── docs/                 เอกสารรายสัปดาห์, diagram, รายงาน
└── code/                 ซอร์สโค้ดระบบ
    ├── src/              Node.js + Express (routes → middleware → controllers → models)
    ├── public/           หน้าจอ HTML/CSS/JS (login, POS, เมนูและสต็อก, รายงาน, ใบเสร็จ)
    ├── db/schema.sql     โครงสร้างฐานข้อมูล
    ├── scripts/          สคริปต์สร้างฐานข้อมูล + ข้อมูลตั้งต้น
    └── test/             ชุดทดสอบอัตโนมัติ
```

## วิธีติดตั้งและรันระบบ

**สิ่งที่ต้องมี:** Node.js 20 ขึ้นไป และ MySQL 8.0 หรือ MariaDB (ทดสอบแล้วบน MySQL 8.0.46 และ MariaDB 10.11 — MariaDB ที่มากับ XAMPP ก็ใช้ได้)

```bash
cd code
npm install

# 1) สร้างไฟล์ตั้งค่า แล้วแก้ DB_USER / DB_PASSWORD ให้ตรงกับเครื่อง
cp .env.example .env        # Windows: copy .env.example .env

# 2) สร้างฐานข้อมูล + ข้อมูลตั้งต้น
npm run db:setup            # หรือ npm run db:setup:demo เพื่อเพิ่มออเดอร์ตัวอย่างย้อนหลัง 45 วัน

# 3) เปิดระบบ
npm start                   # แล้วเปิด http://localhost:3000
```

> ⚠ `db:setup` จะ **ลบแล้วสร้างฐานข้อมูลใหม่** ตามชื่อใน `DB_NAME` ใช้ตอนติดตั้งครั้งแรกหรือรีเซ็ตข้อมูลเท่านั้น

**บัญชีสำหรับทดลอง** (ควรเปลี่ยนรหัสผ่านก่อนใช้งานจริง)

| ชื่อผู้ใช้ | รหัสผ่าน | บทบาท | สาขา |
|---|---|---|---|
| `owner` | `Owner@1234` | เจ้าของร้าน (ดูทุกสาขา, จัดการเมนู) | สาขาหน้ามหาวิทยาลัย |
| `barista1` | `Barista@1234` | บาริสต้า | สาขาหน้ามหาวิทยาลัย |
| `barista2` | `Barista@1234` | บาริสต้า | สาขาตัวเมือง |

**ใช้บนแท็บเล็ตในร้าน:** ให้แท็บเล็ตต่อ WiFi เดียวกับเครื่องที่รัน server แล้วเปิด `http://<IP ของเครื่อง server>:3000`

## การทดสอบ

```bash
cd code
npm test        # 41 tests: unit + API กับฐานข้อมูลจริง (สร้างฐานข้อมูลแยกชื่อ <DB_NAME>_test ให้เอง)
```

ผลทดสอบล่าสุดและ Test Case ที่ผูกกับ Acceptance Criteria อยู่ใน [docs/wk13-test-cases.md](docs/wk13-test-cases.md)

## API โดยย่อ

ทุก endpoint (ยกเว้น login) ต้องส่ง `Authorization: Bearer <token>` — รายละเอียดเต็มใน [SRS ข้อ 3.3](docs/wk10-srs.md)

| Method | Endpoint | หน้าที่ |
|---|---|---|
| POST | `/api/auth/login` | เข้าสู่ระบบ |
| GET | `/api/branches` | รายชื่อสาขา |
| GET | `/api/menu?branchId=` · `/api/menu/low-stock` · `/api/menu/categories` | เมนู สต็อก หมวดหมู่ |
| POST / PATCH / DELETE | `/api/menu`, `/api/menu/:id`, `/api/menu/:id/stock` | จัดการเมนู / เติมสต็อก |
| POST | `/api/orders` | สร้างออเดอร์ + ตัดสต็อก |
| GET | `/api/orders?date=` · `/api/orders/:id` | ออเดอร์ของวัน / ใบเสร็จ |
| GET | `/api/reports/sales?from=&to=` · `/api/reports/monthly?month=` | รายงานยอดขาย |
