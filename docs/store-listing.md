# Chrome Web Store Listing - Scrapnote

## Name
Scrapnote

## Short Description (132 characters max)
Web articles saved to Notion with AI-powered auto-tagging. One shortcut, zero manual work.

## Detailed Description (Japanese)

Scrapnote は、Web記事をワンショートカットで Notion に保存する Chrome 拡張機能です。

### 主な機能

- Ctrl+Shift+S を押すだけで、閲覧中の記事を Notion データベースに保存
- AI (Groq / Llama 3.3) が記事を自動分類し、タグ・カテゴリ・要約・読了時間を付与
- 使うほどタグが安定する学習型タグシステム (Notion DB の既存タグを自動再利用)
- 記事本文を Markdown 化して Notion に保存 (オフライン閲覧可)
- タグの表記揺れを防止 (小文字正規化)

### こんな人に便利

- 気になる技術記事をタブに溜め込んでしまう人
- Notion で記事を管理しているが、手動タグ付けが面倒な人
- 「あの記事どこだっけ?」を解消したい人

### 必要なもの

- Groq API Key (無料、課金設定不要)
- Notion Integration Token (無料)
- Notion データベース

### プライバシー

- 拡張機能を手動で起動したページのみを処理します
- バックグラウンドでの閲覧追跡、分析収集、トラッキングは一切行いません
- API Key はローカルに AES-256-GCM で暗号化して保存されます
- ソースコードは GitHub で公開しています

## Detailed Description (English)

Scrapnote saves web articles to Notion with one shortcut. AI automatically classifies, tags, and summarizes each article.

### Key Features

- Press Ctrl+Shift+S to save any article to your Notion database
- AI (Groq / Llama 3.3) auto-generates tags, category, summary, and read time
- Adaptive tagging: reuses existing tags from your Notion DB, creates new ones only when needed
- Article content saved as Markdown in Notion (available offline)
- Tag normalization prevents duplicates (e.g., "AWS" and "aws" become one tag)

### Who is this for?

- Developers who hoard browser tabs of articles to read later
- Notion users who want automatic article organization
- Anyone tired of manually tagging and categorizing saved articles

### Requirements

- Groq API Key (free, no billing required)
- Notion Integration Token (free)
- Notion database with required properties (see documentation)

### Privacy

- Only processes pages when you explicitly activate the extension
- No background tracking, analytics, or telemetry
- API keys are encrypted locally with AES-256-GCM
- Open source on GitHub

## Category
Productivity

## Language
Japanese (with English support)
