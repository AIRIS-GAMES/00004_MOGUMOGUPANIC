# iOSの同期とGit管理

`App/App/public`、`App/App/capacitor.config.json`、`App/App/config.xml` は、別PCでも同期済みのゲーム内容を取得できるようGit管理する。

ゲームの変更はリポジトリ直下のソースで行い、`npm run sync:ios` で再生成・同期する。iOS側のコピーは直接編集しない。ソースを更新してコミットする際は、同期後のiOS側の差分も含める。

別PCではリポジトリ直下で `npm ci` を実行し、必要な依存関係を準備する。ソース変更後は `npm run sync:ios` を実行する。Xcodeで `ios/App/App.xcodeproj` を開き、署名設定とSwift Packageの解決を確認してビルドする。

`www`、`node_modules`、Pods、ビルド出力、DerivedDataは引き続きGit管理しない。同期完了はXcodeビルドや実機動作の成功を意味しない。

## Game Center(エンドレスモードのランキング)

アプリ側は実装済み(`App/GameCenterPlugin.swift`、`App/MainViewController.swift`、`App/App.entitlements`)。
公開前に App Store Connect で次の設定が必要です。

1. Xcode でターゲット App → Signing & Capabilities に「Game Center」が表示されていることを確認
   (`App.entitlements` で有効化済み。表示されない場合は「+ Capability」から追加)
2. App Store Connect → アプリ → 「サービス」→ Game Center を有効にする
3. 「リーダーボード」を追加
   - 種類: クラシック(ずっと残る)。週替わりにしたい場合は「繰り返し」
   - リーダーボードID: `mogumogu.endless`(`js/Endless.js` の `LEADERBOARD` と同じ)
   - スコアの形式: 整数 / 並び順: 高い順
   - ローカライズ: 日本語で「エンドレス」など
4. 審査に出すバージョンの「Game Center」欄でこのリーダーボードを選ぶ

サンドボックス(TestFlight・開発ビルド)では、端末の 設定 → Game Center でサインインすると確認できます。
