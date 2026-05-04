# 華耀大衛星 — プロジェクト技術仕様書

**サイト名（兼PWA名）**: 華耀大衛星  
**運営**: 華耀東夷堂 (KAYŌ TŌIDŌ)  
**URL**: https://jiz41.github.io/kayoutouidouofficial/  
**リポジトリ**: https://github.com/Jiz41/kayoutouidouofficial  
**施行日**: 2026年04月28日  

---

## 1. ファイル構成

```
kayoutouidouofficial/
├── index.html          シェルHTML。DOM骨格・利用規約テキスト・PWAスクリプト
├── style.css           全スタイル。デザイントークン集約
├── bg.js               背景演出（星フィールド + 夜景ビル群 + 車アニメ）
├── flow.js             起動フロー制御（スプラッシュ→規約→掲示板）
├── board.js            掲示板ロジック（Supabase CRUD・リアルタイム）
├── jizairitu.js        真自在律A.L.L ページ（予想フィード表示）
├── home.js             はじめに・アプデ/メンテ・リンク ページ
├── news.js             ニュース速報ページ
├── manifest.json       PWAマニフェスト
├── sw.js               Service Worker（キャッシュ戦略）
├── assets/
│   ├── logo.png        サイトロゴ（サイドバー・ヘッダー）
│   └── wheel-eye.png   スプラッシュ画面アイコン
├── icons/
│   ├── icon-192.png    PWAアイコン 192×192
│   └── icon-512.png    PWAアイコン 512×512
├── supabase_setup.sql      boards / threads / posts テーブル＋RPC定義
├── categories_setup.sql    categories テーブル＋boards拡張
├── admin_setup.sql         bans / reports テーブル＋boards.sort_order
├── storage_setup.sql       post-images バケット設定
└── announcements_setup.sql announcements テーブル
```

### 各ファイルの役割詳細

| ファイル | 役割 |
|---|---|
| `index.html` | SPA シェル。JS は持たず DOM 骨格・利用規約テキストのみ。PWA 登録 + インストールボタンのインライン JS のみ例外 |
| `style.css` | 全 CSS。デザイントークン（色・余白・タイポ）を集約。他ファイルにスタイルを散らさない（jizairitu.js は例外：動的 `<style>` 注入） |
| `bg.js` | `#bg-layer` 内の 2 つの canvas に描画。`#starfield-canvas` に星・流れ星・衛星（赤点）。`#city-canvas` に夜景ビル群・車。コンテンツエリア（`#stage`）に干渉しない |
| `flow.js` | 起動フロー管理。スプラッシュ 3.5 秒 → 利用規約（初回のみ、`kayou_agreed` フラグ）→ `window._boardInit()` 呼び出し |
| `board.js` | 掲示板の全ロジック。Supabase クライアント初期化・板/スレッド/投稿の CRUD・リアルタイム購読・サイドバー描画・画像アップロード・本文パース |
| `jizairitu.js` | `discord_posts` / `execution_logs` を並行取得しステータスバー＋予想カードを表示。INSERT イベントをリアルタイム購読 |
| `home.js` | はじめにページ（サイト説明）・アプデ/メンテ情報ページ・リンクページの 3 つを管理。`announcements` テーブルを参照 |
| `news.js` | `news_posts` テーブルからニュース取得。カテゴリフィルタ UI を提供 |
| `sw.js` | Cache-first 戦略。`satellite-v3` キャッシュに `index.html` / `style.css` / `board.js` をプリキャッシュ |

---

## 2. Supabaseテーブル構造

**Project URL**: `https://pqqrfzofzxiuzvxdrcai.supabase.co`  
**Publishable Key**: `sb_publishable_t1AfJtM9h_gYkxg9QL3GXg_-CVV0jaT`（フロントエンド用・公開鍵）  
**Service Key**: 環境変数 `SUPABASE_SERVICE_KEY`（keirin-proxy-ii サーバー側のみ）

### 2-1. boards（掲示板）

| カラム | 型 | 備考 |
|---|---|---|
| id | UUID PK | gen_random_uuid() |
| name | TEXT NOT NULL | 板名 |
| slug | TEXT NOT NULL UNIQUE | URLスラッグ |
| emoji | TEXT DEFAULT '📋' | サイドバー表示用 |
| category_id | UUID FK → categories.id | NULL = 未分類、ON DELETE SET NULL |
| sort_order | INT DEFAULT 0 | サイドバー表示順 |
| created_at | TIMESTAMPTZ DEFAULT now() | |

