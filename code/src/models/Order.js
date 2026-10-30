// models/Order.js - Domain class ตาม Class Diagram สัปดาห์ที่ 6
// Order กับ OrderItem เป็น Composition: OrderItem ไม่มีความหมายถ้าไม่มี Order เจ้าของ
// ไฟล์นี้ไม่ยุ่งกับฐานข้อมูล ใช้คำนวณยอดเงินและรวมรายการซ้ำก่อนส่งให้ orderModel บันทึก

class OrderItem {
  constructor(menuId, quantity, unitPrice = 0, name = '') {
    this.menuId = menuId;
    this.quantity = quantity;
    this.unitPrice = unitPrice;
    this.name = name;
  }

  // คิดเป็นสตางค์ (จำนวนเต็ม) ก่อนแล้วค่อยแปลงกลับ ป้องกันปัญหาทศนิยมของ JavaScript เช่น 0.1 + 0.2
  getSubtotal() {
    return toBaht(toSatang(this.unitPrice) * this.quantity);
  }
}

class Order {
  constructor(orderId = null) {
    this.orderId = orderId;
    this.items = [];
  }

  // เพิ่มรายการ ถ้าเป็นเมนูเดิมให้รวมจำนวน (ตาม Sequence Diagram: "รวมจำนวนของรายการที่เป็นเมนูเดียวกัน")
  addItem(menuId, quantity, unitPrice = 0, name = '') {
    const existing = this.items.find((it) => it.menuId === menuId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.items.push(new OrderItem(menuId, quantity, unitPrice, name));
    }
  }

  removeItem(index) {
    if (index < 0 || index >= this.items.length) return false;
    this.items.splice(index, 1);
    return true;
  }

  calculateTotal() {
    const satang = this.items.reduce((sum, it) => sum + toSatang(it.unitPrice) * it.quantity, 0);
    return toBaht(satang);
  }
}

function toSatang(baht) {
  return Math.round(Number(baht) * 100);
}

function toBaht(satang) {
  return satang / 100;
}

module.exports = { Order, OrderItem };
