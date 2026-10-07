# ゆびで せんろ

指で線路を描いて電車を走らせる、小さな遊び場。

## 遊び方

- 指やマウスで長くなぞると、線路と電車が生まれます。複数の指でも描けます。
- 一時停止ボタンで電車と街を止め、「かきなおす」で線路を全部消します。
- キーボードでは遊び場にフォーカスして Enter で見本、Space で一時停止、Delete / Backspace で消去できます。
- 線路・街の保存機能はありません。再読み込みすると新しい遊び場になります。

## 開発

Node.js 22 以降を利用します。

```sh
npm ci
npm run build
npm test
```

`dist/` が静的配信対象です。GitHub Pages は GitHub Actions でビルド・テスト後に配信します。HTML のアセット参照は相対パスなのでプロジェクト配下でも利用できます。

## 移行元

Sites「ゆびで せんろ」version 8 のソース commit `938466af9edf40b12f85ccb087cba6255fa35f55` からコピーしました。元Siteは変更していません。Sitesの認証・配信設定はこのリポジトリに含めません。

## 踏切・速度・音

- 街と同じ生成イベントで、道路が線路を横切る踏切が生まれます。電車が近づくと遮断機が下がり、赤い灯が点滅します。
- 速度の調整場所は `src/railway.mjs` の `CONFIG.speedReferenceLength`（24世界単位）と `CONFIG.maxSpeedMultiplier`（3倍）。短線路は従来の画面上84px/秒、基準以上は線路の**実距離**に比例し、最大252px/秒です。スクロールは従来の68px/秒。点の数・画面の折れ曲がり数には依存しません。現在位置を保持したまま速度を変えます。
- 音は初回操作で解放し、電車が走っている間に鳴ります。「音あり／音なし」でミュート、音量スライダーで調整できます。Pause・非表示タブ・リセット時は停止し、操作再開時に復帰します。音が利用できない環境でも遊べます。
- BGMは「線路は続くよどこまでも」の原曲 **I've Been Working on the Railroad**（Traditional / audio provided by 8notes.com / Digital Tradition collection、[出典ページ](https://www.8notes.com/scores/6974.asp)、[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)）。音源未編集、ゲーム内で音量調整・ループ再生。ゲーム内♪から帰属表示を開けます。配布条件・取得元・ファイルの識別情報は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。
