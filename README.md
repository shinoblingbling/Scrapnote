# Scrapnote

記事ページを `Ctrl+Shift+S` で AI が自動分類し、タグ付きで Notion データベースに保存する Chrome 拡張機能。

## 機能

- ワンショートカット（`Ctrl+Shift+S`）で記事を Notion に保存
- Groq API（Llama 3.3 70B）による自動タグ付け・カテゴリ分類・要約生成（完全無料）
- 事前定義のタグ辞書からのみ選択させるため、タグブレなし
- 記事本文を Markdown 化して Notion に保存（オフライン閲覧可）
- バッジと通知で保存状況をフィードバック

## 注意事項

> **この拡張機能は、閲覧中のページの内容（タイトル・URL・本文）を以下の外部サービスに送信します。**
>
> - **Groq API** — 記事分類のため、本文の冒頭4,000字を送信
> - **Notion API** — 記事保存のため、本文全体を送信
>
> **社内ポータル、メール、金融サイトなど機密性の高いページでは使用しないでください。**
> ショートカット（`Ctrl+Shift+S`）の誤打だけで送信が実行されます。

## 事前準備

利用開始前に以下の3つを用意してください：

1. Groq API Key
2. Notion Integration Token
3. Notion データベース

### 1. Groq API Key の取得

1. [Groq Console](https://console.groq.com/keys) を開く（Google または GitHub アカウントでサインアップ）
2. 「Create API Key」をクリック
3. 名前を入力（例: `Scrapnote`）→「Submit」
4. 表示された API Key（`gsk_...`）をコピーして控えておく

完全無料。課金設定不要。30 リクエスト/分、14,400 リクエスト/日。

### 2. Notion Integration Token の取得

1. [Notion Integrations](https://www.notion.so/profile/integrations) を開く
2. 「+ New integration」をクリック
3. 名前を入力（例: `Scrapnote`）、ワークスペースを選択
4. 「Content Capabilities」は「Read content」「Insert content」を有効化
5. 「Submit」→ 表示された Internal Integration Token（`ntn_...`）をコピー

### 3. Notion データベースの作成

Notion で新規データベース（フルページ）を作成し、以下のプロパティを追加してください：

| プロパティ名 | 型             | 備考                                                                                    |
| ------------ | -------------- | --------------------------------------------------------------------------------------- |
| Title        | タイトル       | デフォルトで存在（名前を `Title` に変更）                                               |
| URL          | URL            | 新規追加                                                                                |
| Tags         | マルチセレクト | 新規追加。タグ辞書と同じ値を事前登録推奨                                                |
| Category     | セレクト       | work-infra, work-security, work-dev, work-governance, career, learning, personal, hobby |
| Priority     | セレクト       | High, Mid, Low                                                                          |
| Status       | セレクト       | Unread, Reading, Done, Archived                                                         |
| Summary      | テキスト       | AI生成要約                                                                              |
| Read Time    | 数値           | 読了予測分数                                                                            |
| Added        | 日付           | 保存日時（自動設定）                                                                    |

作成後、**データベースに Integration を接続**してください：

1. データベースページ右上の「...」メニューを開く
2. 「Connections」→ 手順2で作成した Integration（`Scrapnote`）を選択
3. 「Confirm」

**Database ID の確認方法**：データベースを開いた状態の URL `https://notion.so/{workspace}/{32文字のID}?v=...` の32文字部分が Database ID です。設定画面には URL をそのまま貼り付けても自動抽出されます。

## インストール手順

### 1. ライブラリのダウンロード

以下2ファイルを `lib/` ディレクトリに配置してください：

```bash
cd scrapnote/lib
curl -L -o Readability.js https://raw.githubusercontent.com/mozilla/readability/main/Readability.js
curl -L -o turndown.js https://unpkg.com/turndown/dist/turndown.js
```

### 2. アイコンの配置

`icons/` ディレクトリに以下3サイズの PNG を置いてください（なくても動作はします）：

- `icon16.png`（16x16）
- `icon48.png`（48x48）
- `icon128.png`（128x128）

### 3. Chrome への読み込み

1. `chrome://extensions/` を開く
2. 右上「デベロッパーモード」ON
3. 「パッケージ化されていない拡張機能を読み込む」
4. `scrapnote/` フォルダを選択

### 4. 初期設定

1. 拡張機能アイコンを右クリック →「オプション」（またはカード内の「詳細」→「拡張機能のオプション」）
2. 事前準備で取得した以下を入力：
   - **Groq API Key**（`gsk_...`）
   - **Notion Integration Token**（`ntn_...`）
   - **Notion Database ID**（32文字の英数字、または URL をそのまま貼り付け）
3. 必要であればタグ辞書・カテゴリを編集
4. 「設定を保存」をクリック

### 5. ショートカット確認

`chrome://extensions/shortcuts` で `Ctrl+Shift+S` が割り当てられていることを確認。変更したい場合はここから。

## 使い方

1. 記事ページを開く
2. `Ctrl+Shift+S` を押す
3. 2〜5秒後に拡張アイコンに `✓` バッジが表示されれば完了
4. Notion を開いて確認

拡張アイコンをクリックしても同じ動作をします（結果が画面に表示される分、こちらの方が確認しやすい）。

## タグ辞書のカスタマイズ

オプション画面の「タグ辞書」で編集可能。JSON形式：

```json
{
  "インフラ": ["aws", "terraform", "kubernetes"],
  "セキュリティ": ["security", "vulnerability", "iam"]
}
```

**重要**：ここに定義したタグのみが Notion に投入されます。Notion 側のマルチセレクトプロパティにも同じオプションを事前登録しておくのが推奨（未登録のタグを投入すると Notion が自動で新規オプションを作成します）。

## トラブルシューティング

**「設定が未完了です」と出る**
→ オプション画面でAPIキー等を保存してください。

**「Notion API error 404」**
→ Database IDが間違っているか、Integrationがデータベースに接続されていません。データベースの「Connections」メニューを確認してください。

**「Groq API error 401」**
→ Groq API Key が不正です。`gsk_` で始まるキーを [Groq Console](https://console.groq.com/keys) で確認してください。

**`chrome://` や新規タブで動かない**
→ Chromeのセキュリティ制限で、拡張機能は `chrome://` スキーマのページでは動作できません。仕様です。

**特定サイトで本文抽出が失敗する**
→ JavaScript 重めのSPA（X、一部のニュースサイト等）では Readability が本文を取れないことがあります。この場合はページタイトル＋URL＋簡易テキストで保存されます。

## 技術スタック

- Chrome Extension Manifest V3
- Mozilla Readability（本文抽出）
- Turndown（HTML → Markdown 変換）
- Groq API（Llama 3.3 70B）
- Notion API v1

## コスト目安

Groq API は完全無料（課金設定不要）：

- 30 リクエスト/分、14,400 リクエスト/日
- 月100記事クリップしても **0円**

## ライセンス

MIT
