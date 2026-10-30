# AI Disclosure Statement (สัปดาห์ที่ 9)

**สมาชิกผู้รับผิดชอบ**: 67160018 ภูมิพัฒน์ ขันอาสา

## 1. เครื่องมือ AI ที่ใช้งาน
-  Gemini

## 2. วัตถุประสงค์ในการใช้งาน
1. **ออกแบบและตรวจสอบ Sequence Diagram**: ใช้ช่วยวิเคราะห์ Order Flow (การสั่งซื้อสินค้าและการตัดสต็อก) ให้ครอบคลุมทั้ง Happy Path และ Error Path
2. **วางโครงสร้าง Process Design (Flowchart)**: ใช้ช่วยแปลง Business Rules ของระบบร้านกาแฟให้ออกมาเป็นขั้นตอนทางตรรกะก่อนเขียนโค้ด
3. **ตรวจสอบความสอดคล้องของโค้ด (Sprint 2)**: ใช้ช่วยทบทวนโค้ดใน Controller และ Model ให้ตรงตาม Sequence Diagram และหลักการ MVC

## 3. ผลลัพธ์และการนำไปใช้งานจริง
- นำ Diagram Structure ที่ได้ไปแปลงเป็นไฟล์รูปภาพ `wk09-sequence-diagram.png`
- นำโครงสร้างโค้ดส่วนการจัดการ Order และ Stock validation ไปปรับใช้ในโปรเจกต์กลุ่ม
---

## AI Usage Declaration — Coding Sprint สัปดาห์ที่ 9

### 1. Diagram/เอกสารต้นทางของ sprint นี้:

Sequence Diagram สัปดาห์ที่ 9 (`wk09-sequence-diagram.png`) flow `POST /api/orders` และ Class Diagram สัปดาห์ที่ 6 (`wk06-class-diagram.png`)

### 2. ส่วนที่ AI ช่วยเขียนโค้ด:

- `orderModel.js` — `OrderModel.createOrder(branchId, employeeId, paymentMethod, items)` บันทึก `orders` + `order_item` และตัดสต็อกใน transaction
- `menuModel.js` — `getByBranch`, `getById`, `updateStock`
- ร่างโครงสร้าง Sequence Diagram ทั้ง Happy Path และ Error Path

### 3. สมาชิกที่อธิบายโค้ดส่วนนี้ได้ (ต้องมีอย่างน้อย 1 คนต่อส่วน):

**ภูมิพัฒน์ ขันอาสา** (ผู้รับผิดชอบตามที่ระบุด้านบน) ⚠ เพิ่มชื่ออื่นถ้ามี

### 4. โค้ด/schema/สถาปัตยกรรมมีจุดใดต่างจาก diagram เดิมหรือไม่:

- [ ] ไม่ต่าง
- [x] ต่าง — เหตุผล: Sequence Diagram มีขั้นตอน "ตรวจสอบสต็อกเพียงพอ" และ "ตรวจสต็อกต่ำกว่า 10 หลังตัด" แต่ `createOrder` ในสัปดาห์นี้ลดสต็อกโดยไม่ตรวจ และยังไม่มี Controller ที่ทำ validation (บันทึกไว้ใน `wk11-architecture.md` ฉบับแรก)
  ได้ปรับปรุง diagram / โค้ดให้ตรงแล้ว: [x] แล้ว — แก้โค้ดใน Coding Sprint สัปดาห์ 13 และวาด Sequence Diagram ฉบับปรับปรุง `wk13-sequence-create-order.png`
