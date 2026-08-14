# Arsis Portal（orchestra-app-1）

Arsis Chamber Orchestra の**運営ポータル**です。ダッシュボード、セッティング表、エキストラ契約、団員情報を一つの画面で扱います。公開サイト（`arsis-site`）とは別アプリで、団の内部運用向けです。

技術スタックは **Next.js 16 / React 19 / TypeScript / Tailwind CSS 4 / Radix UI（shadcn）** です。団員マスタは **Google スプレッドシート**、写真は **Vercel Blob** です。PWA としてインストールできます。

スプレッドシートの詳細手順は [docs/SPREADSHEET_SETUP.md](./docs/SPREADSHEET_SETUP.md) を参照してください。

---

## 1. プロジェクト概要

運営が次をまとめて行うための SPA です。サイドバーで画面を切り替えます。

| 画面 | 内容 |
|---|---|
| ダッシュボード | 公演情報、練習日程、エキストラ枠（ブラウザ localStorage） |
| セッティング表 | 舞台上の座席をドラッグ配置し、画像として書き出し |
| エキストラ契約 | 契約ステータスの一覧・検索（現状は画面内の初期データ） |
| 団員情報 | スプレッドシートと同期した団員マスタ |
| `/mypage` | 団員本人がプロフィールと写真を更新するページ |

---

## 2. フォルダ・ファイル構造

```
orchestra-app-1/
├── app/                      # 画面・API
├── components/               # 機能画面と UI 部品
│   ├── member-portal/        # 団員情報
│   └── ui/                   # shadcn/Radix 部品
├── lib/                      # Sheets 連携など
├── hooks/
├── docs/SPREADSHEET_SETUP.md
└── public/manifest.json
```

### UI・画面関連

| パス | 役割 |
|---|---|
| `app/layout.tsx` | ルートレイアウト。PWA メタ、Toaster、Vercel Analytics |
| `app/page.tsx` | サイドバー付き本体。dashboard / seating / contracts / portal |
| `app/mypage/page.tsx` | 団員マイページ（`?id=` で対象団員を指定） |
| `app/globals.css` | グローバルスタイル |
| `components/sidebar.tsx` | ナビ（モバイルはドロワー） |
| `components/dashboard.tsx` | 公演・練習・カウントダウン。`arsis-dashboard-data` に保存 |
| `components/seating-chart.tsx` | 座席配置。`html2canvas` で書き出し |
| `components/contracts.tsx` | エキストラ契約の一覧・追加・検索 |
| `components/member-portal/index.tsx` | 団員一覧、新規追加、詳細、CSV |
| `components/member-portal/new-member-form.tsx` | 新規団員フォーム |
| `components/member-portal/member-detail-card.tsx` | 団員詳細・写真・公開設定 |
| `components/ui/*` | ボタン、ダイアログ、タブなどの共通部品 |

### ロジック・データ処理関連

| パス | 役割 |
|---|---|
| `lib/sheets.ts` | サービスアカウント認証と Member 行の列定義 |
| `app/api/sheets/members/route.ts` | 団員の一覧取得・追加・更新・削除 |
| `app/api/member/route.ts` | マイページ用の 1 件取得（GET）と部分更新（PATCH） |
| `app/api/upload/photo/route.ts` | 団員写真を Vercel Blob へ保存 |
| `app/api/upload/route.ts` | 汎用ファイルアップロード |
| `components/member-portal/types.ts` | 団員・練習日の型、Sheets ヘッダー行 |
| `lib/utils.ts` | `cn()` などクラス結合 |

ダッシュボードとセッティング表は **localStorage**（`arsis-dashboard-data` / `seating-state-v1`）です。団員マスタだけスプレッドシートが正です。

### 設定・環境関連

| パス | 役割 |
|---|---|
| `docs/SPREADSHEET_SETUP.md` | サービスアカウントとシート ID の設定手順 |
| `next.config.mjs` | PWA プラグイン、画像最適化オフ |
| `public/manifest.json` | PWA マニフェスト |
| `tsconfig.json` | `@/*` パスエイリアス |
| `components.json` | shadcn/ui 設定 |
| `package.json` | `dev` / `build` / `start` / `lint`（webpack） |

環境変数（`.env.local`、Git 管理外）:

| 変数 | 用途 |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | サービスアカウント鍵（JSON を 1 行の文字列で） |
| `GOOGLE_SPREADSHEET_ID` | スプレッドシート ID |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob（`@vercel/blob` が参照） |

シート名は `Member page` または `Members` を探します。

---

## 3. 主要機能

- 次公演までの日数、会場、練習時間の編集
- 練習日程の追加・削除（団員のエキストラ希望と紐付け）
- 楽器別の座席配置、パン・ズーム、画像書き出し
- エキストラ契約のステータス（確認済 / 未確認 / 辞退 / 下書き）
- 団員の検索、パートフィルタ、新規追加、詳細編集、削除
- 写真アップロード（圧縮して Blob へ）とシートの `photoUrl` 更新
- 公開フラグ（公式サイト側で使う `isPublic`）
- `/mypage?id=...` による本人更新（ID は localStorage にも保持）
- PWA（本番ビルド時）

---

## 4. セットアップ・実行手順

### 前提

- Node.js
- Google Cloud のサービスアカウント（Sheets 編集権限）
- 対象スプレッドシートをサービスアカウントのメールと共有

### 1. 依存関係

```bash
cd orchestra-app-1
npm install
```

### 2. 環境変数

プロジェクトルートに `.env.local` を作成します。書き方の詳細は `docs/SPREADSHEET_SETUP.md` です。

```env
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
GOOGLE_SPREADSHEET_ID=あなたのスプレッドシートID
```

写真アップロードを使う場合は Vercel Blob の `BLOB_READ_WRITE_TOKEN` も設定します。

### 3. 開発サーバー

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) が運営ポータル、団員本人は `/mypage?id=団員ID` です。

### 4. 本番ビルド

```bash
npm run build
npm start
```
