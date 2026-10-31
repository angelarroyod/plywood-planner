import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  AtkinsonHyperlegibleNext_400Regular,
  AtkinsonHyperlegibleNext_600SemiBold,
  AtkinsonHyperlegibleNext_700Bold,
  AtkinsonHyperlegibleNext_800ExtraBold,
} from '@expo-google-fonts/atkinson-hyperlegible-next';
import {
  AtkinsonHyperlegibleMono_400Regular,
  AtkinsonHyperlegibleMono_700Bold,
} from '@expo-google-fonts/atkinson-hyperlegible-mono';
import { AppProvider } from '@/lib/app-provider';
import { PaletteProvider, usePalette, useScheme } from '@/theme';

export default function RootLayout() {
  const [ready] = useFonts({
    AtkinsonHyperlegibleNext_400Regular,
    AtkinsonHyperlegibleNext_600SemiBold,
    AtkinsonHyperlegibleNext_700Bold,
    AtkinsonHyperlegibleNext_800ExtraBold,
    AtkinsonHyperlegibleMono_400Regular,
    AtkinsonHyperlegibleMono_700Bold,
  });

  return (
    <PaletteProvider>
      <Shell ready={ready} />
    </PaletteProvider>
  );
}

function Shell({ ready }: { ready: boolean }) {
  const c = usePalette();
  const scheme = useScheme();

  // Every measurement is set in the mono — showing system fonts first would reflow every screen.
  if (!ready) return <View style={{ flex: 1, backgroundColor: c.paper }} />;

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style={scheme === 'night' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: c.paper },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="camera" options={{ presentation: 'fullScreenModal' }} />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
