-- =====================================================================
-- Pad-Krapow-cafe-system : Database Schema (MySQL 8.0+ / MariaDB 10.5+)
-- เวอร์ชัน 2 (สัปดาห์ที่ 13) — ปรับจาก wk07 เดิม ดูรายการเปลี่ยนแปลงท้ายไฟล์
-- =====================================================================

CREATE DATABASE IF NOT EXISTS pad_krapow_cafe
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pad_krapow_cafe;

CREATE TABLE category (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE branch (
  branch_id INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(100) NOT NULL,
  address   VARCHAR(255)
);

CREATE TABLE employee (
  employee_id   INT AUTO_INCREMENT PRIMARY KEY,
  branch_id     INT NOT NULL,
  name          VARCHAR(100) NOT NULL,
  role          VARCHAR(20)  NOT NULL,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,           -- bcrypt hash (NFR-03)
  CONSTRAINT fk_employee_branch FOREIGN KEY (branch_id) REFERENCES branch(branch_id),
  CONSTRAINT chk_employee_role CHECK (role IN ('barista', 'owner'))
);

CREATE TABLE menu_item (
  menu_id             INT AUTO_INCREMENT PRIMARY KEY,
  branch_id           INT NOT NULL,
  category_id         INT NOT NULL,
  name                VARCHAR(100)  NOT NULL,
  price               DECIMAL(10,2) NOT NULL,
  stock_quantity      INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 10,    -- จำนวนขั้นต่ำสำหรับแจ้งเตือน (FR-05)
  is_active           TINYINT(1) NOT NULL DEFAULT 1, -- ลบแบบ soft delete เพื่อไม่ให้ประวัติการขายหาย
  CONSTRAINT fk_menu_branch   FOREIGN KEY (branch_id)   REFERENCES branch(branch_id),
  CONSTRAINT fk_menu_category FOREIGN KEY (category_id) REFERENCES category(category_id),
  CONSTRAINT chk_menu_price     CHECK (price >= 0),
  CONSTRAINT chk_menu_stock     CHECK (stock_quantity >= 0),
  CONSTRAINT chk_menu_threshold CHECK (low_stock_threshold >= 0)
);

CREATE TABLE orders (
  order_id       INT AUTO_INCREMENT PRIMARY KEY,
  branch_id      INT NOT NULL,
  employee_id    INT NOT NULL,
  payment_method VARCHAR(20)   NOT NULL,
  total_amount   DECIMAL(10,2) NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_branch   FOREIGN KEY (branch_id)   REFERENCES branch(branch_id),
  CONSTRAINT fk_orders_employee FOREIGN KEY (employee_id) REFERENCES employee(employee_id),
  CONSTRAINT chk_orders_payment CHECK (payment_method IN ('cash', 'transfer', 'promptpay')),
  CONSTRAINT chk_orders_total   CHECK (total_amount >= 0),
  INDEX idx_orders_branch_date (branch_id, created_at)
);

CREATE TABLE order_item (
  order_item_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id      INT NOT NULL,
  menu_id       INT NOT NULL,
  quantity      INT NOT NULL,
  unit_price    DECIMAL(10,2) NOT NULL,          -- ราคา ณ เวลาที่ขาย
  CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_item_menu  FOREIGN KEY (menu_id)  REFERENCES menu_item(menu_id),
  CONSTRAINT chk_item_quantity CHECK (quantity > 0),
  CONSTRAINT chk_item_price    CHECK (unit_price >= 0)
);

CREATE TABLE stock_movement (
  movement_id     INT AUTO_INCREMENT PRIMARY KEY,
  menu_id         INT NOT NULL,
  order_id        INT NULL,                       -- มีค่าเมื่อ reason = 'sale'
  quantity_change INT NOT NULL,                   -- ติดลบ = ตัดออก, บวก = เติมเข้า
  reason          VARCHAR(20) NOT NULL,
  moved_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_movement_menu  FOREIGN KEY (menu_id)  REFERENCES menu_item(menu_id),
  CONSTRAINT fk_movement_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  CONSTRAINT chk_movement_reason CHECK (reason IN ('sale', 'restock', 'adjust')),
  CONSTRAINT chk_movement_nonzero CHECK (quantity_change <> 0)
);

-- ---------------------------------------------------------------------
-- รายการเปลี่ยนแปลงจาก wk07 เดิม (บันทึกไว้เพื่อ traceability)
--  1. employee  : เพิ่ม username, password_hash (รองรับ login + NFR-03 bcrypt)
--                 และ CHECK role ให้เป็น 'barista' หรือ 'owner'
--  2. menu_item : เพิ่ม low_stock_threshold (FR-05) และ is_active (soft delete)
--                 เพิ่ม CHECK ราคา/สต็อกไม่ติดลบ
--  3. orders    : เพิ่ม total_amount (FR-02) และ CHECK payment_method (FR-03)
--                 เพิ่ม index (branch_id, created_at) สำหรับรายงาน
--  4. order_item: เพิ่ม CHECK quantity > 0 และ unit_price >= 0
--  5. stock_movement: เพิ่ม order_id และ reason เพื่อให้ตรวจย้อนได้ว่าสต็อกเปลี่ยนเพราะอะไร
-- ---------------------------------------------------------------------
