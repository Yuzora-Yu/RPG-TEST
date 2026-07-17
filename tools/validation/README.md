# Validation tools

ゲーム本体の JavaScript / HTML / CSS と混在させないため、静的検証とランタイム模擬検証はこのフォルダに集約する。

全検証を実行:

```powershell
node tools/validation/run-all.js
```

個別検証を実行:

```powershell
node tools/validation/validate-asset-libraries.js
```

- 新しい検証は `validate-*.js` としてこのフォルダへ追加する。
- プロジェクトルートは `path.resolve(__dirname, '..', '..')` で解決する。
- 共通のマップ読込処理は `validation-helpers.js` を利用する。
- 検証中の標準出力・エラー出力を保存する場合は `logs/` 配下へ出力する。
- `validate-asset-libraries.js` は再利用素材の実ファイル、登録、寸法、透過形式、全データキャッシュ収録を一括検証する。
