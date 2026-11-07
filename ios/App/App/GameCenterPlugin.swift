import Foundation
import Capacitor
import GameKit

/// Game Center のランキング(エンドレスモード用)。JS 側は js/GameCenter.js
@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboard", returnType: CAPPluginReturnPromise)
    ]

    private var pendingAuth: [CAPPluginCall] = []
    private var handlerInstalled = false

    /// サインイン。未サインインなら Game Center のサインイン画面を出す
    @objc func authenticate(_ call: CAPPluginCall) {
        let player = GKLocalPlayer.local
        if player.isAuthenticated {
            call.resolve(["authenticated": true, "playerName": player.displayName])
            return
        }
        pendingAuth.append(call)
        if handlerInstalled { return }
        handlerInstalled = true
        // このハンドラはサインイン状態が変わるたびに呼ばれる(一度だけ設定する)
        player.authenticateHandler = { [weak self] viewController, error in
            guard let self = self else { return }
            DispatchQueue.main.async {
                if let viewController = viewController {
                    self.bridge?.viewController?.present(viewController, animated: true)
                    return
                }
                let ok = GKLocalPlayer.local.isAuthenticated
                let calls = self.pendingAuth
                self.pendingAuth.removeAll()
                for c in calls {
                    var result: [String: Any] = ["authenticated": ok]
                    if ok { result["playerName"] = GKLocalPlayer.local.displayName }
                    if let error = error { result["error"] = error.localizedDescription }
                    c.resolve(result)
                }
            }
        }
    }

    /// スコアを送る(自己ベストより低い値は Game Center 側で無視される)
    @objc func submitScore(_ call: CAPPluginCall) {
        guard let leaderboardId = call.getString("leaderboardId"), let score = call.getInt("score") else {
            call.reject("leaderboardId と score が必要です")
            return
        }
        guard GKLocalPlayer.local.isAuthenticated else {
            call.reject("not authenticated")
            return
        }
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [leaderboardId]) { error in
            if let error = error { call.reject(error.localizedDescription) } else { call.resolve() }
        }
    }

    /// ランキング画面を出す
    @objc func showLeaderboard(_ call: CAPPluginCall) {
        guard let leaderboardId = call.getString("leaderboardId") else {
            call.reject("leaderboardId が必要です")
            return
        }
        DispatchQueue.main.async {
            let vc = GKGameCenterViewController(leaderboardID: leaderboardId, playerScope: .global, timeScope: .allTime)
            vc.gameCenterDelegate = self
            self.bridge?.viewController?.present(vc, animated: true)
            call.resolve()
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
