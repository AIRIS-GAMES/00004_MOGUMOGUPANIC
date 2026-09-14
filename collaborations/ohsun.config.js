/* manual=true: 手動で終了するまでコラボ有効。
 * 終了版は OHSUN_COLLAB_ENABLED を false にして npm run build:web。
 * 日時で管理する場合は manual=false にして開始・終了を指定する。
 */
(function (root) {
  const OHSUN_COLLAB_ENABLED = true;
  const config = Object.freeze({
    enabled: OHSUN_COLLAB_ENABLED,
    manual: true,
    startsAt: null,
    endsAt: null,
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
  else root.OHSUN_COLLAB_CONFIG = config;
})(globalThis);
