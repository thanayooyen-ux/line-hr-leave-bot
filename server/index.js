import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client, middleware } from '@line/bot-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Config ----
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
if (!config.channelAccessToken || !config.channelSecret) {
  console.error('Missing LINE credentials in .env / Render Environment');
  process.exit(1);
}
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const LIFF_ID = process.env.LIFF_ID || '';

// ---- App ----
const app = express();
app.use(express.json());
app.use('/liff', express.static(path.join(__dirname, '../web')));

// ✅ สำหรับปุ่ม Verify ของ LINE (ยิง GET /webhook ต้องตอบ 200)
app.get('/webhook', (req, res) => {
  res.status(200).send('OK');
});

// Inject env into LIFF page
app.get('/liff/env.js', (_, res) => {
  res
    .type('application/javascript')
    .send(
      `window.__LIFF_ENV__ = { LIFF_ID: ${JSON.stringify(
        LIFF_ID
      )}, BASE_URL: ${JSON.stringify(BASE_URL)} };`
    );
});

// LINE webhook (ข้อความจริงจะมาด้วย POST)
const client = new Client(config);
app.post('/webhook', middleware(config), async (req, res) => {
  // Log เพื่อดีบักว่า LINE ยิงมาถึงหรือไม่
  try {
    console.log(
      'Webhook events:',
      JSON.stringify(req.body?.events || [], null, 2)
    );
  } catch (_) {}
  const events = req.body.events || [];
  await Promise.all(events.map(handleEvent));
  res.sendStatus(200);
});

// ---- Event handler ----
async function handleEvent(ev) {
  if (ev.type === 'message' && ev.message.type === 'text') {
    const raw = ev.message.text || '';
    const text = raw.normalize('NFC').trim();

    // คำสั่งดูสรุปวันลา
    if (text.startsWith('ยอดลา')) {
      const flex = await import('../flex/balance.json', {
        assert: { type: 'json' },
      }).then((m) => m.default);
      return client.replyMessage(ev.replyToken, [
        { type: 'text', text: 'สรุปวันลาคงเหลือของคุณ (ตัวอย่าง):' },
        { type: 'flex', altText: 'สรุปวันลาคงเหลือ', contents: flex },
      ]);
    }

    // คำสั่งยื่นลา — ยืดหยุ่นขึ้น (รองรับ "ขอลา" หรือมีคำว่า ลา แบบคำเดี่ยว)
    if (text === 'ลา' || text.includes('ขอลา') || /\bลา\b/.test(text)) {
      const url = `${BASE_URL}/liff/`;
      return client.replyMessage(ev.replyToken, {
        type: 'template',
        altText: 'แบบฟอร์มยื่นลา',
        template: {
          type: 'buttons',
          title: 'ยื่นลางาน',
          text: 'กรอกข้อมูลใน LIFF',
          actions: [{ type: 'uri', label: 'เปิดแบบฟอร์ม', uri: url }],
        },
      });
    }

    // default echo (กันเงียบ)
    return client.replyMessage(ev.replyToken, {
      type: 'text',
      text: `คุณพิมพ์: ${text}`,
    });
  }

  if (ev.type === 'postback') {
    // ที่นี่รองรับ workflow อนุมัติ/ปฏิเสธในอนาคต
    return Promise.resolve();
  }

  return Promise.resolve();
}

// ---- API: ฟอร์ม LIFF ส่งคำขอลา (เดโม) ----
app.post('/api/leave', async (req, res) => {
  const { userId, type, startDate, endDate, reason } = req.body || {};
  if (!userId || !type || !startDate || !endDate) {
    return res.status(400).json({ ok: false, error: 'missing fields' });
  }
  const days = businessDaysBetween(startDate, endDate);
  try {
    await client.pushMessage(userId, {
      type: 'text',
      text: `คำขอลาได้รับแล้ว\nประเภท: ${type}\nช่วง: ${startDate} → ${endDate} (${days} วันทำงาน)\nเหตุผล: ${reason || '-'}\n(ตัวอย่างเดโม)`,
    });
  } catch (e) {
    console.error('push failed', e);
  }
  return res.json({ ok: true, days });
});

// Helper: นับวันทำงาน (ตัดเสาร์-อาทิตย์; วันหยุดราชการเติมใน HOLIDAYS)
const HOLIDAYS = []; // e.g. ['2025-12-05', '2025-12-10']
function businessDaysBetween(startStr, endStr) {
  const s = new Date(startStr),
    e = new Date(endStr);
  if (isNaN(s) || isNaN(e) || e < s) return 0;
  const fmt = (d) => d.toISOString().slice(0, 10);
  const isWeekend = (d) => [0, 6].includes(d.getDay());
  let count = 0,
    cur = new Date(s);
  while (cur <= e) {
    const day = fmt(cur);
    if (!isWeekend(cur) && !HOLIDAYS.includes(day)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// Health check
app.get('/', (_, res) => res.send('OK'));

// Start
app.listen(PORT, () =>
  console.log(`Listening on ${PORT}. Public base: ${BASE_URL}`)
);