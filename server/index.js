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
  console.error('Missing LINE credentials in .env');
  process.exit(1);
}
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const LIFF_ID = process.env.LIFF_ID || '';

// ---- App ----
const app = express();
app.use(express.json());
app.use('/liff', express.static(path.join(__dirname, '../web')));

// Inject env into LIFF page
app.get('/liff/env.js', (_, res) => {
  res.type('application/javascript').send(`window.__LIFF_ENV__ = { LIFF_ID: ${JSON.stringify(LIFF_ID)}, BASE_URL: ${JSON.stringify(BASE_URL)} };`);
});

// LINE webhook
const client = new Client(config);
app.post('/webhook', middleware(config), async (req, res) => {
  const events = req.body.events || [];
  await Promise.all(events.map(handleEvent));
  res.sendStatus(200);
});

async function handleEvent(ev) {
  if (ev.type === 'message' && ev.message.type === 'text') {
    const text = (ev.message.text || '').trim();
    if (/^ยอดลา/.test(text)) {
      // reply sample flex or text
      const flex = await import('../flex/balance.json', { assert: { type: 'json' } }).then(m => m.default);
      return client.replyMessage(ev.replyToken, [
        { type: 'text', text: 'สรุปวันลาคงเหลือของคุณ (ตัวอย่าง):' },
        { type: 'flex', altText: 'สรุปวันลาคงเหลือ', contents: flex }
      ]);
    }
    if (/^ลา$/.test(text) || /ขอลา/.test(text)) {
      // Reply LIFF link
      const url = `${BASE_URL}/liff/`;
      return client.replyMessage(ev.replyToken, {
        type: 'template',
        altText: 'แบบฟอร์มยื่นลา',
        template: {
          type: 'buttons',
          title: 'ยื่นลางาน',
          text: 'กรอกข้อมูลใน LIFF',
          actions: [{ type: 'uri', label: 'เปิดแบบฟอร์ม', uri: url }]
        }
      });
    }
    // default echo
    return client.replyMessage(ev.replyToken, { type: 'text', text: `คุณพิมพ์: ${text}` });
  }

  if (ev.type === 'postback') {
    // TODO: handle approvals postback
    return Promise.resolve();
  }

  return Promise.resolve();
}

// Simple API for LIFF form submission (demo only)
app.post('/api/leave', async (req, res) => {
  const { userId, type, startDate, endDate, reason } = req.body || {};
  if (!userId || !type || !startDate || !endDate) {
    return res.status(400).json({ ok: false, error: 'missing fields' });
  }
  const days = businessDaysBetween(startDate, endDate);
  // Push confirmation to user
  try {
    await client.pushMessage(userId, {
      type: 'text',
      text: `คำขอลาได้รับแล้ว\nประเภท: ${type}\nช่วง: ${startDate} → ${endDate} (${days} วันทำงาน)\nเหตุผล: ${reason || '-'}\n(ตัวอย่างเดโม)`
    });
  } catch (e) {
    console.error('push failed', e);
  }
  return res.json({ ok: true, days });
});

// Business-days helper (exclude weekends; holidays stub)
const HOLIDAYS = []; // TODO: fill with YYYY-MM-DD strings for TH public holidays
function businessDaysBetween(startStr, endStr) {
  const s = new Date(startStr), e = new Date(endStr);
  if (isNaN(s) || isNaN(e) || e < s) return 0;
  const fmt = (d) => d.toISOString().slice(0,10);
  const isWeekend = (d) => [0,6].includes(d.getDay());
  let count = 0, cur = new Date(s);
  while (cur <= e) {
    const day = fmt(cur);
    if (!isWeekend(cur) && !HOLIDAYS.includes(day)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

app.get('/', (_, res) => res.send('OK'));
app.listen(PORT, () => console.log(`Listening on ${PORT}. Public base: ${BASE_URL}`));
