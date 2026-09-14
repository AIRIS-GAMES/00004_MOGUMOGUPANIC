/* 開催時は開始・終了をタイムゾーン付きISO日時で指定する。
 * 終了版は OHSUN_COLLAB_ENABLED を false にして npm run build:web。
 * 日時未設定の通常ビルドにはコラボを含めない。
 */
(function (root) {
  const OHSUN_COLLAB_ENABLED = true;
  const config = Object.freeze({
    enabled: OHSUN_COLLAB_ENABLED,
    startsAt: null,
    endsAt: null,
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
  else root.OHSUN_COLLAB_CONFIG = config;
})(globalThis);
