# 書類台帳（Google ドキュメント / Drive）の設定

スプレッドシート連携はそのまま使い、同じサービスアカウントで **Google ドキュメント** と **Drive** も読み書きします。

書類の本文はポータルにコピーしません。台帳（`Documents` シート）に URL・分類・要約を置き、クリックで元ファイルを開きます。

---

## 1. Google Cloud で API を有効にする

団員機能ですでに使っている GCP プロジェクトで、次を有効にします。

1. [Google Cloud Console](https://console.cloud.google.com/) を開く
2. サービスアカウントを作ったプロジェクトを選ぶ
3. 「API とサービス」→「ライブラリ」
4. 次を有効化
   - **Google Drive API**
   - **Google Docs API**
   - Google Sheets API（既存）

---

## 2. Drive フォルダをサービスアカウントに共有する

1. 書類の親フォルダを Google ドライブで開く
2. 「共有」で、サービスアカウントの `client_email`（`xxxx@yyyy.iam.gserviceaccount.com`）を **編集者** として追加
3. フォルダ URL の ID を控える
   - 例: `https://drive.google.com/drive/folders/14I7LIZIiRdObWHwwHRZPW1kwV2Get9G7`
   - ID は `/folders/` の直後

`.env.local` に任意で書きます。未設定なら、マイページのバックアップ用フォルダを使います。

```env
GOOGLE_DRIVE_FOLDER_ID=14I7LIZIiRdObWHwwHRZPW1kwV2Get9G7
```

スプレッドシート自体も、これまで通りサービスアカウントに編集者共有が必要です。アプリ起動時に `Documents` シートが無ければ自動で作ります。

---

## 3. ポータルでの使い方

| 操作 | 内容 |
|---|---|
| URL を登録 | Docs / Sheets / Drive / NotebookLM のリンクを貼る。リンクボタンで題名と要約案を取得 |
| 新規ドキュメント | 共有フォルダに空の Docs を作り、台帳へ登録して開く |
| Drive から取り込む | フォルダ内の未登録ファイルを一覧し、台帳へ追加 |
| 検索 | タイトル・要約・タグを横断 |
| 演奏会・タスク | 書類を演奏会に紐づけ、タスク編集で関連書類を選択 |

台帳から外しても、Google 側の原本は消えません。

---

## トラブルシュート

| 現象 | 確認すること |
|---|---|
| 題名が取れない / Drive 一覧が失敗 | Drive API・Docs API が有効か。フォルダをサービスアカウントに編集者共有しているか |
| 新規ドキュメントが作れない | 上記に加え、フォルダの共有が「閲覧者」になっていないか |
| NotebookLM の中身が取れない | 仕様です。URL と手入力のタイトル・要約だけ登録します |
| シートが見つからない | 同じスプレッドシートに `Documents` が自動作成されます。ブック自体の共有を確認 |
