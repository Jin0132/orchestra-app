/**
 * Insert 見込み／決定 bullets into 『ArsisCO 運営ガイド』v2 §3-1.
 * Usage: node scripts/insert-ops-guide-accounting-memo.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const DOC_ID = "10NZfpK_qB02rDlsvD_CIQ1VKnLBoOmwVhkuTw9ycYMU";

const ANCHOR = "金額・送金の決定値はスプレッドシート『各回会計』。見込みは『ArsisCO 会計』。";

const INSERT = `
- 費目の骨格は、詳しい『各回会計』を正にして『ArsisCO 会計』へ写す。
- 見込みには、ありそうな費目と金額を一通り書いておく。予算表を実績で上書きしない。
- 使わなかった行は、転記のとき各回会計では空かゼロのまま残す。公演後に項目が増えたら各回会計に足して締め、次の回の見込みの骨格にも同じ費目を足す。
- 先が長い回は、見込みは全部載せた暫定、確定した数字だけ各回会計へ写す。
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

function collectText(elements, acc = []) {
  for (const el of elements || []) {
    if (el.paragraph) {
      let text = "";
      for (const e of el.paragraph.elements || []) {
        text += e.textRun?.content || "";
      }
      acc.push({
        start: el.startIndex,
        end: el.endIndex,
        text,
      });
    }
    if (el.table) {
      for (const row of el.table.tableRows || []) {
        for (const cell of row.tableCells || []) {
          collectText(cell.content, acc);
        }
      }
    }
  }
  return acc;
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

  const found =
    findTab(data.tabs, (title) => /v2/.test(title)) ||
    findTab(data.tabs, (title) => title.includes("本編"));

  if (!found) {
    throw new Error("v2 / 本編 tab not found");
  }

  const tabId = found.tab.tabProperties?.tabId;
  const paras = collectText(found.tab.documentTab?.body?.content || []);
  const already = paras.some((p) => p.text.includes("予算表を実績で上書きしない"));
  if (already) {
    console.log("already inserted in", found.here);
    return;
  }

  const appendixOld =
    "暫定予算（見込みは『ArsisCO 会計』） → 領収書回収 → 『各回会計』で転記・締め → 明細書送付と受領確認。";
  const appendixNew =
    "暫定予算（骨格は『各回会計』、見込み円は『ArsisCO 会計』。ありそうな費目は全部書く。実績で上書きしない） → 領収書回収 → 『各回会計』で転記・締め（未使用は空／ゼロ、増えた費目は足して次回見込みへ） → 明細書送付と受領確認。";

  const anchor = paras.find((p) => p.text.includes(ANCHOR));
  if (!anchor) {
    throw new Error("3-1 anchor not found in " + found.here);
  }
  const appendix = paras.find((p) => p.text.includes(appendixOld));

  const requests = [];
  if (appendix) {
    const start = appendix.start;
    requests.push({
      deleteContentRange: {
        range: { tabId, startIndex: start, endIndex: start + appendixOld.length },
      },
    });
    requests.push({
      insertText: {
        location: { tabId, index: start },
        text: appendixNew,
      },
    });
  }

  const insertAt = (anchor.end ?? 1) - 1;
  requests.push({
    insertText: {
      location: { tabId, index: insertAt },
      text: INSERT,
    },
  });

  console.log("update", found.here, "tabId=", tabId, "requests=", requests.length);

  await docs.documents.batchUpdate({
    documentId: DOC_ID,
    requestBody: { requests },
  });

  console.log("inserted accounting memo into 運営ガイド §3-1 / 付録 d");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
