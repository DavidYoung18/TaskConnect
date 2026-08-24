const { withAndroidManifest } = require('expo/config-plugins');

// Android 11+ (API 30+) hides other apps' packages from Linking.canOpenURL
// unless their scheme is declared under <queries>. Without this, the
// "choose a maps app" action sheet on provider/booking-detail.tsx would
// always report Google Maps / Yandex Maps / Waze as not installed, even when they are.
const SCHEMES = ['google.navigation', 'yandexmaps', 'waze'];

function addSchemeQueries(androidManifest) {
  const manifest = androidManifest.manifest;
  if (!manifest.queries) {
    manifest.queries = [{ intent: [] }];
  }
  const queries = manifest.queries[0];
  if (!queries.intent) queries.intent = [];

  for (const scheme of SCHEMES) {
    const alreadyDeclared = queries.intent.some(
      (entry) => entry.data?.[0]?.['$']?.['android:scheme'] === scheme
    );
    if (!alreadyDeclared) {
      queries.intent.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': scheme } }],
      });
    }
  }

  return androidManifest;
}

module.exports = function withMapsAppQueries(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults = addSchemeQueries(config.modResults);
    return config;
  });
};
