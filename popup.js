// ============================================================
// Scrapnote - Popup Script
// ============================================================

const btn = document.getElementById("clipBtn");
const status = document.getElementById("status");
const optionsLink = document.getElementById("optionsLink");

btn.addEventListener("click", async () => {
  btn.disabled = true;
  showStatus("loading", "📡 保存中... AIで分類しています");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url || tab.url.startsWith("chrome://")) {
      throw new Error("このページでは拡張機能を動作できません");
    }

    const response = await chrome.runtime.sendMessage({ action: "clip", tab });

    if (!response || !response.success) {
      throw new Error(response?.error || "不明なエラー");
    }

    const tagHtml = (response.tags || [])
      .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
      .join("");

    showStatus(
      "success",
      `✅ 保存完了<br><strong>${escapeHtml(response.title || "")}</strong><br>${tagHtml || '<span class="tag">no tags</span>'}`
    );

    // 1.8秒後に閉じる
    setTimeout(() => window.close(), 1800);
  } catch (err) {
    console.error("[Scrapnote] Popup error:", err);
    showStatus("error", `❌ ${escapeHtml(err.message)}`);
    btn.disabled = false;
  }
});

optionsLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

function showStatus(type, html) {
  status.className = `status ${type}`;
  status.innerHTML = html;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