**RLS**: 有効・`public_all_boards` ポリシー（全操作 `using(true)`）  
**Realtime**: `replica identity full`、`supabase_realtime` パブリケーション追加済み  
**Index**: `idx_boards_category_id`

**初期データ**: 競輪🚴 / 競馬🐎 / 競艇⛵ / オートレース🏍 / パチンコ・スロット🎰 / 雑談💬

---

### 2-2. categories（カテゴリ）

| カラム | 型 | 備考 |
|---|---|---|
| id | UUID PK | |
| name | TEXT NOT NULL | |
| sort_order | INT DEFAULT 0 | |
| created_at | TIMESTAMPTZ DEFAULT now() | |

**RLS**: `public_all_categories` ポリシー  
**初期データ**: 公営競技（sort=1）/ ギャンブル（sort=2）/ 雑談（sort=3）

---

### 2-3. threads（スレッド）

| カラム | 型 | 備考 |
|---|---|---|
| id | UUID PK | |
| board_id | UUID FK → boards.id | ON DELETE CASCADE |
| title | TEXT NOT NULL | |
| post_count | INT DEFAULT 0 | 1000 で is_active = false |
| is_active | BOOLEAN DEFAULT true | false = 満スレ |
| created_at | TIMESTAMPTZ DEFAULT now() | |

**RLS**: `public_all_threads` ポリシー  
**Index**: `idx_threads_board_id`

---

### 2-4. posts（投稿）

| カラム | 型 | 備考 |
|---|---|---|
| id | UUID PK | |
| thread_id | UUID FK → threads.id | ON DELETE CASCADE |
| body | TEXT NOT NULL | |
| anon_id | TEXT NOT NULL | 8文字英数大文字。`SYSTEM` は特別表示 |
| post_number | INT NOT NULL | スレッド内連番（1〜1000）|
| created_at | TIMESTAMPTZ DEFAULT now() | |

**RLS**: `public_all_posts` ポリシー  
**Index**: `idx_posts_thread_id`  
**Realtime**: INSERT イベント購読（スレッド遷移時に filter 付き購読・解除）

---

### 2-5. announcements（お知らせ）

| カラム | 型 | 備考 |
|---|---|---|
| id | UUID PK | |
| title | TEXT NOT NULL | |
| body | TEXT NOT NULL | |
| created_at | TIMESTAMPTZ DEFAULT now() | |

はじめにページ最新5件・アプデ/メンテ情報ページ全件で参照

---

### 2-6. bans（BAN管理）

| カラム | 型 | 備考 |
|---|---|---|
| id | UUID PK | |
| anon_id | TEXT NOT NULL UNIQUE | BAN対象のanon_id |
| reason | TEXT | |
| created_at | TIMESTAMPTZ DEFAULT now() | |

**Index**: `idx_bans_anon_id`

---

### 2-7. reports（通報）

| カラム | 型 | 備考 |
|---|---|---|
| id | UUID PK | |
| post_id | UUID FK → posts.id | ON DELETE CASCADE |
| thread_id | UUID FK → threads.id | ON DELETE CASCADE |
| reason | TEXT NOT NULL | |
| reporter_id | TEXT | anon_id |
| is_resolved | BOOLEAN DEFAULT false | |
| created_at | TIMESTAMPTZ DEFAULT now() | |

**Index**: `idx_reports_post_id`, `idx_reports_is_resolved`

---

### 2-8. discord_posts（真自在律A.L.L 予想フィード）

keirin-proxy-ii の `poster.js` が INSERT。フロントエンドは **読み取り専用**。

| カラム | 型 | 備考 |
|---|---|---|
| id | UUID PK | |
| race_id | TEXT | レースID（末尾2桁がレース番号）|
| title | TEXT | Discord埋め込みタイトル |
| fields | JSONB | `[{name, value}]` 配列 |
| timestamp | TIMESTAMPTZ | 投稿日時 |
| venue | TEXT | 場名 |

jizairitu.js: `order('timestamp', desc).limit(50)` で取得、INSERT をリアルタイム購読

---

### 2-9. execution_logs（スケジューラ実行ログ）

| カラム | 型 | 備考 |
|---|---|---|
| id | UUID PK | |
| executed_at | TIMESTAMPTZ NOT NULL DEFAULT now() | |
| result | TEXT NOT NULL | `'found'` または `'not_found'` (CHECK制約) |
| race_id | TEXT | result='found' 時のみ |
| venue | TEXT | 場名 |
| race_num | INT | レース番号 |

