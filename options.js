// ============================================================
// Scrapnote - Options Script
// ============================================================

import { saveSecureConfig, loadSecureConfig } from './secure-storage.js';

const DEFAULT_TAG_DICTIONARY = {
  "インフラ": ["aws", "terraform", "kubernetes", "docker", "networking", "linux"],
  "セキュリティ": ["security", "vulnerability", "iam", "compliance", "cnapp", "ccoe"],
  "開発": ["python", "typescript", "react", "api", "database", "ci-cd", "claude-code"],
  "運用": ["monitoring", "cost-optimization", "sre", "devops", "observability"],
  "キャリア": ["career", "job-hunting", "management", "leadership"],
  "資格・学習": ["ccsp", "aws-certification", "study"],
  "趣味": ["camera", "photography", "motorsports", "webtoon", "finance", "gold"]
};

const DEFAULT_CATEGORY_LIST = [
  "work-infra",
  "work-security",
  "work-dev",
  "work-governance",
  "career",
  "learning",
  "personal",
  "hobby"
];

const els = {
  groqApiKey: document.getElementById("groqApiKey"),
  notionToken: document.getElementById("notionToken"),
  notionDatabaseId: document.getElementById("notionDatabaseId"),
  tagDictionary: document.getElementById("tagDictionary"),
  categoryList: document.getElementById("categoryList"),
  saveFullContent: document.getElementById("saveFullContent"),
  saveBtn: document.getElementById("saveBtn"),
  resetBtn: document.getElementById("resetBtn"),
  saveStatus: document.getElementById("saveStatus")
};

// ------------------------------------------------------------
// 初期ロード
// ------------------------------------------------------------
async function loadSettings() {
  const stored = await loadSecureConfig(
    [
      "groqApiKey",
      "notionToken",
      "notionDatabaseId",
      "tagDictionary",
      "categoryList",
      "saveFullContent"
    ],
    {
      groqApiKey: "",
      notionToken: "",
      notionDatabaseId: "",
      tagDictionary: DEFAULT_TAG_DICTIONARY,
      categoryList: DEFAULT_CATEGORY_LIST,
      saveFullContent: true
    }
  );

  els.groqApiKey.value = stored.groqApiKey || "";
  els.notionToken.value = stored.notionToken || "";
  els.notionDatabaseId.value = stored.notionDatabaseId || "";
  els.tagDictionary.value = JSON.stringify(stored.tagDictionary, null, 2);
  els.categoryList.value = JSON.stringify(stored.categoryList, null, 2);
  els.saveFullContent.checked = stored.saveFullContent !== false;
}

// ------------------------------------------------------------
// Database ID 抽出(URLが貼られた場合にも対応)
// ------------------------------------------------------------
function extractDatabaseId(input) {
  const trimmed = input.trim();
  // URLが貼られた場合
  const urlMatch = trimmed.match(/([0-9a-f]{32})/i);
  if (urlMatch) return urlMatch[1];
  // ハイフン付きUUID
  const uuidMatch = trimmed.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (uuidMatch) return uuidMatch[1].replace(/-/g, "");
  return trimmed;
}

// ------------------------------------------------------------
// 保存
// ------------------------------------------------------------
els.saveBtn.addEventListener("click", async () => {
  let tagDictionary, categoryList;

  try {
    tagDictionary = JSON.parse(els.tagDictionary.value);
  } catch (e) {
    alert("タグ辞書のJSONが不正です: " + e.message);
    return;
  }

  try {
    categoryList = JSON.parse(els.categoryList.value);
    if (!Array.isArray(categoryList)) throw new Error("配列である必要があります");
  } catch (e) {
    alert("カテゴリリストのJSONが不正です: " + e.message);
    return;
  }

  await saveSecureConfig({
    groqApiKey: els.groqApiKey.value.trim(),
    notionToken: els.notionToken.value.trim(),
    notionDatabaseId: extractDatabaseId(els.notionDatabaseId.value),
    tagDictionary,
    categoryList,
    saveFullContent: els.saveFullContent.checked
  });

  els.saveStatus.classList.add("show");
  setTimeout(() => els.saveStatus.classList.remove("show"), 1800);
});

// ------------------------------------------------------------
// リセット
// ------------------------------------------------------------
els.resetBtn.addEventListener("click", () => {
  if (!confirm("タグ辞書とカテゴリを初期値に戻します。よろしいですか？\n(APIキーは保持されます)")) return;
  els.tagDictionary.value = JSON.stringify(DEFAULT_TAG_DICTIONARY, null, 2);
  els.categoryList.value = JSON.stringify(DEFAULT_CATEGORY_LIST, null, 2);
  els.saveFullContent.checked = true;
});

loadSettings();
