# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Native config changes require a clean prebuild

`ios/` and `android/` are gitignored — they're generated output, not source of truth. `app.json` (plugins, `ios`, `android` keys) is the source of truth.

`npx expo run:ios` / `npx expo run:android` only run `prebuild` automatically when the native folder is **absent**. If `ios/`/`android/` already exists on disk, they build whatever's already there and silently ignore any `app.json` changes since the folder was last generated — including new plugins, new permission strings, new schemes, everything. This drift is invisible until something crashes at runtime with no JS-level error (e.g. iOS silently killing the app when a picker/location/camera API is invoked without its usage-description string present in `Info.plist`).

**Rule: any time `app.json`'s `plugins`, `ios`, or `android` config changes, run a clean prebuild before the next native run/build:**

```
npm run prebuild:ios      # or
npm run prebuild:android
```

Do this even if the change seems small (e.g. adding one permission string to an existing plugin) — there's no partial-resync path, only "fully stale" or "freshly regenerated."
