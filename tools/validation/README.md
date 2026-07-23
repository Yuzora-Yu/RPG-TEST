# Validation tools

ゲーム本体のJS・HTML・CSSと混在させないため、静的検証とランタイム模擬検証はこのフォルダへ集約する。

全検証:

```powershell
node tools/validation/run-all.js
```

個別検証の例:

```powershell
node tools/validation/validate-asset-fixed-names.js
node tools/validation/validate-asset-libraries.js
```

- 新しい検証は `validate-*.js` として追加すると、`run-all.js` の対象へ自動で入る。
- プロジェクトルートは `path.resolve(__dirname, '..', '..')` で解決する。
- マップ読込などの共通処理は `validation-helpers.js` を利用する。
- 生成レポートや一時出力が必要な場合は `logs/` 以下へ保存する。
- `validate-asset-fixed-names.js` は、実行時画像の固定名、実ファイル、版番号残存を検査する。
- `validate-asset-libraries.js` は、再利用素材の登録、寸法、透過形式、全データキャッシュ収録を検査する。
