# Arsis Portal（orchestra-app-1）

Arsis Chamber Orchestra の**運営ポータル**です。ダッシュボード、セッティング表、エキストラ契約、団員情報を一つの画面で扱います。公開サイト（`arsis-site`）とは別アプリで、団の内部運用向けです。

| 項目 | 内容 |
|---|---|
| スタック | Next.js 16 / React 19 / TypeScript / Tailwind CSS 4 / Radix UI（shadcn） |
| 団員マスタ | Google スプレッドシート |
| 写真 | Vercel Blob |
| その他データ | ブラウザ localStorage（ダッシュボード・座席・契約） |
| PWA | 本番ビルド時のみ有効 |
| 任意の保護 | `PORTAL_ACCESS_SECRET` で運営画面をパスワード保護 |

スプレッドシートの詳細手順は [docs/SPREADSHEET_SETUP.md](./docs/SPREADSHEET_SETUP.md) を参照してください。

---

## 1. 画面構成

サイドバーで画面を切り替えます（`app/page.tsx`）。`PORTAL_ACCESS_SECRET` 設定時は入室パスワードが必要です。

| 画面 / パス | 内容 | データの保存先 |
|---|---|---|
| ダッシュボード | 公演情報、練習日程、エキストラ枠、関連書類 | Google スプレッドシート（`AppData` / `Documents`） |
| タスク管理 | 運営タスク・演奏会・書類紐づけ | 同上 |
| 書類 | Docs / Sheets / Drive / NotebookLM の台帳・検索 | `Documents` シート。原本は Google |
| セッティング表 | 舞台上の座席をドラッグ配置し、画像書き出し | `localStorage`（`seating-state-v1`） |
| エキストラ契約 | 契約ステータスの一覧・検索・追加・CSV | Google スプレッドシート（`AppData`） |
| 団員情報 | 検索・追加・編集・削除・CSV・写真 | Google スプレッドシート |
| `/mypage?id=団員ID` | 本人のプロフィール・写真更新（パスワード不要） | 同上（更新可能な列は限定） |

ダッシュボード上の「エキストラ枠」と「エキストラ契約」画面は**別系統**です。団員マスタだけがスプレッドシートを正とします。

---

## 2. フォルダ構成

```
orchestra-app-1/
├── app/
│   ├── page.tsx                 # 運営ポータル本体（4画面）
│   ├── mypage/page.tsx          # 団員マイページ
│   ├── layout.tsx
│   └── api/
│       ├── auth/                # ポータル入室セッション
│       ├── sheets/members/      # 団員 CRUD（保護対象）
│       ├── documents/           # 書類台帳・Drive / Docs
│       ├── member/              # マイページ用 GET / PATCH
│       └── upload/              # 写真アップロード（Vercel Blob）
├── components/
│   ├── portal-auth-gate.tsx
│   ├── sidebar.tsx / dashboard.tsx / seating-chart.tsx / contracts.tsx / documents.tsx
│   ├── member-portal/
│   └── ui/
├── lib/
│   ├── sheets.ts                # Sheets 認証・ヘッダー基準の読み書き
│   ├── documents.ts             # 書類台帳
│   ├── google-auth.ts           # Sheets / Drive / Docs 共通認証
│   ├── google-workspace.ts      # Drive 一覧・Docs 作成
│   ├── api-auth.ts              # ポータル認証
│   └── upload.ts                # アップロード検証
├── hooks/use-media-query.ts / use-documents.ts
├── docs/SPREADSHEET_SETUP.md
├── docs/DOCUMENTS_SETUP.md
└── public/manifest.json
```

### 主な API

| パス | 用途 | 備考 |
|---|---|---|
| `GET/POST /api/auth` | 入室状態確認・パスワードログイン | `DELETE` でログアウト |
| `GET/POST/PATCH/DELETE /api/sheets/members` | 運営側の団員 CRUD | `PORTAL_ACCESS_SECRET` 設定時は要ログイン |
| `GET/POST/PATCH/DELETE /api/documents` | 書類台帳 CRUD | 同上。原本は動かさない |
| `POST /api/documents/inspect` | URL から題名・種類・要約案 | Drive / Docs API |
| `GET /api/documents/drive` | 共有フォルダの未登録ファイル | Drive API |
| `POST /api/documents/create` | 共有フォルダに Docs を新規作成 | Docs / Drive API |
| `GET/PATCH /api/member` | マイページ用 | ID 指定。ポータルパスワードは不要 |
| `POST /api/upload/photo` | 運営側の写真 | 要ログイン（秘密設定時）・画像のみ・5MB 以下 |
| `POST /api/upload` | マイページ写真 | 画像のみ・5MB 以下 |