**Index**: `execution_logs_executed_at_idx (executed_at DESC)`  
jizairitu.js: 最新1件を取得し、`executed_at` が 90分以内なら 🟢稼働中、超えたら 🔴停止中

---

### 2-10. news_posts（ニュース速報）

| カラム | 型 | 備考 |
|---|---|---|
| id | UUID PK | |
| title | TEXT NOT NULL | |
| url | TEXT NOT NULL UNIQUE | 重複スキップ制約 |
| category | TEXT | カテゴリ名（文字列）|
| color | INT | 予備カラムコード（未使用）|
| published_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ DEFAULT now() | |

**Index**: `news_posts_published_idx (published_at DESC)`  
GASスクリプトが RSS → upsert（url の UNIQUE 制約で重複スキップ）

---

### 2-11. Storageバケット: post-images

| 項目 | 値 |
|---|---|
| バケット名 | post-images |
| 公開 | true |
| ファイルサイズ上限 | 5MB |
| 許可MIMEタイプ | jpeg / png / gif / webp |
| アップロード権限 | anon, authenticated |

投稿添付画像（最大3枚/投稿）を格納。URL を body テキストに埋め込み投稿。

---

### 2-12. RPC関数

#### `insert_post(p_thread_id, p_body, p_anon_id) → posts`
- スレッドを FOR UPDATE でロック
- post_count ≥ 1000 なら例外
- `max(post_number)+1` で連番採番
- threads.post_count インクリメント・is_active 更新
- `SECURITY DEFINER`

#### `create_thread(p_board_id, p_title, p_body, p_anon_id) → threads`
- threads 挿入（post_count=1, is_active=true）
- posts 挿入（post_number=1）
- `SECURITY DEFINER`
- **スレッド作成は管理ページ専用。一般ユーザーUIには非表示**

---

## 3. カラー・デザイン定義

### カラーパレット

| 用途 | 値 |
|---|---|
| ベース背景 | `#0f1420` |
| 最暗部（画面外） | `#060a10` |
| アクセント（琥珀） | `#c8a060` |
| アクセント（暗） | `#8a6a3a` |
| テキスト（主） | `#f0ece4` |
| テキスト（副） | `#ddd6c8` |
| テキスト（弱） | `#9aa0b0` |
| ミュート | `#5a6278` |
| フェイント | `#3a4058` |
| サイドバー背景 | `#0b0f1a` |
| ヘッダー背景 | `#0d1220` |
| アクティブ背景 | `#1a2236` |
| ホバー背景 | `#141b2a` |

### フォント

| 用途 | フォント |
|---|---|
| 本文・UI | Noto Sans JP（wght 200/300/400/500/700）|
| ID・時刻・等幅 | IBM Plex Mono（wght 300/400/500）|

### ニュースカテゴリカラー

| カテゴリ | カラー |
|---|---|
| 競輪 | `#4e8fff` |
| 競馬 | `#f2a336` |
| 競艇 | `#3db87a` |
| オート | `#e85c5c` |
| パチンコ・スロット | `#9b6dcc` |
| ネタ・おもしろ | `#ffe135` |
| 一般ニュース | `#909090` |
| AI・ガジェット | `#35c4b5` |
| デフォルト | `#c8a060` |

### レイアウト制約

- コンテンツエリア最大幅: `430px`（スマートフォンフレーム）
- 背景レイヤー: `#bg-layer` (`position:fixed; z-index:0`)
- コンテンツレイヤー: `#stage` (`z-index:1; background:#0f1420`)

---

## 4. サイドバー構成・全ページ一覧

### サイドバーナビゲーション順序

```
🏠 はじめに
─────────────（区切り）
👁 真自在律A.L.L
─────────────（区切り）
📰 ニュース速報
─────────────（区切り）
📋 掲示板（ラベル）
  [カテゴリ折りたたみ]
    各板ボタン（未読バッジ付き）
─────────────（区切り）
🔧 アプデ/メンテ情報
─────────────（区切り）
🔗 リンク
```

フッター: 利用規約ボタン・プライバシーポリシーボタン・PWAインストールボタン（条件付き）

### 全ページ一覧

