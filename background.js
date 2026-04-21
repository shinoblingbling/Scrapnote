// ============================================================
// Scrapnote - Background Service Worker
// ============================================================

import { loadSecureConfig } from './secure-storage.js';

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const NOTION_API_URL = "https://api.notion.com/v1/pages";
const NOTION_VERSION = "2022-06-28";

// ------------------------------------------------------------
// メッセージハンドラ(popup.js からの保存指示を受ける)
// ------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "clip") {
    handleClip(message.tab || null)
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // 非同期レスポンス
  }
});

// ------------------------------------------------------------
// キーボードショートカット: Ctrl+Shift+S
// ------------------------------------------------------------
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "clip-article") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || tab.url.startsWith("chrome://")) {
    showBadge(tab?.id, "!", "#ef4444");
    return;
  }

  showBadge(tab.id, "...", "#3b82f6");

  try {
    const result = await handleClip(tab);
    showBadge(tab.id, "✓", "#22c55e");
    notify("保存完了", `${result.title}\nタグ: ${result.tags.join(", ") || "なし"}`);
  } catch (err) {
    console.error("[Scrapnote] Clip failed:", err);
    showBadge(tab.id, "✕", "#ef4444");
    notify("保存失敗", err.message);
  }
});

// ------------------------------------------------------------
// メインの保存処理
// ------------------------------------------------------------
async function handleClip(tab) {
  if (!tab) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = activeTab;
  }

  const config = await loadConfig();
  validateConfig(config);

  // 1. ページ本文の抽出(content scriptを注入)
  const extraction = await extractPageContent(tab.id);
  const metadata = {
    title: extraction.title || tab.title,
    url: tab.url,
    author: extraction.author || "",
    siteName: extraction.siteName || new URL(tab.url).hostname,
    excerpt: extraction.excerpt || ""
  };
  const markdown = extraction.markdown || "";

  // 2. Groq API で分類
  let classification;
  try {
    classification = await classifyWithGroq(metadata, markdown, config);
  } catch (err) {
    console.warn("[Scrapnote] Groq classification failed, saving without tags:", err);
    classification = {
      summary: metadata.excerpt.slice(0, 300) || "(要約生成に失敗)",
      tags: [],
      category: "personal",
      priority: "mid",
      read_time_min: Math.max(1, Math.round(markdown.length / 500))
    };
  }

  // 3. Notion に保存
  await saveToNotion(metadata, classification, markdown, config);

  return {
    title: metadata.title,
    tags: classification.tags,
    category: classification.category
  };
}

// ------------------------------------------------------------
// 設定のロード・検証
// ------------------------------------------------------------
async function loadConfig() {
  const defaults = {
    groqApiKey: "",
    notionToken: "",
    notionDatabaseId: "",
    tagDictionary: getDefaultTagDictionary(),
    categoryList: getDefaultCategoryList(),
    saveFullContent: true
  };
  return loadSecureConfig(Object.keys(defaults), defaults);
}

function validateConfig(config) {
  const missing = [];
  if (!config.groqApiKey) missing.push("Groq API Key");
  if (!config.notionToken) missing.push("Notion Integration Token");
  if (!config.notionDatabaseId) missing.push("Notion Database ID");
  if (missing.length) {
    throw new Error(`設定が未完了です: ${missing.join(", ")}\nオプション画面で設定してください。`);
  }
}

function getDefaultTagDictionary() {
  return {
    "インフラ": ["aws", "terraform", "kubernetes", "docker", "networking", "linux"],
    "セキュリティ": ["security", "vulnerability", "iam", "compliance", "cnapp", "ccoe"],
    "開発": ["python", "typescript", "react", "api", "database", "ci-cd", "claude-code"],
    "運用": ["monitoring", "cost-optimization", "sre", "devops", "observability"],
    "キャリア": ["career", "job-hunting", "management", "leadership"],
    "資格・学習": ["ccsp", "aws-certification", "study"],
    "趣味": ["camera", "photography", "motorsports", "webtoon", "finance", "gold"]
  };
}

