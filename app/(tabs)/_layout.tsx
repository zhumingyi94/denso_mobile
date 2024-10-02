import React from 'react';
import { Stack } from 'expo-router';

export default function TabLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="two"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