---

## 3. 環境変数

プロジェクトルートの `.env.local`（Git 管理外）に設定します。

| 変数 | 必須 | 用途 |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | 団員機能 | サービスアカウント鍵（JSON を 1 行） |
| `GOOGLE_SPREADSHEET_ID` | 団員・書類台帳 | 対象スプレッドシート ID |
| `GOOGLE_DRIVE_FOLDER_ID` | 任意 | 書類の共有フォルダ。未設定時はマイページと同じフォルダ |
| `BLOB_READ_WRITE_TOKEN` | 写真 | Vercel Blob |
| `PORTAL_ACCESS_SECRET` | 任意 | 設定すると運営ポータルと団員 CRUD API をパスワード保護 |

**シート名**: `Member page` → `Members` の順で探します（完全一致）。

**推奨ヘッダー（1 行目）**:

```
id,isPublic,name,part,partRank,role,email,status,profile,instagram,extraRequestStatus,requestedPracticeIds,instrument,joinYear,attendance,photoUrl,updatedAt
```

読み書きは**列名ベース**です。列の順序を変えても動作しますが、ヘッダー名は揃えてください。

サービスアカウントの `client_email` を対象スプレッドシートに**編集者**として共有してください。

---

## 4. セットアップ・実行

```bash
cd orchestra-app-1
npm install
```

`.env.local` の例:

```env
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
GOOGLE_SPREADSHEET_ID=あなたのスプレッドシートID
BLOB_READ_WRITE_TOKEN=vercel_blob_...
# 任意: 運営ポータルをパスワード保護
# PORTAL_ACCESS_SECRET=十分な長さのランダム文字列
```

```bash
npm run dev
```

- 運営ポータル: [http://localhost:3000](http://localhost:3000)
- 団員マイページ: [http://localhost:3000/mypage?id=団員ID](http://localhost:3000/mypage?id=団員ID)

```bash
npm run build
npm start
```

`.env.local` 変更後は開発サーバーを再起動してください。

---

## 5. 主要機能

- 次公演までの日数・会場・練習時間の編集
- 練習日程の追加・削除（団員のエキストラ希望と紐付け）
- 楽器別の座席配置、パン・ズーム、画像書き出し
- エキストラ契約のステータス管理と CSV エクスポート（ブラウザ保存）
- 団員の検索、パートフィルタ、新規追加、詳細編集、削除、CSV
- 写真アップロードと `photoUrl` 更新
- 公開フラグ `isPublic`
- 書類台帳（検索・分類・公演紐づけ・Drive 取り込み・Docs 新規作成）
- `/mypage?id=...` による本人更新
- PWA（本番ビルド時）
- 任意のポータルパスワード保護

---

## 6. セキュリティ上の注意

- `PORTAL_ACCESS_SECRET` 未設定時は、団員 API が URL を知る人から呼べます（内部ネットワーク / Vercel Deployment Protection 前提）。
- `/mypage` と `/api/member` は団員 ID を知っていれば更新可能です（security by obscurity）。本番で厳格に守る場合は別途認証が必要です。
- サービスアカウント鍵と Blob トークンは Git に含めないでください。

---

## 7. 関連ドキュメント

- [docs/SPREADSHEET_SETUP.md](./docs/SPREADSHEET_SETUP.md) — サービスアカウント・シート ID・トラブルシュート
- [docs/DOCUMENTS_SETUP.md](./docs/DOCUMENTS_SETUP.md) — Drive / Docs API と共有フォルダ
- [docs/ARSIS_LAB_BRIEFING.md](./docs/ARSIS_LAB_BRIEFING.md) — arsis-lab 向け全体把握（貼り付け用。lab を書き換えない）
