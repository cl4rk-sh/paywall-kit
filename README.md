# Paywall Kit

A self-contained Expo / React Native subscription paywall: a two-page pre-paywall
sequence, a WebView-hosted paywall driven by RevenueCat offerings, and a
discounted exit-offer flow that fires when the user tries to leave.

Lifted out of a shipping app. Product names, copy, analytics vendors, API keys
and endpoints have been stripped or replaced with placeholders — everything left
is mechanism.

---

## Layout

```
app/
  paywall.tsx                              main paywall screen + exit-offer divert
  paywall-promo.tsx                        discounted exit-offer screen
  onboarding/paywall-sequence/
    _layout.tsx                            stack config for the sequence
    page1.tsx                              trial / no-trial variant switch
    page2.tsx                              "remind me before it ends" picker
components/
  PaywallWebView.tsx                       the core: hosts the web paywall, owns purchase
  PaywallWarmer.tsx                        invisible prefetch so the paywall opens instantly
  ProductVideo.tsx                         looping muted product clip
  onboarding/                              page scaffolding + selection card
  ui/                                      Button, Text, GradientButton, ContentColumn, IconTile
constants/
  flags.ts                                 build-time switches
  palette.js / palette.d.ts                colour tokens
  designTokens.ts                          max content width etc.
hooks/
  use-nav.ts                               debounced router, safe before nav mounts
  use-guarded-router.ts                    focus-gated router, kills double-taps
  use-tap-guard.ts
utils/
  revenueCat.ts                            SDK init, offerings, trial detection, price arms
  paywallQuickActions.ts                   iOS/Android home-screen "special offer" shortcut
  remoteConfig.ts                          remote kill-switch for the exit offer
  analytics.ts                             ← STUB, wire to your own
  storage.ts                               ← STUB, wire to your own
assets/lottie/bell.json                    used by page2
```

## What you must supply

| Thing | Where |
|---|---|
| RevenueCat SDK keys | `EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY`, `EXPO_PUBLIC_RC_TEST_KEY` |
| Web paywall URL | `EXPO_PUBLIC_PAYWALL_BASE_URL` |
| Remote config URL | `EXPO_PUBLIC_REMOTE_CONFIG_URL` (optional — falls back to local flags) |
| `assets/video/product.mp4` | not included; drop in your own short silent portrait clip |
| Analytics | `utils/analytics.ts` is a no-op adapter — implement the five functions |
| Settings storage | `utils/storage.ts` is a trimmed standalone store — swap for yours if you have one |
| Fonts | the UI expects Nunito (`@expo-google-fonts/nunito`) via NativeWind classes `font-nunito*` |

## The web paywall

`PaywallWebView` does not render the paywall itself — it hosts a **separate
static SPA** and handles only the native side (StoreKit/Play purchase, restore,
haptics, safe-area). That SPA is not part of this kit; you build or port it.

**App → page**, as query params on `{BASE}/paywall/production/{offeringId}`:

| Param | Meaning |
|---|---|
| `pricing` | JSON blob of resolved prices, periods, trial info per plan |
| `topInset` / `bottomInset` | safe-area padding in pt, so the page can lay out edge-to-edge |
| `appVersion` | lets the page branch layout by shipped build |
| `os` | `ios` \| `android` |
| `country` | 2-letter storefront code, from RevenueCat |
| `reminderDaysBeforeEnd` | the day the user picked on page2, for the trial timeline |

The URL is withheld until trial eligibility and the reminder choice resolve, so
the page never renders copy that gets yanked a beat later.

**Page → app**, via `postMessage`:

| Message | Effect |
|---|---|
| `{type:'purchase', plan}` | resolves the package on the offering and buys it |
| `{type:'restore'}` | restore purchases |
| `{type:'close'}` | dismiss (this is what triggers the exit offer) |
| `{type:'haptic', style}` | `light`/`medium`/`heavy`/`selection`/`success` |

**App → page**, injected: `window.__paywallNative.purchaseEnded()` fires when a
purchase settles or fails, so the page can drop its spinner.

## How the flow hangs together

1. `PaywallWarmer` prefetches the paywall page early so it opens instantly.
2. `paywall-sequence/page1` reads a synchronous trial-eligibility cache
   populated during RevenueCat init. Trial available → the free-trial page;
   otherwise → `NoTrialPaywallPage` with copy keyed on whether the user is a
   first-run or a returning launch.
3. `page2` collects a trial-reminder preference and persists it *before* the
   paywall mounts, so the paywall can name the exact day.
4. `paywall.tsx` mounts `PaywallWebView` with the current offering.
5. On dismiss, if `ENABLE_EXIT_OFFER` is on and this is the first dismissal of
   the cold launch, it diverts to `paywall-promo.tsx` instead of closing, and
   registers a home-screen quick action.

### Price-point A/B

RevenueCat decides the arm by serving either `webview-weekly` or
`webview-weekly-high` as `current`. The app never picks — it only stays
*consistent*: `promoOfferingIdFor()` maps whichever arm the user saw to the
matching discount offering, so a high-price user can't be handed the standard
discount on exit and undercut the test. Keyed off the `-high` id suffix, so a
new arm needs no app release.

## Install

```bash
npx expo install \
  react-native-purchases react-native-webview react-native-safe-area-context \
  expo-router expo-video expo-haptics expo-quick-actions expo-constants \
  expo-tracking-transparency expo-linear-gradient lottie-react-native \
  lucide-react-native @react-native-async-storage/async-storage \
  @react-navigation/native @expo-google-fonts/nunito
```

Versions this was extracted against: Expo SDK 54, `react-native-purchases` ^9.7.1,
`react-native-webview` 13.15.0, `expo-router` ~6.0.23, NativeWind ^4.2.1.

Imports use the `@/` alias — add to `tsconfig.json`:

```json
{ "compilerOptions": { "paths": { "@/*": ["./*"] } } }
```

And to `tailwind.config.js`, since the UI uses Nunito weight classes:

```js
fontFamily: {
  nunito: ['Nunito_400Regular'],
  'nunito-semi': ['Nunito_600SemiBold'],
  'nunito-bold': ['Nunito_700Bold'],
  'nunito-extra': ['Nunito_800ExtraBold'],
}
```

## Notes

- Every string marked `TODO` is placeholder copy — replace it.
- Analytics call sites are worth keeping even if you rewrite the bodies: they
  sit at exactly the points that matter for subscription reporting, and the
  comments in `PaywallWebView` explain why trial vs purchase is reported the way
  it is per platform (auto-detection double-counting is a real trap).
- Storefront country comes from RevenueCat, not the device locale — a user's
  billing country and their phone's language are frequently different.
