// bank-transfer-demo.js
// npm init -y
// npm i express body-parser uuid multer
// node bank-transfer-demo.js

const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// uploads (for screenshot uploads) - store in ./uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage });

// In-memory store (replace with real DB in production)
const payments = {};

// Config: Sonali account details (আপডেটেড মান)
const SONALI_ACCOUNT = {
  bank: "Sonali Bank",
  branch: "AKKALPUR",                 // আপডেটেড শাখা
  account_number: "0701301000064",    // তোমার দেওয়া অ্যাকাউন্ট নম্বর
  account_name: "MD RASEL"            // অ্যাকাউন্ট হোল্ডারের নাম
};

// Optional: mobile wallet contact (display only)
const MOBILE_WALLET_NUMBER = "01882278234"; // তোমার দেওয়া মোবাইল ওয়ালেট নম্বর

// Create a "bank transfer" payment session
app.post('/create-bank-transfer', (req, res) => {
  const { amount, currency = 'BDT', customer_name, customer_phone } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount required' });

  const pid = uuidv4();
  // Unique short reference for payer to include
  const payRef = 'SB' + Math.floor(100000 + Math.random() * 900000);

  payments[pid] = {
    id: pid,
    amount,
    currency,
    method: 'bank_transfer',
    status: 'pending', // pending until reconciliation
    created_at: new Date().toISOString(),
    payRef,
    sonali: SONALI_ACCOUNT,
    customer_name: customer_name || null,
    customer_phone: customer_phone || null,
    uploaded_screenshots: []
  };

  return res.json({
    payment_id: pid,
    amount,
    currency,
    payRef,
    sonali_account: SONALI_ACCOUNT,
    mobile_wallet: MOBILE_WALLET_NUMBER,
    instructions: `Please transfer ${amount} ${currency} to the above Sonali Bank account (Branch: ${SONALI_ACCOUNT.branch}) and put reference: ${payRef}. After transfer upload screenshot to confirm.`
  });
});

// Upload screenshot (user uploads transfer screenshot)
app.post('/upload-screenshot/:paymentId', upload.single('screenshot'), (req, res) => {
  const p = payments[req.params.paymentId];
  if (!p) {
    if (req.file && req.file.path) fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'payment not found' });
  }
  if (!req.file) return res.status(400).json({ error: 'no file uploaded' });

  p.uploaded_screenshots.push({
    filename: req.file.filename,
    path: `/uploads/${req.file.filename}`,
    uploaded_at: new Date().toISOString()
  });

  return res.json({ ok: true, payment: p });
});

// Check status
app.get('/status/:paymentId', (req, res) => {
  const p = payments[req.params.paymentId];
  if (!p) return res.status(404).json({ error: 'not found' });
  res.json(p);
});

// Admin: mark received (manual reconciliation) — in prod protect with auth
app.post('/admin/mark-received', (req, res) => {
  const { payment_id, provider_txn_id } = req.body;
  const p = payments[payment_id];
  if (!p) return res.status(404).json({ error: 'not found' });
  p.status = 'paid';
  p.provider_txn_id = provider_txn_id || ('BANK_TXN_' + Date.now());
  p.paid_at = new Date().toISOString();
  res.json({ ok: true, payment: p });
});

// Serve uploads for convenience (in prod protect access)
app.use('/uploads', express.static(uploadDir));

// Simple index
app.get('/', (req, res) => {
  res.send('Bank transfer demo server running. Use /create-bank-transfer');
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Bank transfer demo server on port ${PORT}`));