| view値 | 表示名 | 説明 | 入力バー |
|---|---|---|---|
| `home` | はじめに | サイト説明・A.L.L紹介・掲示板説明・最新お知らせ5件 | なし |
| `jizairitu` | 👁 自在律A.L.L | 稼働ステータス + 予想カード一覧（リアルタイム更新） | なし |
| `news` | 📰 ニュース速報 | カテゴリフィルタ + ニュース一覧（外部リンク） | なし |
| `boards` | 板一覧 | 全板をサムネイル表示 | なし |
| `threads` | スレッド一覧 | 選択板のスレッド一覧（post_count・満スレ表示） | なし |
| `posts` | 投稿一覧 | スレッド内投稿（リアルタイム更新・アンカーポップアップ） | あり |
| `announcements` | 🔧 アプデ/メンテ情報 | announcements 全件 | なし |
| `links` | 🔗 リンク | 外部リンク3件（HF Space / X / note） | なし |

### リンクページ外部URL

| タイトル | URL |
|---|---|
| 真自在律（マニュアル版）| https://huggingface.co/spaces/Jiz41/Jiz41r1t5u |
| 華耀東夷堂 X | https://x.com/kayoutouidou01 |
| 華耀東夷堂 note | https://note.com/kytnrnsnjzitr |

---

## 5. 外部連携

### 5-1. Google Analytics 4

- **測定ID**: `G-W4939EXX88`
- 実装: index.html の `<head>` 内インライン gtag.js
- 収集内容: ページビュー・セッション（Cookie使用）
- プライバシーポリシーに記載済み

---

### 5-2. keirin-proxy-ii（Render.com スケジューラ）

**Repository**: `/root/keirin-proxy-ii/`  
**Deployment**: Render.com（常時起動・スリープ防止ping有り）

#### スケジュール

| cron | 処理 |
|---|---|
| `0,30 * * * *` | `run()`: レース選定 → 予想生成 → Discord投稿 → Supabase記録 |
| `*/10 * * * *` | Render自身 + HuggingFace Space へ ping（スリープ防止） |

#### 動作フロー（run関数）

```
1. JST 0〜7時はスキップ
2. selectRaces(): betTime 15〜30分・7車立てのレースを選定
3. selected = [] → logExecution('not_found') して終了
4. 各レース:
   a. hasPosted(raceId): discord_posts テーブルで重複チェック
   b. 投稿済みならスキップ
   c. predict(raceId): AI予想生成（HuggingFace Space呼び出し）
   d. format(prediction): Discord Embed形式に整形
   e. post(payload): Discord Webhook 送信 + discord_posts INSERT
   f. logExecution('found', raceId, venue, raceNum)
```

#### Supabase書き込みテーブル

- `discord_posts`: 予想結果（poster.js が INSERT）
- `execution_logs`: 実行ログ（scheduler.js が INSERT）

---

### 5-3. GAS（Google Apps Script）— ニュースRSS収集

複数のニュースサイトの RSS を定期取得し、`news_posts` テーブルに INSERT。

#### 動作仕様

- `UrlFetchApp` でRSS取得 → `XmlService` でパース
- Supabase REST API（`x-upsert: true`、`on_conflict=url`）で重複スキップ
- Discord Webhook への送信は廃止済み（Supabase INSERT のみ）
- 認証情報は `PropertiesService` で管理

---

### 5-4. HuggingFace Space（マニュアル版 真自在律）

- **URL**: https://huggingface.co/spaces/Jiz41/Jiz41r1t5u
- keirin-proxy-ii の orchestrator.js が Gradio API 経由で呼び出し
- はじめにページ・リンクページから導線あり

---

## 6. PWA構成

### 6-1. manifest.json

```json
{
  "name": "華耀大衛星",
  "short_name": "華耀大衛星",
  "scope": "/kayoutouidouofficial/",
  "start_url": "/kayoutouidouofficial/",
  "display": "standalone",
  "background_color": "#0f1420",
  "theme_color": "#c8a060",
  "orientation": "portrait",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- `scope` と `start_url` を `/kayoutouidouofficial/` に設定（GitHub Pagesのサブパス対応）
- `orientation: portrait` でポートレート固定

### 6-2. sw.js

```
キャッシュ名: satellite-v3

プリキャッシュ:
  /kayoutouidouofficial/
  /kayoutouidouofficial/index.html
  /kayoutouidouofficial/style.css
  /kayoutouidouofficial/board.js

