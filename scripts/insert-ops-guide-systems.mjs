/**
 * Insert the static 「システムの役割」block into 『ArsisCO 運営ガイド』v2 tab.
 * Uses Portal service account (documents + drive scopes).
 *
 * Usage: node scripts/insert-ops-guide-systems.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const DOC_ID = "10NZfpK_qB02rDlsvD_CIQ1VKnLBoOmwVhkuTw9ycYMU";

const INSERT = `
システムの役割（4箱・変わらない分担）

担当者の役割（第1章）とは別に、どのツールが正本かだけを固定する。

Lab（arsis-lab）
すること: 全体の地図。開発課題の置き場（課題ボード）
しないこと: 団員・公演の日常入力、会計

Portal（orchestra-app-1）
すること: 団の内部（団員・公演・書類台帳・マイページ）
しないこと: 公開サイト、口座・振込先

公開サイト（arsis-site）
すること: 来場者向けの公式ページ
しないこと: 内部のタスク管理

セッティング表（setting-app）
すること: 舞台上の椅子・譜面台の配置図
しないこと: 団員マスタ。将来 Portal 内へ統合

この4つが Arsis のシステム範囲。One Meeting や個人用アプリはここに含めない。
開発の改善メモは Lab の課題ボード。公演の日常はマスタブック（AppData）。このガイドには日付・金額を書かない。
`;

function loadEnv() {
  const raw = readFileSync(resolve(root, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

function findTab(tabs, pred, path = "") {
  for (const tab of tabs || []) {
    const title = tab.tabProperties?.title || "";
    const here = path ? `${path} / ${title}` : title;
    if (pred(title, here, tab)) return { tab, here };
    const child = findTab(tab.childTabs, pred, here);
    if (child) return child;
  }
  return null;
}

function endIndex(tab) {
  const content = tab.documentTab?.body?.content || [];
  let max = 1;
  for (const el of content) {
    if (typeof el.endIndex === "number") max = Math.max(max, el.endIndex);
  }
  return Math.max(1, max - 1);
}

async function main() {
  const env = loadEnv();
  const key = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: key.client_email,
      private_key: key.private_key,
    },
    scopes: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive",
    ],
  });
  const docs = google.docs({ version: "v1", auth });

  const { data } = await docs.documents.get({
    documentId: DOC_ID,
    includeTabsContent: true,
  });

  const titles = [];
  const walk = (tabs, prefix = "") => {
    for (const t of tabs || []) {
      const title = t.tabProperties?.title || "?";
      titles.push(prefix + title);
      walk(t.childTabs, prefix + title + " / ");
    }
  };
  walk(data.tabs);
  console.log("tabs:", titles.join(" | "));

  const found =
    findTab(data.tabs, (title) => /v2/.test(title)) ||
    findTab(data.tabs, (title) => title.includes("本編"));

  if (!found) {
    throw new Error("v2 / 本編 tab not found");
  }

  const tabId = found.tab.tabProperties?.tabId;
  const idx = endIndex(found.tab);
  console.log("insert into", found.here, "tabId=", tabId, "at", idx);

  await docs.documents.batchUpdate({
    documentId: DOC_ID,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { tabId, index: idx },
            text: INSERT,
          },
        },
      ],
    },
  });

  console.log("inserted systems section into 運営ガイド");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
