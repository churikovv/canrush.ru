import type { CapacitorConfig } from '@capacitor/cli';

// Оболочка открывает живой сайт: SSR, Server Actions и cookie-сессии Better Auth
// не переносятся в статическую сборку. CANRUSH_APP_URL — для отладки на локальном
// сервере (эмулятор видит хост как http://10.0.2.2:3000).
const url = process.env.CANRUSH_APP_URL ?? 'https://canrush.ru';

const config: CapacitorConfig = {
  appId: 'ru.canrush.app',
  appName: 'Canrush',
  webDir: 'www',
  appendUserAgent: 'CanrushApp/Android',
  server: {
    url,
    cleartext: url.startsWith('http://'),
    // Показывается, если сайт не загрузился (нет сети, сервер недоступен).
    errorPath: 'offline.html',
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: process.env.CANRUSH_APP_DEBUG === '1',
  },
  plugins: {
    // Сайт прячет заставку сам, когда страница готова (NativeAppShell); 3 с — предел, если сайт не ответил.
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      launchFadeOutDuration: 250,
      backgroundColor: '#006eff',
      showSpinner: false,
    },
  },
};

export default config;
