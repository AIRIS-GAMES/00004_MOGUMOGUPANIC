# iOSの同期とGit管理

`App/App/public`、`App/App/capacitor.config.json`、`App/App/config.xml` は、別PCでも同期済みのゲーム内容を取得できるようGit管理する。

ゲームの変更はリポジトリ直下のソースで行い、`npm run sync:ios` で再生成・同期する。iOS側のコピーは直接編集しない。ソースを更新してコミットする際は、同期後のiOS側の差分も含める。

別PCではリポジトリ直下で `npm ci` を実行し、必要な依存関係を準備する。ソース変更後は `npm run sync:ios` を実行する。Xcodeで `ios/App/App.xcodeproj` を開き、署名設定とSwift Packageの解決を確認してビルドする。

`www`、`node_modules`、Pods、ビルド出力、DerivedDataは引き続きGit管理しない。同期完了はXcodeビルドや実機動作の成功を意味しない。
