import { Stack } from 'expo-router';
import React from 'react';

export default function PaywallSequenceLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true, // Enable gestures by default
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen 
        name="page1" 
        options={{ gestureEnabled: false }} // Disable only for page1
      />
      <Stack.Screen name="page2" />
      <Stack.Screen 
        name="no-trial-page-1" 
        options={{ gestureEnabled: false }} // Disable for no-trial-page-1 too
      />
      <Stack.Screen name="no-trial-app-launch" />
    </Stack>
  );
}
