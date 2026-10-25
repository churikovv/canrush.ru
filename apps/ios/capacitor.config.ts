import type { CapacitorConfig } from '@capacitor/cli';

// Оболочка открывает живой сайт, как и Android-версия (apps/android): SSR, Server Actions и cookie-сессии Better Auth
// не переносятся в статическую сборку. CANRUSH_APP_URL — для отладки на локальном сервере (симулятор видит Mac
// как http://localhost:3000).
const url = process.env.CANRUSH_APP_URL ?? 'https://canrush.ru';

const config: CapacitorConfig = {
  appId: 'ru.canrush.app',
  appName: 'Canrush',
  webDir: 'www',
  appendUserAgent: 'CanrushApp/iOS',
  server: {
    url,
    cleartext: url.startsWith('http://'),
    // Показывается, если сайт не загрузился (нет сети, сервер недоступен).
    errorPath: 'offline.html',
  },
  ios: {
    // Страница сама учитывает вырезы, складку iPhone Duo и домашнюю полосу через env(safe-area-inset-*):
    // WebView тянется на весь экран, без системных отступов поверх.
    contentInset: 'never',
    // Долгое нажатие на ссылку не открывает превью Safari — как в приложении, а не в браузере.
    allowsLinkPreview: false,
    // Страницу прокручивает сам WebView: у сайта нет своего контейнера прокрутки.
    scrollEnabled: true,
    webContentsDebuggingEnabled: process.env.CANRUSH_APP_DEBUG === '1',
    preferredContentMode: 'mobile',
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
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
