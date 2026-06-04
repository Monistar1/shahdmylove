# شهد — كل الحب 💜

موقع عيد ميلاد تفاعلي مع سيرفر للرسائل.

## Deploy on Vercel

1. سجل دخول على [vercel.com](https://vercel.com) بحساب GitHub
2. New Project → Import Git Repository
3. Framework Preset: **Other**
4. Deploy!

## Setup KV Database

1. اذهب لـ [Vercel Dashboard](https://vercel.com/dashboard)
2. اختار المشروع → Storage → Create Database → KV
3. اربط KV بالمشروع
4. Redeploy

## API Endpoints

- `GET /api/wishes` — جيب كل الرسائل
- `POST /api/wishes` — ضيف رسالة جديدة
