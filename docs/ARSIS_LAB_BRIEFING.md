# Arsis 全体把握用指示書（正本）

この文書は **Arsis エコシステム全体の正本**である。  
`arsis-lab` の `/map` はここから要約した閲覧用ページ。内容を更新するときは **まずこのファイルを直し、地図は後から追従**する。

arsis-lab の仕分け UI のコード・シート形式は、明示指示があるまで維持する。

最終確認日: 2026-08-24

---

## 1. 対象プロジェクト（5箱）

| 箱 | リポジトリ | 役割 |
|---|---|---|
| **Arsis Lab** | `arsis-lab` | 全体地図（`/map`）＋ 仕分け UI（`/`・保管） |
| **Arsis Portal** | `orchestra-app-1`（GitHub: `Jin0132/orchestra-app`） | 団の内部運営 Web |
| **setting-app** | `setting-app` | オーケストラ・セッティング表（独立）。将来 Portal のセッティング表タブと入れ替え |
| **公開サイト** | `arsis-site` | 対外サイト。Article / config |
| **Context Bridge** | 別リポジトリ | 文脈共有 |

**地図の範囲外**: One Meeting など、上記5箱に含めないプロジェクトは各リポジトリの流儀に従う（Lab の Target 値 `OneMeeting` はレガシーとしてコードに残る場合あり）。

---

## 2. Arsis Lab の現状

| 項目 | 内容 |
|---|---|
| 主用途 | `/map` — 全体把握（要約表示） |
| 保管 | `/` — AI 仕分け UI。完成済みだが当面停止・機能追加しない |
| 書き込み先 | **別スプレッドシート**（`GOOGLE_SHEET_ID`）。課題バックログ用 |
| マスタブックとの関係 | **別物**。マスタブックは Portal / 公開サイトの運用正本。Lab バックログを混ぜない |

Target Project（仕分け UI・レガシー）:

| 表示名 | シート値 | 意味 |
|---|---|---|
| Arsis Portal | `Portal` | 内部運営 |
| Context Bridge | `Bridge` | 別プロジェクト |
| One Meeting | `OneMeeting` | 地図範囲外（レガシー） |

Lab は Portal の代わりに団員・会計・書類を管理しない。

---

## 3. 用語

- **ポータル / Arsis Portal**: 内部運営（ダッシュボード、タスク、セッティング表タブ、契約、団員、書類台帳、マイページ）。公開サイトではない。
- **setting-app**: セッティング表の新実装。localStorage。Portal 内タブより高機能。統合予定。
- **公開サイト (`arsis-site`)**: 対外サイト。マスタブックの `Article` / `config`。Portal は読まない。
- **マスタブック**: スプレッドシート『Arsis Chamber Orchestra』。Portal / 公開サイトの運用データ正本。
- **書類台帳**: マスタブックの `Documents` タブ。URL・分類・要約のみ。
- **運営ガイド**: Google ドキュメント『ArsisCO 運営ガイド』。運営ルールの正本。

---

## 4. システム地図

```
arsis-lab
  ├─ /map … 全体地図（要約・主用途）
  └─ / … 仕分け UI（保管・停止）

Portal ── orchestra-app-1 ── マスタブック
  │                 ├── Member page / AppData / Documents
  │                 ├── Article / config … 公開サイト用（Portal 未使用）
  │                 ├── Drive『Arsis Chamber Orchestra』
  │                 ├── Docs『ArsisCO 運営ガイド』
  │                 └── セッティング表タブ（localStorage・seating-state-v1）
  │                       ↓ 将来
setting-app ── セッティング表（localStorage・orchestra-setting-configs-v2）
                → Portal 内タブへ統合予定

公開サイト arsis-site ── Article / config

Context Bridge ── 文脈共有（別リポジトリ）
```

ホスティング: Portal は Vercel。公開サイト・setting-app は別デプロイ。

---

## 5. setting-app（2026-08-24 確認）

| 項目 | 内容 |
|---|---|
| 目的 | コンサートのステージ上で椅子・譜面台・指揮台を配置 |
| 保存 | ブラウザ localStorage（`orchestra-setting-configs-v2` 等）。Git に載らない |
| バックアップ | JSON ダウンロード / `#import=` URL 共有 |
| Portal との関係 | Portal のセッティング表タブ（`seating-chart.tsx`・localStorage）を **将来置き換え** |
| マスタブック | 未連携。統合時に AppData 等へ載せるか要設計 |

