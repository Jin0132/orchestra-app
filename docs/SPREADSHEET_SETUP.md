# スプレッドシート同期の設定（手順 6・7 の詳細）

団員情報を Google スプレッドシートの「Member page」と同期するために、以下の手順で環境変数を設定し、アプリを起動してください。

---

## このドキュメントの場所

- **パス**: プロジェクト内の `docs/SPREADSHEET_SETUP.md`
- **フルパス例**: `c:\Users\User\Desktop\Orchestra-App\docs\SPREADSHEET_SETUP.md`
- **開き方**:
  - Cursor / VS Code の左のファイル一覧で `docs` フォルダ → `SPREADSHEET_SETUP.md` をクリック
  - またはエクスプローラーで上記フォルダを開き、メモ帳などで `SPREADSHEET_SETUP.md` を開く

---

## 6. 環境変数（.env.local）の設定

### 6-1. ファイルの場所

プロジェクトの**ルートフォルダ**（`package.json` があるフォルダ）に、`.env.local` という名前のファイルを作成します。

- 例: `c:\Users\User\Desktop\Orchestra-App\.env.local`
- このファイルは git に含めないでください（秘密鍵が含まれるため）。通常、`.gitignore` に `.env.local` が含まれていれば自動的に無視されます。

### 6-2. GOOGLE_SERVICE_ACCOUNT_JSON の設定

1. Google Cloud コンソールでサービスアカウントの「鍵」から JSON キーをダウンロードしたら、その JSON ファイルをメモ帳などで開きます。
2. **中身をすべて 1 行の文字列として** `.env.local` に書きます。
   - 改行は削除するか、`\n` に置き換えてください。
   - 値は**ダブルクォート `"` で囲み**、中の `"` は `\"` でエスケープします。

**方法 A（推奨）: 1 行にまとめる**

```env
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"あなたのプロジェクトID","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\nMIIE...(省略)...\n-----END PRIVATE KEY-----\n","client_email":"xxxx@yyyy.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token",...}
```

- `private_key` の中の改行は、実際の JSON では `\n` になっているので、そのまま `\n` として 1 行に含めます。
- JSON 全体を 1 行にしたものを、`GOOGLE_SERVICE_ACCOUNT_JSON=` の右側に続けて書きます。

**方法 B: 既存の JSON ファイルのパスを渡す方式（要コード変更）**

Next.js の標準では「JSON の中身を文字列として env に書く」形が一般的です。ファイルパスだけを渡す方式にする場合は、API ルート側で `fs.readFileSync` などで読み込むようコードを変更する必要があります。

### 6-3. GOOGLE_SPREADSHEET_ID の設定

1. 対象の Google スプレッドシートをブラウザで開きます。
2. アドレスバーの URL を確認します。
   - 例: `https://docs.google.com/spreadsheets/d/1ABC123xyz.../edit`
3. **`/d/` の直後から `/edit` の直前まで**の文字列がスプレッドシート ID です。
   - 例: `1ABC123xyz...`（英数字の長い文字列）
4. `.env.local` に次のように書きます。

```env
GOOGLE_SPREADSHEET_ID=1ABC123xyz...
```

### 6-4. .env.local の例（2 行だけ）

```env
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...（JSON を 1 行で）...}
GOOGLE_SPREADSHEET_ID=あなたのスプレッドシートID
```

- 行の先頭・末尾に余計なスペースやクォートを付けないでください。
- 保存したら、**エディタやターミナルを開き直す**と、新しい環境変数が読み込まれます。

---

## 7. 依存関係のインストールとアプリの起動

### 7-1. 依存関係のインストール（npm install）

Google Sheets API 用のパッケージ（`googleapis`）を使うため、プロジェクトで一度だけ依存関係をインストールします。

1. **ターミナル（PowerShell やコマンドプロンプト）を開く**
2. **プロジェクトのフォルダに移動する**
   ```powershell
   cd c:\Users\User\Desktop\Orchestra-App
   ```
3. **次のコマンドを実行する**
   ```powershell
   npm install
   ```
   - `package.json` に書かれたパッケージ（含む `googleapis`）が `node_modules` にインストールされます。
   - 初回や `package.json` を変更したあとに行えば十分です。

### 7-2. 開発サーバーの起動（npm run dev）

1. **同じプロジェクトフォルダで**、次のコマンドを実行します。
   ```powershell
   npm run dev
   ```
2. ターミナルに次のような表示が出れば起動成功です。
   ```
   ▲ Next.js 16.x.x
   - Local:        http://localhost:3000
   ```
