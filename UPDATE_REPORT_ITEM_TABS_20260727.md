# 道具画面タブ調整（2026-07-27）

## 変更内容

- 道具画面のタブを「道具」「育成」「素材」「貴重品」の4分類へ変更。
- 「育成」には、育成タイプのアイテム、スキル書、特性書を表示。
- タブ名横のレコード件数表示を削除。
- アイテム行右側の所持数表示（`x5` など）は維持。
- タブをスクロール領域の外へ分離し、スクロールバーがタブの高さまで伸びないよう修正。
- Service Workerのキャッシュ名を更新し、HTML・JavaScript変更を配信時に反映しやすくした。

## 変更ファイル

- `index.html`
- `menus_items.js`
- `sw.js`
- `menus.js`
- `items.js`
- `assets.js`
- `assets/ui/menu-icons/item-trait-book.png`
- `assets/ui/menu-icons/item-skill-book.png`

## 動作検証

依頼方針に従い、付属検証ツールおよびゲーム起動による動作検証は実施していません。


## 暫定アイコン追加

- 添付素材を特性書用 `assets/ui/menu-icons/item-trait-book.png` として追加。
- 添付素材をスキル書用 `assets/ui/menu-icons/item-skill-book.png` として追加。
- 特性書・スキル書のアイテム定義と共通アイコン解決処理を専用画像へ変更。
- 既存の育成アイテムは従来の `item-growth.png` を継続使用。
- 新しい2画像を `assets.js` の画像正本とキャッシュ対象へ登録。
- 各アイテム行の所持数表示（`x5` など）は変更していない。
