# LINE HR Leave Starter (Node.js + Express + LIFF)

Build a leave-request bot for LINE Official Account with:
- Messaging API webhook (Node/Express)
- LIFF mini app (leave form in LINE)
- Example Flex message for balances
- ngrok dev tunnel

## Prereqs
- Node.js 18+
- A LINE Messaging API channel (get **Channel ID**, **Channel secret**, and **Channel access token**)
- Recommend: Regenerate secrets if you've shared them publicly.

## Quick Start
1) **Clone/copy** this folder.
2) Install deps:
   ```bash
   npm i
   ```
3) Copy `.env.example` to `.env` and fill:
   ```env
   LINE_CHANNEL_ACCESS_TOKEN=xxx
   LINE_CHANNEL_SECRET=yyy
   PORT=3000
   # After creating LIFF app, set these:
   LIFF_ID=YOUR_LIFF_ID
   BASE_URL=https://your-ngrok-domain.ngrok-free.app
   ```
4) Run server locally:
   ```bash
   npm start
   ```
5) In another terminal, start **ngrok**:
   ```bash
   npx ngrok http 3000
   ```
   Get an https URL like `https://xxxx-xx.ngrok-free.app`.

6) **Webhook URL** in LINE Developers Console → Messaging API:
   - Set: `https://xxxx-xx.ngrok-free.app/webhook`
   - Turn **Use webhook: Enabled**
   - Turn **Auto-reply messages: Off**
   - Press **Verify** → 200 OK

7) **Serve LIFF form** from this server (already mounted):
   - Use LIFF endpoint URL: `https://xxxx-xx.ngrok-free.app/liff/`
   - Create **LIFF app** (size: Tall) and paste endpoint above.
   - Copy the generated **LIFF ID** into `.env` (`LIFF_ID=`).
   - Also set `BASE_URL` in `.env` to your ngrok https origin.

8) Test in chat:
   - Type `ยอดลา` → bot returns placeholder balances.
   - Type `ลา` → bot replies a button to **Open leave form (LIFF)**.
   - Submit the form → server replies OK and pushes a confirmation back to you. (Holidays are a stub; weekends excluded.)

## Folder structure
- `server/index.js` — webhook + APIs + static hosting for LIFF
- `web/index.html` — LIFF leave form (reads LIFF_ID from env-injected data)
- `flex/balance.json` — sample Flex message for balances
- `.env.example` — environment variables
- `package.json` — scripts and deps

## Notes
- This starter stores submitted requests in memory for demo. Replace with a database (Firestore/Supabase/Postgres).
- For production, host on Firebase Functions/Vercel/Render and secure endpoints/validation properly.
