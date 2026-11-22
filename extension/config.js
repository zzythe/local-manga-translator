// Settings the developer may change.
const CONFIG = {
  // ExtensionPay id, registered at https://extensionpay.com under the same name.
  extpayId: 'local-manga-translator',
  // Nickname of the one-time Pro plan in the ExtensionPay dashboard; opens its checkout directly.
  proPlan: 'pro',
  // Free plan: new pages per day. Pages already translated in a tab show again for free.
  freePagesPerDay: 50,
  // Images of a long strip (webtoons, manhwa) count as this much of a page: a chapter is cut into
  // many images, each with less on it than a manga page. The README, website, store listing and
  // setup page say "half a page".
  stripPageWeight: 0.5,
  // Shown on the setup page. The real price is set in the ExtensionPay dashboard; keep them equal.
  proPrice: '$6.99',
  // Website with support and the privacy policy.
  siteUrl: 'https://zzythe.github.io/local-manga-translator/'
};
