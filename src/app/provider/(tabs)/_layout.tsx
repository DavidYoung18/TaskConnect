import { Stack } from 'expo-router';

// No tab bar here anymore — each of the 4 screens (home/availability/chat/profile)
// renders its own <ProviderBottomNav>, the same floating-glass-island component
// (and the same pattern) as every customer screen renders <CustomerBottomNav>. This
// used to be Expo Router's native <Tabs>, which docks a bar the OS renders itself —
// there's no way to turn that into a floating glass pill via style props, hence the
// switch to a plain Stack + per-screen custom nav.
export default function ProviderTabsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
