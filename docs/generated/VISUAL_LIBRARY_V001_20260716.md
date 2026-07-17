# 再利用ビジュアル素材庫 v001

## 目的

現行マップや戦闘バランスをその場で変更せず、後から場所・イベント・敵データを選んで採用できる画像資産を蓄積する。画像だけを先に作っても、本編設定や衝突判定が暗黙に確定しない構成とする。

## 生成方式

- 生成機能: Codex内蔵画像生成
- 表現目標: SFC後期の日本製RPGに見られる、輪郭が読みやすい手打ち風ドット絵
- 共通禁止: 写実、3Dレンダー、滑らかなベクター調、過剰な発光、細密なAIイラスト調、文字、ロゴ、透かし、床へ落ちる影
- 背景処理: 原版は単色 `#ff00ff`、自動処理後は完全透過
- 実行時: フルデータキャッシュへ収録し、起動必須54点には追加しない

## 再利用マップ素材

- 数: 90点（10テーマ x 9点）
- テーマ: 村、森、洞窟、火山、水域、雷施設、光の宮殿、魔王城、大灯台、遺跡
- 役割: `decoration` は原則通行可、`blocking` は原則通行不可
- 実行形式: 32x32 RGBA PNG、下中央基準、硬い透過境界、48色量子化
- 実行素材: `assets/map/library/<theme>/<role>/`
- 原版: `assets/managed/source/map-chip-library/v001/`
- 索引: `assets/map/library/manifest.json`
- 一覧: `docs/generated/map-chip-library/map-chip-library-v001.png` および同フォルダのテーマ別一覧

代表プロンプト設計:

> 3x3 sprite atlas containing nine distinct top-down 32x32-compatible map props for one dungeon or settlement theme. Authentic late-SFC Japanese RPG pixel art, hand-placed chunky pixel clusters, restrained palette, strong silhouette at small size, flat #ff00ff chroma-key background. No smoothing, no glossy 3D, no photorealism, no text, no cast shadow.

## 採用済みモンスター素材

- 数: 24体
- 仲間加入クエストボス: 8体（炎・水・風・雷・光・闇・土・氷を各1体）
- 深淵階層モンスター: 16体（同8属性を各2体）
- 実行形式: 192x192の論理解像度で中ボス40色・雑魚28色へ減色し、4倍ニアレスト拡大した768x768 RGBA PNG
- 実行素材: `assets/monsters/monster_<ID>.png`
- 原版: `assets/managed/source/monster-library/v001/`
- 索引: `docs/generated/adopted-monsters-20260716.md`
- 一覧: `docs/generated/monster-library/monster-library-v001.png`

中ボス候補は、灰角のミノタウロス、深淵殻の騎士、疾風のマンティコア、雷環のゴーレム、聖堂のキマイラ、墓所の王、根脈の巨人、氷牙のワーム。

属性雑魚候補は、灰火のインプ、マグマサラマンダー、潮騒ジェリー、シェルバッククラブ、レイザーウイング、ブリーズモス、スパークハウンド、ボルトビートル、プリズムウィスプ、聖堂のセンチネル、グルームバット、シェイドクローラー、ストーンモール、ソーンボア、フロストジェリー、シャードヘア。

代表プロンプト設計:

> One complete unassigned PRISMA ABYSS battle sprite. Authentic late-SFC Japanese RPG enemy sprite with hand-placed chunky pixel clusters, limited 20-32 color appearance, readable silhouette, flat #ff00ff chroma-key background. Exactly one centered monster. No floor, no cast shadow, no particles, no text, no watermark, no glossy 3D, no high-resolution AI painting.

`monsterId` と `storyAssignment` は全件確定済み。個別能力・スキル・耐性・配置の詳細は `docs/generated/adopted-monsters-20260716.md` を参照する。

## 仲間マップチップ v003

- 対象: アリサ、バロン、アラン、ソフィア、フリーダ、ハイネ、リュウ、クロード、レオン
- 基準: 各キャラクターの `char_face_*.gif` を正本として衣装、髪色、武器、役割を再解釈
- 実行形式: 生成解像度を維持した正方形RGBA PNG、下中央基準、床影なし。ゲーム内では1タイルの表示枠へ縮小する。
- 実行素材: `assets/map/overlays/overlay_companion_*_v003.png`
- 原版・索引: `assets/map/overlays/source/companion-highres-v003/`
- 再構築: `tools/assets/build-companion-map-sprites-highres.py`
- 回帰検証: `tools/validation/validate-companion-map-sprites.js`

特に旧版との乖離が大きかったバロンは赤髪・鼻の絆創膏・傷んだ革鎧・棘肩当て・両刃斧、アリサは緑の短髪・斥候用革装備・短剣という実キャラクター設定へ戻した。レオンは実際の顔グラフィックを基準に、青髪・白青金の騎士鎧・翼章・青盾で新規作成した。

## 採用手順

1. `manifest.json` からテーマ・属性・役割で候補を選ぶ。
2. マップ素材は、装飾ならテーマ設定、障害物なら `blockingObjects` へ追加し、描画と衝突を同じデータに置く。
3. モンスターは敵データ・出現場所・能力・報酬を先に決め、採用候補だけをIDへ接続する。
4. `assets.js` の登録とフルデータキャッシュ収録を維持する。
5. `node tools/validation/run-all.js` を実行する。

## 継続ルール

- 新規生成は既存テーマ単位、属性単位の小ロットに分ける。
- 原版、透過済み原版、実行素材、索引、一覧を同じロットで更新する。
- AI感を減らすため、輪郭の左右対称化、意味のない突起、微細ノイズ、過剰な色勾配をビルド前後で確認する。
- 既存マップへ自動配置しない。採用・密度・通行可否を個別に決める。
- 遅延取得へ戻さず、追加した実行素材はフルデータキャッシュに含める。
