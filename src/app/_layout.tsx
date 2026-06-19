import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="home" />
      <Stack.Screen name="providers" />
      <Stack.Screen name="provider-profile" />
      <Stack.Screen name="booking-confirm" />
      <Stack.Screen name="payment" />
      <Stack.Screen name="booking-success" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="bookings" />
    </Stack>
  );
}