戦略: Cache-First（GETのみ）
バージョンアップ時: activate で旧キャッシュを全削除
```

キャッシュバージョン更新手順: `sw.js` の `CACHE = 'satellite-vN'` をインクリメントすると、次回アクセス時に旧キャッシュが自動削除され新しい JS が配信される。

### 6-3. インストールボタン（UA分岐）

| 端末 | 挙動 |
|---|---|
| Android Chrome | `beforeinstallprompt` を捕捉 → 「📲 アプリとして追加」ボタンをサイドバーフッターに注入 |
| iOS Safari | `isInStandaloneIOS` が false の場合 → 「📲 ホーム画面に追加」ボタンを注入 → タップでモーダル表示（共有ボタン操作案内）|
| インストール済み | `appinstalled` イベントでボタン削除 |

---

## 7. 主要設計思想・制約事項

### アーキテクチャ

- **SPA + 単一 HTML シェル**: `index.html` は DOM 骨格のみ。全コンテンツは JS が動的生成
- **スクリプト読み込み順序**: `bg.js → flow.js → board.js → jizairitu.js → home.js → news.js`（依存順）
- **`window._boardInit()`**: flow.js から board.js の初期化関数を呼ぶ契約
- **グローバルスコープ公開**: `showAnchorPopup`, `hideAnchorPopup`, `scrollToPost` は投稿HTML内の `onmouseenter`/`onclick` から参照するためグローバルに置く

### 匿名性・認証

- 登録不要・完全匿名
- `myAnonId`: 8文字英数大文字、`localStorage['kayou_anon_id']` に保存（24hリセットはサーバー側未実装）
- 利用規約同意フラグ: `localStorage['kayou_agreed'] = '1'`（同意後はスプラッシュ→即掲示板）

### データ制約

- スレッド上限: **1000投稿**（`insert_post` RPC内で強制・`is_active=false` に変更）
- 同一ID連続投稿制限: **30秒**（利用規約記載、サーバー側実装は別途必要）
- 画像添付: 最大3枚 / 5MB制限 / jpeg・png・gif・webp のみ

### 本文パース（processBody）

優先順（上から評価）:
1. `>>数字` → アンカーリンク（ホバーでポップアップ表示）
2. `https?://...` → URL自動リンク化
   - 画像URL（.jpg/.png/.gif/.webp）→ インライン画像表示
   - YouTube URL（youtu.be / youtube.com/watch / youtube.com/shorts）→ リンク + サムネイル自動表示
   - その他 → 外部リンク
3. 改行 `\n` → `<br>`

YouTube ID抽出: `youtu.be/{11文字}` → `youtube.com/watch?.*[?&]v={11文字}` → `youtube.com/shorts/{11文字}` の順で評価

### 背景演出（bg.js）

- `#starfield-canvas`: 画面全幅全高、z-index:0
  - 静止星: `(W × H×0.72) / 1600` 個。白系 87.5% / 琥珀 12.5%
  - 流れ星: 100〜150個、右→左ドリフト（dx: -0.03〜-0.11）
  - 衛星: 赤点（rgba(210,55,45)）、画面右上固定（x = innerWidth×0.85, y=25）
- `#city-canvas`: 画面底部固定高さ240px
  - ビル群 15棟定義、電柱5本、道路（琥珀センターライン極淡）
  - 車アニメ: 5〜19秒間隔でランダム方向、ヘッドライト/テールランプ描画

### リアルタイム戦略

- **掲示板（posts）**: スレッド遷移時に `filter: thread_id=eq.{id}` 付きで購読。画面離脱時に `unsubscribe()`
- **真自在律（discord_posts + execution_logs）**: ページ表示中 INSERT を監視。50件を超えたら末尾行を削除
- チャンネル名: `posts_{threadId}`（掲示板）、`jizairitu_feed`（真自在律）

### 開発環境制約

- **Android Termuxで開発**（PC環境・ブラウザDevToolsは使用不可）
- git push により GitHub Pages へ自動デプロイ
- Bash実行前: `export TMPDIR=/data/data/com.termux/files/usr/tmp`

### セキュリティ

- Supabase の Publishable Key はフロントエンド公開想定（読み取り・匿名INSERT のみ）
- `escHtml()` で全ユーザー入力をサニタイズ（XSS対策）
- RLS ポリシーは「全操作許可」（パブリックBBS設計）
- Storage Policy: anon ユーザーのアップロード・読み取りを許可

---

*最終更新: 2026-05-04*
