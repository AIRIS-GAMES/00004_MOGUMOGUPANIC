/* =========================================================
 * Notifications.js - カムバック用ローカル通知
 *  - サーバー不要。端末側で「最後に遊んでから3日後・7日後の22時」を予約
 *  - アプリを開く/閉じるたびに予約し直すので、遊んでいる人には届かない
 *  - 許可ダイアログは STAGE 1 初クリア後に、ゲーム内の説明を挟んでから出す
 *    (説明で「今はしない」を選んだ人には STAGE 3 初クリア後にもう一度だけ聞く)
 *  - Web(ブラウザ)版ではプラグインが無いので何もしない
 * ========================================================= */
class Notifier {
  static IDS = [3101, 3102];
  static DAYS = [3, 7];
  static HOUR = 22;

  static get plugin() {
    const cap = window.Capacitor;
    if (!cap || !cap.Plugins || !cap.Plugins.LocalNotifications) return null;
    if (cap.isPluginAvailable && !cap.isPluginAvailable('LocalNotifications')) return null;
    return cap.Plugins.LocalNotifications;
  }

  static get supported() { return Boolean(Notifier.plugin); }

  static state() {
    const s = Storage.getObject(Storage.KEYS.notify, {});
    return { asked: s.asked === true, softDeclines: Math.max(0, Number(s.softDeclines) || 0) };
  }

  static _save(state) { Storage.set(Storage.KEYS.notify, state); }

  /** ゲーム内の説明ダイアログを出すべきか(初クリアしたステージで判定) */
  static shouldOffer(stageId, firstClear) {
    if (!Notifier.supported || !firstClear) return false;
    const s = Notifier.state();
    if (s.asked) return false;
    return (stageId === 1 && s.softDeclines === 0) || (stageId === 3 && s.softDeclines <= 1);
  }

  /** 「受け取る」→ OS の許可ダイアログ → 予約 */
  static async accept(context) {
    const s = Notifier.state();
    s.asked = true;
    Notifier._save(s);
    let granted = false;
    try {
      const result = await Notifier.plugin.requestPermissions();
      granted = result && result.display === 'granted';
    } catch (_) { granted = false; }
    Analytics.design(`notify:permission:${granted ? 'granted' : 'denied'}`);
    if (granted) await Notifier.reschedule(context);
    return granted;
  }

  /** 「今はしない」 */
  static decline() {
    const s = Notifier.state();
    s.softDeclines += 1;
    Notifier._save(s);
    Analytics.design('notify:soft_decline');
  }

  /** days 日後の HOUR 時(端末のローカル時刻) */
  static fireDate(days, now = new Date()) {
    const d = new Date(now.getTime());
    d.setDate(d.getDate() + days);
    d.setHours(Notifier.HOUR, 0, 0, 0);
    return d;
  }

  /**
   * 通知文面。context = { nextStage: {id, name} | null }
   * nextStage が null なら全ステージクリア済み。
   */
  static messages(context = {}) {
    const next = context.nextStage;
    return [
      {
        title: 'コスミーが待ってるよ！',
        body: next
          ? `STAGE ${next.id}「${next.name}」でエラーがまた増えはじめた…！ すいこみに行こう`
          : 'ゲームセンターにまたエラーが…！ ★3を目指して、もう一度すいこもう',
      },
      {
        title: 'MOGU MOGU PANIC',
        body: 'しばらく会えなくて、コスミーがさみしがってるよ。ログインボーナスを受け取りに来てね！',
      },
    ];
  }

  /** 予約をすべて取り消し、許可があれば最後に遊んだ時点から予約し直す */
  static async reschedule(context, now = new Date()) {
    const plugin = Notifier.plugin;
    if (!plugin) return false;
    try {
      await plugin.cancel({ notifications: Notifier.IDS.map(id => ({ id })) });
      const perm = await plugin.checkPermissions();
      if (!perm || perm.display !== 'granted') return false;
      const texts = Notifier.messages(context);
      await plugin.schedule({
        notifications: Notifier.IDS.map((id, i) => ({
          id,
          title: texts[i].title,
          body: texts[i].body,
          schedule: { at: Notifier.fireDate(Notifier.DAYS[i], now) },
          extra: { kind: 'comeback', days: Notifier.DAYS[i] },
        })),
      });
      return true;
    } catch (error) {
      console.warn('通知の予約に失敗しました', error);
      return false;
    }
  }
}
