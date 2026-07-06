# PostBack ✉️

明信片认领互助网站 —— 上传你手上的明信片，帮它找到主人；认领属于你的那一张，收到后确认。

Serverless（Next.js App Router）应用，部署在 **Vercel**：

- **认证**：Casdoor OAuth2（PKCE）接入 `auth.geekpie.club`（GeekPie 统一身份认证），实现方式与 NextDDL 一致
- **数据库**：Postgres（Supabase 或 Neon，`pg` + `DATABASE_URL`）
- **图片存储**：Vercel Blob（客户端直传，绕过 4.5MB 函数体积限制）

## 功能

1. **上传明信片** — 上传正面照片 + 收件人姓名 + 备注（可选）
2. **认领** — 任何登录用户可认领「待认领」的明信片到自己的账户
3. **确认收货** — 认领人收到实物后确认，状态流转：`待认领 → 已认领 → 已收到`
4. **管理记录** — 上传者可修改或删除自己上传的明信片；认领者在确认收到后也可删除记录
5. **关于页面** — 右上角入口，内容来自 `content/about.md`，可用 Markdown 直接维护
6. **重复提醒** — 上传新照片时生成多变体 pHash 感知指纹，提示可能是同一张明信片的相似照片
7. **账户匹配** — 用户可维护多个常用收件名，自动汇总疑似属于自己的待认领明信片

## 技术栈

Next.js 16 · React 19 · TypeScript · Tailwind CSS 3 · Postgres(`pg`) · `@vercel/blob`

## 目录结构

```
app/
  layout.tsx / globals.css        全局布局与样式
  page.tsx + home-client.tsx      明信片广场（列表 + 认领）
  upload/                         上传页（Blob 客户端直传）
  mine/                           我的（我认领的 / 我上传的 + 确认收货）
  account/                        我的账户（收件名维护 + 待认领匹配）
  about/                          关于页（渲染 content/about.md）
  login/                          登录页（发起 Casdoor PKCE）
  auth/callback/                  OAuth 回调（换 token → 建会话）
  api/
    casdoor-session/  logout/  me/   认证会话
    blob/upload/                     Blob 上传令牌（handleUpload）
    account/                         账户收件名保存
    postcards/                       列表 GET / 创建 POST / 单条 PATCH、DELETE
    postcards/duplicates/            多变体 pHash 感知指纹疑似重复检测
    postcards/[id]/claim/            认领
    postcards/[id]/receive/          确认收货
components/                        Nav、明信片卡片、退出按钮
lib/                              db / auth / types / public-origin
content/about.md                  关于页 Markdown 内容
app/favicon.ico                    网站图标
proxy.ts                         未登录拦截（Next 16 proxy 约定）
scripts/init.sql                 建表 SQL
```

## 本地开发

需要 Node 20+ 和 pnpm（或 npm）。

```bash
pnpm install                 # 或 npm install
cp .env.example .env.local   # 填入下方环境变量
psql "$DATABASE_URL" -f scripts/init.sql   # 初始化数据库表
pnpm dev                     # http://localhost:3000
```

## 环境变量

见 `.env.example`。关键项：

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | Postgres 连接串。**serverless 用连接池串**：Supabase 选 Transaction 模式（`…pooler.supabase.com:6543`），Neon 用 `…-pooler.…neon.tech` |
| `PUBLIC_BASE_URL` | 站点地址，本地 `http://localhost:3000`，线上填生产域名 |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 读写令牌（Vercel 上自动注入，本地用 `vercel env pull` 获取） |
| `NEXT_PUBLIC_CASDOOR_SERVER_URL` | `https://auth.geekpie.club` |
| `NEXT_PUBLIC_CASDOOR_CLIENT_ID` | Casdoor 应用 Client ID |
| `NEXT_PUBLIC_CASDOOR_REDIRECT_URI` | `<站点地址>/auth/callback`（需在 Casdoor 应用里登记） |
| `NEXT_PUBLIC_CASDOOR_SIGNIN_URL` | `https://auth.geekpie.club/login/oauth/authorize` |
| `NEXT_PUBLIC_CASDOOR_SCOPE` | 默认 `openid profile email` |

> `NEXT_PUBLIC_*` 在构建时内联，改动后需重新构建/部署。

## 部署到 Vercel

1. **数据库**：用 [Supabase](https://supabase.com)（或 [Neon](https://neon.tech)）新建项目，拿到**连接池**串
   （Supabase 选 Transaction 模式的 `…pooler.supabase.com:6543`）；把 `scripts/init.sql`
   贴进 Supabase SQL Editor 跑一遍建表。
   已有数据库也可以重复执行，脚本会补齐 `image_hash`、`pickup_location`、`recipient_names` 等新增字段。
2. **Blob**：Vercel 项目 → Storage → 新建 Blob Store（会自动注入 `BLOB_READ_WRITE_TOKEN`）。
3. **Casdoor**：在 `auth.geekpie.club` 新建/配置应用，勾选 `Authorization Code` + PKCE，
   在 Redirect URLs 里加入生产与本地两个 `…/auth/callback`。
4. **导入仓库**：Vercel Import → 选择本仓库，把上表所有变量填入
   Settings → Environment Variables。
5. Deploy。首次部署后，把 `PUBLIC_BASE_URL` 与 `NEXT_PUBLIC_CASDOOR_REDIRECT_URI`
   更新为正式域名并重新部署。

## 认证流程（与 NextDDL 一致）

`/login` 生成 PKCE `code_verifier/challenge` → 跳转 Casdoor 授权 →
`/auth/callback` 用 `code` 换 `access_token`、拉 `userinfo` →
`POST /api/casdoor-session` 落库 upsert 用户、建 session、写 `httpOnly` cookie →
`proxy.ts` 拦截未登录访问，`lib/auth.getCurrentUser()` 读 cookie 校验会话。