function getDefaultCategoryList() {
  return [
    "work-infra",
    "work-security",
    "work-dev",
    "work-governance",
    "career",
    "learning",
    "personal",
    "hobby"
  ];
}

// ------------------------------------------------------------
// ページ本文抽出(content scriptを動的注入)
// ------------------------------------------------------------
async function extractPageContent(tabId) {
  // lib/Readability.js と lib/turndown.js を注入
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["lib/Readability.js", "lib/turndown.js"]
  });

  // content.js を実行して本文を抽出
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });

  if (!result || !result.result) {
    throw new Error("ページ本文の抽出に失敗しました");
  }
  return result.result;
}

// ------------------------------------------------------------
// Groq API 呼び出し(OpenAI 互換形式)
// ------------------------------------------------------------
async function classifyWithGroq(metadata, markdown, config) {
  const tagDictFlat = Object.values(config.tagDictionary).flat();
  const prompt = buildPrompt(metadata, markdown, tagDictFlat, config.categoryList);

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.groqApiKey}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 1024,
      temperature: 0.3
    })
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const detail = errBody.error?.message || "Unknown error";
    console.error("[Scrapnote] Groq API error detail:", detail);
    throw new Error(`AI分類に失敗しました(${res.status})`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";

  if (!text) {
    throw new Error("Groq API returned empty response");
  }

  const result = JSON.parse(text);

  // タグ候補外のフィルタ(大文字小文字を無視してマッチ)
  const allowedTagsLower = new Map(tagDictFlat.map((t) => [t.toLowerCase(), t]));
  result.tags = (result.tags || [])
    .map((t) => allowedTagsLower.get(t.toLowerCase()))
    .filter(Boolean)
    .slice(0, 3);

  // カテゴリ候補外のフォールバック
  if (!config.categoryList.includes(result.category)) {
    result.category = "personal";
  }

  // priorityのフォールバック
  if (!["high", "mid", "low"].includes(result.priority)) {
    result.priority = "mid";
  }

  result.read_time_min = Number(result.read_time_min) || 5;

  // summary のサニタイズ(プロンプトインジェクション対策)
  let summary = String(result.summary || "").slice(0, 500);
  summary = summary.replace(/https?:\/\/\S+/g, "[URL removed]");
  summary = summary.replace(/[<>]/g, "");
  result.summary = summary;

  return result;
}

function buildPrompt(metadata, markdown, tagList, categoryList) {
  const body = markdown.slice(0, 4000);
  return `あなたは記事分類の専門家です。以下の記事を分析し、JSON形式でのみ回答してください。

【タグ候補(この中からのみ選択。新規作成厳禁)】
${JSON.stringify(tagList)}

【カテゴリ候補(この中から1つだけ選択)】
${JSON.stringify(categoryList)}

【記事情報】
タイトル: ${metadata.title}
サイト: ${metadata.siteName}
URL: ${metadata.url}

【記事本文(冒頭4000字)】
${body}

【出力形式(JSONのみ、前後の説明文禁止)】
{
  "summary": "3行以内の日本語要約",
  "tags": ["最大3つ、上記候補リストから選択"],
  "category": "上記カテゴリ候補から1つ",
  "priority": "high|mid|low",
  "read_time_min": <読了予測分数の数値>
}`;
}

// ------------------------------------------------------------
// Notion API で保存
// ------------------------------------------------------------
async function saveToNotion(metadata, classification, markdown, config) {
  const properties = {
    "Title": { title: [{ text: { content: metadata.title.slice(0, 2000) } }] },
    "URL": { url: metadata.url },
    "Tags": { multi_select: classification.tags.map((t) => ({ name: t })) },
    "Category": { select: { name: classification.category } },
    "Priority": { select: { name: capitalize(classification.priority) } },
    "Status": { select: { name: "Unread" } },
    "Summary": { rich_text: [{ text: { content: classification.summary.slice(0, 2000) } }] },
    "Read Time": { number: classification.read_time_min },
    "Added": { date: { start: new Date().toISOString() } }
  };

  const children = config.saveFullContent
    ? buildNotionBlocks(metadata, markdown)
    : buildMetadataOnlyBlocks(metadata);

  const body = {
    parent: { database_id: config.notionDatabaseId },
    properties,
    children
  };

  const res = await fetch(NOTION_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.notionToken}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[Scrapnote] Notion API error detail:", errText);
    throw new Error(`Notionへの保存に失敗しました(${res.status})`);
  }

  return res.json();
}

