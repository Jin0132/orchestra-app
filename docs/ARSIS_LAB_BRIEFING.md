# Arsis 全体把握用指示書（arsis-lab 向け）

この文書は **arsis-lab を書き換えさせるための仕様ではない**。  
Arsis 関連の全体像を把握し、課題を正しい場所へ振り分けるための地図である。  
arsis-lab 自身のコード・画面・シート形式は、そのリポジトリで明示指示があるまで維持する。

貼り付け先の例: `arsis-lab/docs/ARSIS_ECOSYSTEM.md` または `arsis-lab/AGENTS.md` の末尾。

最終確認日: 2026-08-24

---

## 1. あなた（arsis-lab）の役割

Arsis Lab は **AI コックピット**である。ニュースや記事を課題化し、採用 / 保留 / 不採用をスプレッドシートへ記録する。

Target Project の既存コードは次の3つ。

| 表示名 | シート値 | 意味 |
|---|---|---|
| Arsis Portal | `Portal` | 団の内部運営 Web アプリ。リポジトリは `orchestra-app-1`（GitHub: `Jin0132/orchestra-app`） |
| Context Bridge | `Bridge` | 別プロジェクト。この文書では詳細を持たない |
| One Meeting | `OneMeeting` | 別プロジェクト。この文書では詳細を持たない |

Lab は Portal の代わりに団員・会計・書類を管理しない。Portal 向けのアイデアは `Portal` として記録する。

---

## 2. 用語

- **ポータル / Arsis Portal**: 内部運営アプリ（ダッシュボード、タスク、セッティング、契約、団員、書類台帳、マイページ）。公開サイトではない。
- **公開サイト (`arsis-site`)**: 団の対外サイト。マスタブックの `Article` / `config` を使う想定。Portal は読まない。
- **マスタブック**: スプレッドシート『Arsis Chamber Orchestra』。複数タブを持つ。
- **書類台帳**: マスタブックの `Documents` タブ。原本は持たず、URL・分類・要約だけを置く。
- **運営ガイド**: Google ドキュメント『ArsisCO 運営ガイド』。運営ルールの正本。台帳に登録済み。

---

## 3. システム地図

```
arsis-lab（課題の仕分け。Portal / Bridge / OneMeeting）
        │
        ├─ Portal ── orchestra-app-1 ── マスタブック
        │                 │                 ├── Member page     … 団員（Portal が読み書き）
        │                 │                 ├── AppData         … 公演・練習・タスク・契約
        │                 │                 ├── Documents       … 書類の索引
        │                 │                 ├── Article         … 公開サイト用（Portal 未使用）
        │                 │                 └── config          … 公開サイト用（Portal 未使用）
        │                 ├── Drive『Arsis Chamber Orchestra』
        │                 └── Docs『ArsisCO 運営ガイド』
        │
        ├─ Bridge ── Context Bridge（別リポジトリ）
        └─ OneMeeting ── One Meeting（別リポジトリ）

公開サイト arsis-site ── Article / config（Portal とは別アプリ）
```

ホスティング: Portal は Vercel。公開サイトは別デプロイ。

---

## 4. Google 側の正本（2026-08-24 確認）

### 4.1 スプレッドシート『Arsis Chamber Orchestra』

Portal のサービスアカウントから読める。タブは次のとおり。

| タブ | Portal が使うか | 用途 |
|---|---|---|
| Member page | 使う | 団員マスタ |
| AppData | 使う | 公演・練習・タスク・エキストラ契約 |
| Documents | 使う | 書類台帳 |
| Article | 使わない | 公開サイトの記事 |
| config | 使わない | 公開サイトのスイッチ |
| URL集 | 使わない | リンク集 |
| 希望調査フォーム / 問い合わせフォーム | 使わない | フォーム連携 |
| 曲目・編成 | 使わない | 企画テンプレート |
| To do list | 使わない | シート上の作業リスト。Portal のタスク正本は AppData |
| 練習場 / 緊急連絡先 | 使わない | 資産メモ |

**二重管理に注意**: シートの `To do list` と Portal のタスク（`AppData`）は別物。Lab が「タスクを一本化」と提案するときは、どちらを正とするか利用者に確認する。現状の Portal 正本は `AppData`。

### 4.2 ドライブ『Arsis Chamber Orchestra』

