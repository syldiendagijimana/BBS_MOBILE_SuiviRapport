import React, { useEffect } from 'react';
import { StatusBar, LogBox, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider, DefaultTheme } from 'react-native-paper';
import Toast from 'react-native-toast-message';

import { AuthProvider } from './src/context/AuthContext';
import Navigation from './src/navigation';
import { Colors } from './src/theme';

const paperTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    accent: Colors.secondary,
    background: Colors.background,
    surface: Colors.surface,
    text: Colors.textPrimary,
    error: Colors.danger,
  },
};

if (__DEV__) {
  LogBox.ignoreLogs([
    'ReactNativeFiberHostComponent',
    'ViewPropTypes will be removed',
    'ColorPropType will be removed',
    'Require cycle:',
    'Remote debugger',
    'Warning: Failed prop type',
    'Warning: Each child in a list should have a unique "key" prop',
  ]);
}

export default function App() {
  useEffect(() => {
    StatusBar.setBarStyle('light-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(Colors.primaryDark);
      StatusBar.setTranslucent(false);
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <AuthProvider>
            <Navigation />
            <Toast position="bottom" bottomOffset={20} visibilityTime={3000} autoHide />
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}