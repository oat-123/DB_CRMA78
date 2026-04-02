# CRMA78 Student Search

เว็บแอปสำหรับค้นหาข้อมูลนักเรียนจากไฟล์ CSV ของ Google Sheets ด้วย React + Vite

## Requirements

- Node.js 18+ (แนะนำ 20+)
- npm 9+

## Setup

1. ติดตั้ง dependencies
   - `npm install`
2. สร้างไฟล์ env
   - คัดลอก `.env.example` เป็น `.env`
3. กำหนดค่า `VITE_SHEET_CSV_URL` ให้ชี้ไปยัง Google Sheets CSV URL ที่ใช้งานจริง
4. หากต้องการบันทึกการแก้ไขกลับชีทจริง ให้กำหนด `VITE_SHEET_UPDATE_URL` เป็น URL ของ Apps Script Web App

## Commands

- รันโหมดพัฒนา: `npm run dev`
- สร้าง production build: `npm run build`
- พรีวิว build: `npm run preview`
- รัน lint: `npm run lint`
- แก้ lint อัตโนมัติ: `npm run lint:fix`
- รัน test: `npm run test`
- รัน test watch: `npm run test:watch`
- จัดรูปแบบโค้ด: `npm run format`
- ตรวจรูปแบบโค้ด: `npm run format:check`

## Data Schema (ขั้นต่ำ)

ระบบรองรับคอลัมน์ภาษาไทยเหล่านี้ (หากหายบางช่อง ระบบยังแสดง fallback ได้):

- `ลำดับที่`
- `รหัส นตท.`
- `คำนำหน้า`
- `ชื่อ`
- `นามสกุล`
- `ชื่อเล่น`
- `ชื่อค้นหา`
- `ภูมิลำเนาเดิม`
- `วัน/เดือน/ปีเกิด`
- `อายุ`
- `หมายเลขโทรศัพท์`
- `สถานศึกษาก่อนเข้า รร.ตท.`
- `กรุ๊บเลือด`
- `ศาสนา`

## Pre-Deploy Checklist

- ตั้งค่า `.env` สำหรับ environment ปลายทางถูกต้อง
- `npm run lint` ผ่าน
- `npm run test` ผ่าน
- `npm run build` ผ่าน
- ตรวจการค้นหาจริงด้วยชื่อ, รหัส, ชื่อเล่น
- ตรวจเคสโหลดช้า/ล้มเหลว ว่าปุ่ม `ลองใหม่` ใช้งานได้

## Troubleshooting

- ถ้าโหลดข้อมูลไม่ได้ ให้ตรวจว่า URL ของ Google Sheet เป็นแบบ public และเข้าถึง CSV ได้จริง
- ถ้าไม่พบข้อมูลแม้มีชื่ออยู่ในชีต ให้ตรวจชื่อคอลัมน์ตรงตาม schema
- ถ้า build ล้มเหลวหลังอัปเดตแพ็กเกจ ให้ลบ `node_modules` และติดตั้งใหม่ด้วย `npm install`

## Realtime และการบันทึกข้อมูล

- แอปจะรีเฟรชข้อมูลอัตโนมัติทุก `VITE_REFRESH_INTERVAL_MS` มิลลิวินาที (ค่าเริ่มต้น 10000)
- การกดบันทึกในหน้า `/backend` จะส่ง `POST` ไปที่ `VITE_SHEET_UPDATE_URL` ด้วย payload:
  - `sourceCsvUrl`: URL ของชีทหลัก
  - `studentKey`: key รูปแบบ `ลำดับที่-รหัส`
  - `raw`: object ข้อมูลทุกฟิลด์ของนักเรียนที่แก้ไข
- ถ้าไม่ตั้ง `VITE_SHEET_UPDATE_URL` ระบบจะยังแก้ไขในหน้าเว็บได้ แต่ไม่เขียนกลับไปฐานข้อมูลจริง
