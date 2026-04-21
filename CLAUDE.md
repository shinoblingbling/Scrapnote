# CLAUDE.md

このファイルは Claude Code がプロジェクト作業時に自動参照するコンテキストファイルです。

## プロジェクト概要

Chrome 拡張機能: Web記事をワンショートカット（`Ctrl+Shift+S`）で AI（Groq / Llama）が自動分類し、タグ付きで Notion に保存する。

**詳細な設計判断・要件・引き継ぎ事項は `HANDOFF.md` を参照**。

## 開発ルール

### コードスタイル

- **括弧は半角徹底**: `()` `[]` `{}`（全角禁止）
- **コメントは日本語OK**
- **インデント**: スペース2つ
- **セミコロン**: 必須
- **クォート**: シングルクォート優先、JSON内はダブルクォート

### ファイル編集時の注意

- `manifest.json` の編集時は MV3 仕様を厳守
- `background.js` は Service Worker として動作、グローバル変数で状態を持たない
- API Key 等の機密情報は `chrome.storage.local` に AES-256-GCM 暗号化して保存（`sync` は使わない）
- 外部APIへのリクエスト URL は `host_permissions` に事前追加が必要

### コミットメッセージ

Conventional Commits 準拠。`/commit` スラッシュコマンドが使えるならそれを使う。

例:
```
feat(clipper): 選択範囲クリップ機能を追加
fix(notion): 2000字超のブロック分割ロジックを修正
docs: HANDOFF.mdのPhase 2タスクを更新
```

## テスト方針

### 動作確認の代表サイト

以下の日本語技術記事サイトで動作確認すること（`HANDOFF.md` Phase 1 参照）：

1. Qiita (qiita.com)
2. Zenn (zenn.dev)
3. DevelopersIO (dev.classmethod.jp)
4. AWS公式ブログ (aws.amazon.com/jp/blogs)
5. AWS公式ドキュメント (docs.aws.amazon.com)

### デバッグ

- Chrome DevTools → Extensions タブで Service Worker のログ確認
- `chrome://extensions/` でエラー表示
- オプション画面から API Key の導通テスト（実装予定）

## Groq API 呼び出し時の注意

- モデル: `llama-3.3-70b-versatile`（無料: 30 RPM / 14,400 RPD）
- 認証: `Authorization: Bearer` ヘッダで API Key を送信
- `response_format: { type: "json_object" }` で JSON 出力を強制
- API Key は [Groq Console](https://console.groq.com/keys) で発行（課金設定不要）

## Notion API 呼び出し時の注意

- 1リクエストで送れる `children` ブロックは **最大100個**
- 1つの `rich_text` は **最大2000文字**
- 超過分は内部で自動分割する実装済み（`splitMarkdownToBlocks` 関数）

## 依存ライブラリ

`lib/` に同梱済み。最新版への更新が必要な場合のみ以下を実行：

```bash
curl -L -o lib/Readability.js https://raw.githubusercontent.com/mozilla/readability/main/Readability.js
curl -L -o lib/turndown.js https://unpkg.com/turndown/dist/turndown.js
```

Readability.js は Apache License 2.0、turndown.js は MIT ライセンス。アップデート時は動作テスト必須。

## 禁止事項

- **外部CDNからの直接ロード**（manifest.jsonの `content_security_policy` に違反）
- **eval() / Function() の使用**（MV3では禁止）
- **localStorage / sessionStorage の使用**（Service Worker では使えない、`chrome.storage` を使う）
- **アップロードされたタグ候補外のタグを Notion に投入**（コード側でフィルタ済み）

## 作業優先順位

`HANDOFF.md` §7 のフェーズに従う：

1. **Phase 1**: 動作確認とバグ修正（まずここを完走）
2. **Phase 2**: UX改善（アイコン、エラーメッセージ、重複チェック）
3. **Phase 3**: 機能拡張（選択範囲クリップ、ハイライト等）
4. **Phase 4**: 品質・配布準備（TypeScript化、テスト、OSS公開）

## 参考リンク

- Chrome Extensions MV3: https://developer.chrome.com/docs/extensions/
- Groq API: https://console.groq.com/docs/
- Notion API: https://developers.notion.com/