主な機能: 配置テンプレート、ホール図面重ね、PNG/SVG/PDF 書き出し、Undo、パン/ズーム。

---

## 6. Google 側の正本

### 6.1 スプレッドシート『Arsis Chamber Orchestra』（マスタブック）

Portal のサービスアカウントから読める。

| タブ | Portal | 用途 |
|---|---|---|
| Member page | 使う | 団員マスタ |
| AppData | 使う | 公演・練習・タスク・エキストラ契約 |
| Documents | 使う | 書類台帳 |
| Article | 使わない | 公開サイトの記事 |
| config | 使わない | 公開サイトのスイッチ |
| URL集 / フォーム / 曲目・編成 / 練習場 / 緊急連絡先 | 使わない | 参照・メモ |
| To do list | 使わない | シート上リスト。Portal タスク正本は AppData |

**Lab バックログ用シート**（`GOOGLE_SHEET_ID`）はマスタブックとは別 ID。

### 6.2 ドライブ『Arsis Chamber Orchestra』

Portal の `GOOGLE_DRIVE_FOLDER_ID` が指す親フォルダ。直下: 書類（一般）/ 第1回演奏会 / Arsis その他。  
「Drive から取り込む」は **直下のみ**。

### 6.3 ドキュメント『ArsisCO 運営ガイド』

- URL: https://docs.google.com/document/d/10NZfpK_qB02rDlsvD_CIQ1VKnLBoOmwVhkuTw9ycYMU/edit
- 書類台帳に登録済み（id: `doc-mt5hfgwj-jus6fh`）
- リポジトリ内に `operations-guide.md` は無い

---

## 7. Portal（orchestra-app-1）の現状

| 画面 | データの場所 |
|---|---|
| ダッシュボード | AppData |
| タスク | AppData（テンプレートは localStorage） |
| 書類 | Documents |
| セッティング表 | localStorage（`seating-state-v1`）→ setting-app へ移行予定 |
| エキストラ契約 | AppData |
| 団員 / マイページ | Member page（写真は Vercel Blob） |

認証: サービスアカウント + 任意の `PORTAL_ACCESS_SECRET`。

---

## 8. 守ること

1. 口座・振込先は Portal に載せない。
2. 書類本文を Portal に複製しない。台帳は URL と要約。
3. NotebookLM の中身は読めない。URL のみ。
4. 会計ブックは Portal 未接続。
5. GAS 前提で Portal を語らない（Next.js + googleapis）。
6. セッティング表は setting-app で育て、Portal 統合まで二重実装を意識する。
7. 地図（`/map`）は BRIEFING の要約。矛盾したら **BRIEFING を正**とする。

---

## 9. 課題の振り分け

| 内容 | 振り先 |
|---|---|
| 団員、公演、練習、書類台帳、マイページ | Portal |
| 舞台上の座席・セッティング表 | setting-app（将来 Portal 内） |
| 公開サイトの記事・表示 | arsis-site |
| 会計・送金・領収書 | 別スプレッドシート / Drive |
| 文脈共有 | Context Bridge |
| 全体把握 | Lab `/map` |

---

## 10. よくある誤解

- 「Lab のシート = マスタブック」→ 違う。Lab は別 ID のバックログ。
- 「To do list = Portal タスク」→ 違う。Portal は AppData。
- 「Article / config = Portal」→ 公開サイト側。
- 「運営ガイドをリポジトリにコピー = 正本」→ 違う。正本は Google ドキュメント。
- 「Portal セッティング = setting-app」→ 今は別アプリ。将来統合。

---

## 11. この文書の使い方

1. 全体を読んでから、依頼がどの箱に入るか判断する。
2. Portal 詳細 → `orchestra-app-1` README / コード。
3. setting-app 詳細 → `setting-app` README / AGENTS.md。
4. 運営ルール → 『ArsisCO 運営ガイド』。
5. ブラウザでざっと見る → `arsis-lab` の `/map`（要約）。
