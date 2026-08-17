# Deployment

## Điều kiện bắt buộc

- Supabase project riêng đã chạy migration.
- `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` được cấu hình khi build/deploy; RLS vẫn là lớp bảo vệ dữ liệu. `NEXT_PUBLIC_SUPABASE_ANON_KEY` chỉ là fallback cho project cũ.
- `SUPABASE_SECRET_KEY` chỉ thêm khi có worker/admin task thật và luôn nằm trong secret manager; web import không cần key này. `SUPABASE_SERVICE_ROLE_KEY` chỉ là fallback legacy.
- HTTPS ở reverse proxy.
- Persistent volume cho `data/` nếu vẫn dùng CSV fallback.
- Backup PostgreSQL và kiểm thử restore.

## Production gate

Không deploy public nếu thiếu Supabase Auth. API import sẽ trả `503` trong production khi Auth chưa cấu hình.

Chạy trước khi deploy:

```bash
npm run verify:production
```

Verifier chỉ kiểm tra cấu hình/migration cần thiết và không in secret. Sau deploy, `GET /api/health` phải trả 200 và `GET /api/readiness` phải trả 200. Nếu readiness trả 503, không chuyển traffic production.

## Build

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

CI tại `.github/workflows/ci.yml` chạy typecheck, lint, unit test và production build trên Node.js 22. Production gate chạy trong môi trường deploy vì CI không giữ credential thật.

## Process split đề xuất

- `affiliate-web`: Next.js UI/API.
- `affiliate-worker`: job nặng và media (khi có).
- `affiliate-scheduler`: snapshot/sync (chỉ khi provider có quyền).

FFmpeg/render không chạy trong request web. Redis/BullMQ chỉ bật khi có worker thật; không hiển thị trạng thái queue giả.