Portal の `GOOGLE_DRIVE_FOLDER_ID` が指す親フォルダ。直下は次の3つ。

- 書類（一般）
- 第1回演奏会
- Arsis その他

Portal の「Drive から取り込む」は **直下だけ** を見る。サブフォルダ内のファイルは自動では台帳に載らない。

### 4.3 ドキュメント『ArsisCO 運営ガイド』

- 種類: Google ドキュメント
- URL: https://docs.google.com/document/d/10NZfpK_qB02rDlsvD_CIQ1VKnLBoOmwVhkuTw9ycYMU/edit
- 親フォルダ直下には無いが、サービスアカウントから本文を読める
- **書類台帳に登録済み**（id: `doc-mt5hfgwj-jus6fh`、kind: `doc`、category: `その他`、status: `active`）

運営ルール（謝礼、領収書、会計方針など）が必要なときは、このドキュメントを正とする。リポジトリ内に `operations-guide.md` は無い。

---

## 5. Portal（orchestra-app-1）の現状

スタック: Next.js / TypeScript。GitHub `Jin0132/orchestra-app`。

| 画面 | データの場所 |
|---|---|
| ダッシュボード | AppData |
| タスク | AppData（テンプレートだけ端末の localStorage） |
| 書類 | Documents タブ。クリックで Google 側の原本を開く |
| セッティング表 | ブラウザ localStorage |
| エキストラ契約 | AppData |
| 団員情報 | Member page |
| マイページ `/mypage?id=` | Member page の一部列。写真は Vercel Blob |

認証: サービスアカウント + 任意の `PORTAL_ACCESS_SECRET`。  
Drive / Docs API も同じサービスアカウント。Cursor は Portal 経由ではなく、共有済みファイルへ API で届く。

---

## 6. 守ること（Lab が提案・実装するとき）

1. **口座・振込先は Portal に載せない。** 『奏者支払い先一覧』は別ファイル。マイページは Google フォームへ逃がしている。今の扱いは維持する。
2. **書類の本文を Portal に複製しない。** 台帳は URL と要約。編集は Docs / Sheets / Drive。
3. **NotebookLM の中身は読めない。** URL を台帳に残すだけ。
4. **会計ブック（各回会計、長期シミュレーション）は Portal 未接続。** `#REF!` 修復は別スプレッドシートの作業。Lab が「Portal に会計機能を足す」と自動提案しない。
5. **GAS 前提で Portal を語らない。** Portal は Next.js + googleapis。
6. **この指示書で arsis-lab の UI・シート列・Target Project を変更しない。** 変更は arsis-lab リポジトリでの明示指示が必要。

---

## 7. 課題の振り分け方

利用者がアイデアを出したとき、まず所属を決める。

| 内容 | 振り先 |
|---|---|
| 団員、公演、練習、座席、書類台帳、マイページ | `Portal` |
| 公開サイトの記事・チケット表示 | 公開サイト（`arsis-site`）。Lab の3値に無い場合は記録文面で明記 |
| 会計・送金・領収書 | スプレッドシート / Drive。Portal には載せない |
| 文脈共有・会議まわり | `Bridge` / `OneMeeting`（それぞれのリポジトリの流儀に従う） |
| 「全体を把握したい」「仕分けたい」 | Lab 自身。コード変更は最小 |

Portal 向け採用課題を実装する場所は `orchestra-app-1` であり、arsis-lab ではない。

---

## 8. よくある誤解

- 「スプレッドシートが唯一の DB」→ 座席は localStorage、写真は Blob、書類原本は Drive / Docs。
- 「To do list タブが Portal のタスク」→ 違う。Portal は AppData。
- 「Article / config が Portal 連動」→ 公開サイト側。
- 「運営ガイドを Lab や Portal にコピーすれば正本になる」→ ならない。正本は Google ドキュメント。台帳はその入り口。

---

## 9. この文書の使い方

1. 全体を読んでから、利用者の依頼がどの箱に入るか判断する。
2. Portal の実装詳細が必要なら `orchestra-app-1` の README とコードを読む。
3. 運営ルールが必要なら『ArsisCO 運営ガイド』を読む。
4. 分からない箱（Bridge / OneMeeting / 公開サイト）は推測で実装せず、確認する。