3. ブラウザで **http://localhost:3000** を開きます。
4. 団員情報ページを開くと、起動時に **GET /api/sheets/members** が呼ばれ、スプレッドシートの「Member page」からデータを読み込みます。
   - `.env.local` が正しくなければ、団員一覧が空のままか、「スプレッドシートの設定を確認してください」などのエラーが表示されます。その場合は手順 6 を見直してください。

### 7-3. 本番用ビルドと起動（任意）

本番環境で動かす場合の流れです。

1. **ビルド**
   ```powershell
   npm run build
   ```
2. **起動**
   ```powershell
   npm start
   ```
   - 本番でも、同じ `.env.local`（またはサーバーに設定した環境変数）が読み込まれます。本番サーバーでは、Vercel や Netlify などの「環境変数」設定画面で `GOOGLE_SERVICE_ACCOUNT_JSON` と `GOOGLE_SPREADSHEET_ID` を設定してください。

---

## トラブルシューティング

| 現象 | 確認すること |
|------|----------------|
| 団員一覧がずっと「読み込み中」 | ブラウザの開発者ツール（F12）の「ネットワーク」で `/api/sheets/members` が 500 になっていないか確認。500 の場合はサーバー側ログ（ターミナル）のエラー内容を確認。 |
| 500 エラー / 「GOOGLE_SERVICE_ACCOUNT_JSON is not set」 | `.env.local` がプロジェクトルートにあるか、変数名のスペルが正しいか確認。保存後、**ターミナルで `npm run dev` を一度止めて再実行**してください。 |
| 403 / 権限エラー | スプレッドシートを、サービスアカウントのメール（JSON の `client_email`）で「編集者」として共有しているか確認。 |
| シートが見つからない | シート名が **「Member page」**（大文字・小文字・スペース含め）と一致しているか確認。 |
| ポータルに団員が一部しか出ない | 下記「次の手順」「団員がすべて見られない場合」を参照。 |

---

## 次の手順（設定後の運用）

1. **スプレッドシートの 1 行目**
   - 必ず**ヘッダー行**にしてください（列順はアプリの「スプレッドシート設定」カードに表示されているものと同じ）。
   - 現在の並び: `id, isPublic, name, part, partRank, role, email, status, profile, instagram, extraRequestStatus, requestedPracticeIds, instrument, joinYear, attendance`

2. **データは 2 行目から**
   - 団員のデータは **2 行目以降**に 1 人 1 行で入力します。1 行目がヘッダーでないと、先頭行が団員として読み込まれたり、列がずれて正しく表示されません。

3. **ポータルを開き直す**
   - 団員情報ページを開いたタイミングでシートから読み込むため、シートを編集したあとは**ページを再読み込み（F5）**すると最新の内容が反映されます。

4. **追加・編集・削除**
   - ポータル上で「新規団員登録」「詳細の保存」「削除」を行うと、その内容がスプレッドシートにすぐ反映されます。

---

## 団員がすべて見られない場合

- **1 行目がヘッダーか確認**
  - 1 行目に「id, isPublic, name, …」のような**列名**が入っているか確認してください。データが 1 行目から始まっていると、先頭行がヘッダー扱いされず列がずれ、全員分が正しく表示されないことがあります。
- **id 列が空でないか**
  - 各行の **id** 列（A 列）に 1 件ずつ値が入っている行だけが「団員」として表示されます。id が空の行は一覧に含めていません。
- **読み込み件数**
  - いまは「Member page」の **最大 1000 行**まで読み込みます。それ以上ある場合は、別シートに分けるか、必要なら読み込み上限の拡張を検討してください。

---

## 間の期間でのメンバー管理（期・年度ごと）

「いつ頃在籍していたか」でメンバーを分けて管理したい場合は、次のような運用ができます。

### 方法 A: スプレッドシートで列を増やす（推奨）

1. シートに **「期」や「年度」の列**を追加する（例: 列 P に `period`、値は `2024` や `2024-2025` など）。
2. ヘッダー行はそのまま 15 列で、**データ行だけ** 16 列目に期を入力する。
3. 現状のアプリは「全行を一覧表示」のため、**スプレッドシート側でフィルタ**を使って、期・年度で絞り込んで確認・編集できます。
4. 将来的にアプリ側に「期でフィルタ」を入れる場合は、この列を読み込んでフィルタ条件に使えます。

### 方法 B: シートを期ごとに分ける

- 例: 「Member page 2024」「Member page 2025」のようにシートを分け、`.env.local` の `GOOGLE_SPREADSHEET_ID` やシート名を切り替えて、見たい期のシートだけをポータルに表示する運用も可能です（その場合はコードでシート名を設定できるようにする対応が必要です）。

まずは **方法 A** で列を 1 つ増やし、スプレッドシートのフィルタで期間を絞りながら管理するのが手軽です。
