// ============================================================
// Scrapnote - Content Script
// ページ本文を Readability で抽出し Markdown に変換
// ============================================================

(() => {
  try {
    // Readability でクリーンな記事本文を抽出
    const docClone = document.cloneNode(true);
    const reader = new Readability(docClone);
    const article = reader.parse();

    if (!article) {
      return {
        title: document.title,
        author: "",
        siteName: location.hostname,
        excerpt: "",
        markdown: document.body?.innerText?.slice(0, 5000) || ""
      };
    }

    // HTML → Markdown 変換
    const turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
      emDelimiter: "*"
    });

    // 不要タグの除去
    turndown.remove(["script", "style", "iframe", "noscript"]);

    const markdown = turndown.turndown(article.content || "");

    return {
      title: article.title || document.title,
      author: article.byline || "",
      siteName: article.siteName || location.hostname,
      excerpt: article.excerpt || "",
      markdown: markdown.trim()
    };
  } catch (err) {
    console.error("[Scrapnote] Content extraction failed:", err);
    return {
      title: document.title,
      author: "",
      siteName: location.hostname,
      excerpt: "",
      markdown: document.body?.innerText?.slice(0, 5000) || ""
    };
  }
})();
