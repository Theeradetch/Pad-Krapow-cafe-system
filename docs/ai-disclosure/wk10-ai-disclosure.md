# wk10-ai-disclosure

## AI Disclosure Form

**กลุ่ม:** ______1______ 

### 1. มีการใช้ AI ช่วยงานหรือไม่
☑ ใช้ AI ช่วยงาน

### 2. เครื่องมือ AI ที่ใช้
- ChatGPT

### 3. วัตถุประสงค์
ใช้ AI ช่วยจัดโครงสร้างเอกสารจากข้อกำหนดใน `wk10.md` สำหรับงาน Input/Output Design, Wireframe และร่าง Sequence Diagram

### 4. ส่วนที่ AI ช่วย
- ร่างโครงสร้าง Input Form หน้า POS
- ร่างองค์ประกอบ Output ได้แก่ ใบเสร็จและ Summary Report
- ร่าง Wireframe ระดับ Mid-Fi จำนวน 3 หน้าจอ
- ร่างลำดับการทำงานของ `GET /api/reports/sales`

### 5. ส่วนที่ผู้จัดทำต้องตรวจสอบและปรับแก้
ผู้จัดทำต้องตรวจสอบให้ตรงกับ `wk03-requirements.md`, `wk04-user-stories.md`, backend/endpoint และ UI ที่ implement จริงของกลุ่ม รวมถึงเติมเลข requirement/user story และลิงก์ commit จริงก่อนส่ง

### 6. ข้อจำกัด
AI ไม่สามารถยืนยัน requirement เฉพาะของกลุ่มได้จาก `wk10.md` เพียงอย่างเดียว ดังนั้นข้อมูล Traceability และสถานะ implementation ต้องตรวจสอบกับเอกสารและโค้ดจริงของกลุ่ม

### 7. การยืนยัน
ข้าพเจ้าตรวจสอบและปรับแก้ผลงานจากที่ AI ช่วยร่างแล้ว และรับผิดชอบความถูกต้องของงานที่ส่ง
---

## AI Usage Declaration — Coding Sprint สัปดาห์ที่ 10

### 1. Diagram/เอกสารต้นทางของ sprint นี้:

`wk03-requirements.md`, `wk04-user-stories.md` (Use Case / Acceptance Criteria) และ Sequence Diagram สัปดาห์ 9 ใช้ตรวจทานว่าปุ่มบนหน้าจอเรียก endpoint ถูกจุด

### 2. ส่วนที่ AI ช่วยเขียนโค้ด:

สัปดาห์นี้เป็นงานออกแบบ ไม่มีโค้ด — AI ช่วยร่าง Input Form หน้า POS, Output ใบเสร็จและ Summary Report, Wireframe 3 หน้าจอ และร่างลำดับ `GET /api/reports/sales`

### 3. สมาชิกที่อธิบายงานส่วนนี้ได้ (ต้องมีอย่างน้อย 1 คนต่อส่วน):

⚠ (กรอกชื่อสมาชิก)

### 4. โค้ด/schema/สถาปัตยกรรมมีจุดใดต่างจาก diagram เดิมหรือไม่:

- [ ] ไม่ต่าง
- [x] ต่าง — เหตุผล: Wireframe มีช่องค้นหาลูกค้าและปุ่มชำระด้วยบัตรเครดิต แต่ FR-03 กำหนดวิธีชำระเป็น เงินสด/โอน/QR พร้อมเพย์ และไม่มีระบบสมาชิก
  ได้ปรับปรุงให้ตรงแล้ว: [x] แล้ว — UI ที่ implement ใช้ 3 วิธีชำระตาม FR-03 และไม่มีช่องค้นหาลูกค้า (ระบุใน Out-of-Scope ของ `wk10-srs.md`) ตาราง Traceability ในเอกสาร Input/Output Design เติมเลขข้อแล้ว