// ------------------------------------------------------------
// Markdown → Notion ブロック変換
// ------------------------------------------------------------
function buildNotionBlocks(metadata, markdown) {
  const blocks = [];

  // メタデータヘッダ
  blocks.push({
    object: "block",
    type: "callout",
    callout: {
      icon: { type: "emoji", emoji: "🔗" },
      rich_text: [
        { text: { content: `${metadata.siteName}  ·  ` } },
        { text: { content: metadata.url, link: { url: metadata.url } } }
      ]
    }
  });

  if (metadata.author) {
    blocks.push(paragraph(`Author: ${metadata.author}`));
  }

  blocks.push({ object: "block", type: "divider", divider: {} });

  // 本文を段落に分割
  const paragraphs = splitMarkdownToBlocks(markdown);
  for (const block of paragraphs) {
    blocks.push(block);
    // Notion API は1リクエスト最大100ブロック
    if (blocks.length >= 95) {
      blocks.push(paragraph("... (長い記事のため一部省略)"));
      break;
    }
  }

  return blocks;
}

function buildMetadataOnlyBlocks(metadata) {
  return [
    {
      object: "block",
      type: "callout",
      callout: {
        icon: { type: "emoji", emoji: "🔗" },
        rich_text: [
          { text: { content: `${metadata.siteName}  ·  ` } },
          { text: { content: metadata.url, link: { url: metadata.url } } }
        ]
      }
    },
    paragraph(metadata.excerpt.slice(0, 2000) || "(要約なし)")
  ];
}

function splitMarkdownToBlocks(markdown) {
  const blocks = [];
  const lines = markdown.split("\n");
  let buffer = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    const text = buffer.join("\n").trim();
    buffer = [];
    if (!text) return;
    // 2000字制限で分割
    for (let i = 0; i < text.length; i += 1900) {
      blocks.push(paragraph(text.slice(i, i + 1900)));
    }
  };

  for (const line of lines) {
    if (/^#\s+/.test(line)) {
      flushBuffer();
      blocks.push(heading(1, line.replace(/^#\s+/, "")));
    } else if (/^##\s+/.test(line)) {
      flushBuffer();
      blocks.push(heading(2, line.replace(/^##\s+/, "")));
    } else if (/^###\s+/.test(line)) {
      flushBuffer();
      blocks.push(heading(3, line.replace(/^###\s+/, "")));
    } else if (/^\s*$/.test(line)) {
      flushBuffer();
    } else {
      buffer.push(line);
    }
  }
  flushBuffer();

  return blocks;
}

function paragraph(text) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [{ text: { content: text.slice(0, 2000) } }]
    }
  };
}

function heading(level, text) {
  const type = `heading_${level}`;
  return {
    object: "block",
    type,
    [type]: {
      rich_text: [{ text: { content: text.slice(0, 2000) } }]
    }
  };
}

// ------------------------------------------------------------
// UIフィードバック
// ------------------------------------------------------------
function showBadge(tabId, text, color) {
  if (!tabId) return;
  chrome.action.setBadgeText({ text, tabId });
  chrome.action.setBadgeBackgroundColor({ color, tabId });
  if (text === "✓" || text === "✕" || text === "!") {
    setTimeout(() => {
      chrome.action.setBadgeText({ text: "", tabId });
    }, 2500);
  }
}

function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message: message.slice(0, 200),
    priority: 0
  });
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
