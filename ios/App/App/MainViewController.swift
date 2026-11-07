import UIKit
import Capacitor

/// アプリ内に置いた自作プラグインを Capacitor に登録する
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GameCenterPlugin())
    }
}
