// server.js
// Minimal demo server (mock PSP). Node 16+
// npm init -y
// npm i express body-parser uuid

const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// simple in-memory "DB" (for demo)
const payments = {};

// Create payment session
app.post('/create-payment', (req, res) => {
  const { amount, currency, method, user_phone, description } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount required' });

  const paymentId = uuidv4();
  payments[paymentId] = {
    id: paymentId,
    amount,
    currency: currency || 'BDT',
    method: method || 'card',
    description: description || '',
    status: 'created',
    created_at: new Date().toISOString()
  };

  // In real integration: call PSP API to create checkout, get checkout_url or token
  // For demo we simulate a hosted checkout URL
  const checkoutUrl = `http://localhost:3000/mock-checkout/${paymentId}`;

  return res.json({ paymentId, checkoutUrl });
});

// Mock "hosted checkout" page (simulate user paying)
app.get('/mock-checkout/:paymentId', (req, res) => {
  const p = payments[req.params.paymentId];
  if (!p) return res.status(404).send('Payment not found');
  res.send(`
    <h2>Mock Checkout</h2>
    <p>Amount: ${p.amount} ${p.currency}</p>
    <form method="POST" action="/mock-pay/${p.id}">
      <button type="submit">Simulate SUCCESS</button>
    </form>
    <form method="POST" action="/mock-fail/${p.id}">
      <button type="submit">Simulate FAIL</button>
    </form>
  `);
});

// Simulate successful payment and send webhook (in real life PSP calls your webhook)
app.post('/mock-pay/:paymentId', (req, res) => {
  const p = payments[req.params.paymentId];
  if (!p) return res.status(404).send('Payment not found');
  p.status = 'paid';
  p.provider_txn = 'MOCK_TXN_' + Math.floor(Math.random()*100000);
  // Simulate PSP calling our webhook
  setTimeout(() => {
    // In real, PSP will POST to /webhook with signature
    console.log('Simulated webhook: payment paid', p.id);
  }, 500);
  res.send(`<p>Payment marked SUCCESS for ${p.id}. Close this window.</p>`);
});

app.post('/mock-fail/:paymentId', (req, res) => {
  const p = payments[req.params.paymentId];
  if (!p) return res.status(404).send('Payment not found');
  p.status = 'failed';
  res.send(`<p>Payment marked FAILED for ${p.id}. Close this window.</p>`);
});

// Webhook endpoint - real PSP will call this
app.post('/webhook', (req, res) => {
  // Verify signature in real deployment
  const { paymentId, status, provider_txn } = req.body;
  if (!payments[paymentId]) return res.status(404).send('unknown payment');
  payments[paymentId].status = status;
  payments[paymentId].provider_txn = provider_txn;
  console.log('Webhook processed for', paymentId, 'status:', status);
  res.json({ ok: true });
});

app.get('/status/:paymentId', (req, res) => {
  const p = payments[req.params.paymentId];
  if(!p) return res.status(404).json({ error: 'not found' });
  res.json(p);
});

app.listen(3000, () => console.log('Demo server running at http://localhost:3000'));
