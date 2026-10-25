// Оболочки Android (apps/android) и iOS (apps/ios) грузят сайт в WebView, и Capacitor встраивает в страницу
// свой мост `window.Capacitor`. Сайт вызывает нативные модули только через этот файл.

interface ShareOptions { title?: string; text?: string; url?: string; dialogTitle?: string }
interface PluginListener { remove(): Promise<void> }
type PushPermission = { receive: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied' };
/** `@capacitor/push-notifications` (FCM). */
export interface NativePushPlugin {
  checkPermissions(): Promise<PushPermission>;
  requestPermissions(): Promise<PushPermission>;
  register(): Promise<void>;
  addListener(event: 'registration', callback: (token: { value: string }) => void): Promise<PluginListener>;
  addListener(event: 'registrationError', callback: (error: { error: string }) => void): Promise<PluginListener>;
  addListener(event: 'pushNotificationActionPerformed', callback: (action: { notification: { data?: Record<string, unknown> } }) => void): Promise<PluginListener>;
}
/** The shell's own plugin (apps/android CanrushPushPlugin): Firebase config in this build and the RuStore Push token. */
interface CanrushPushPlugin { status(): Promise<{ fcm: boolean }>; rustoreToken(): Promise<{ token: string }> }
/** The shell's CanrushImagePlugin (app 1.2+): saves a PNG to Pictures/CanRush or opens the share sheet with it. */
interface CanrushImagePlugin {
  save(options: { data: string; fileName: string }): Promise<void>;
  share(options: { data: string; fileName: string; title?: string }): Promise<void>;
}
interface CapacitorBridge {
  getPlatform?: () => string;
  Plugins?: {
    Share?: { share(options: ShareOptions): Promise<unknown> };
    PushNotifications?: NativePushPlugin;
    CanrushPush?: CanrushPushPlugin;
    SplashScreen?: { hide(options?: { fadeOutDuration?: number }): Promise<void> };
    SystemBars?: { setStyle(options: { style: 'LIGHT' | 'DARK' | 'DEFAULT'; bar?: string }): Promise<void> };
    CanrushBars?: { setColors(options: { top: string; bottom: string }): Promise<void> };
    CanrushImage?: CanrushImagePlugin;
  };
}

/**
 * Status and navigation bars: icons light on a dark site theme (`DARK` = dark bar background), dark otherwise;
 * `colors` (#rrggbb) fill the bars on old WebViews that cannot draw under them. SystemBars resets the window
 * background when it restyles, so the colours go second.
 */
export async function setSystemBars(dark: boolean, colors: { top: string; bottom: string }): Promise<void> {
  const plugins = bridge()?.Plugins;
  await plugins?.SystemBars?.setStyle({ style: dark ? 'DARK' : 'LIGHT' }).catch(() => {});
  await plugins?.CanrushBars?.setColors(colors).catch(() => {});
}

/**
 * Screenshots in the app: the WebView can neither download a blob link nor copy an image. On Android the PNG goes to
 * the shell as base64 (`CanrushImage`: saved to Pictures/CanRush); on iOS WKWebView shares files itself, and «Сохранить
 * изображение» in that sheet puts it in Photos — `viaSheet` tells the caller saving opens the same sheet. Null outside
 * the app or in an Android app version without the module.
 */
export function nativeImage(): { viaSheet: boolean; save(blob: Blob, fileName: string): Promise<void>; share(blob: Blob, fileName: string, title?: string): Promise<void> } | null {
  if (isNativeIos()) {
    const sheet = async (blob: Blob, fileName: string, title?: string) => {
      const file = new File([blob], fileName, { type: 'image/png' });
      if (!navigator.canShare?.({ files: [file] })) throw new Error('Sharing files is unavailable');
      try { await navigator.share({ files: [file], title }); }
      catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) throw error; }
    };
    return { viaSheet: true, save: (blob, fileName) => sheet(blob, fileName), share: sheet };
  }
  const plugin = bridge()?.Plugins?.CanrushImage;
  if (!plugin) return null;
  return {
    viaSheet: false,
    save: async (blob, fileName) => plugin.save({ data: await base64(blob), fileName }),
    share: async (blob, fileName, title) => plugin.share({ data: await base64(blob), fileName, title }),
  };
}

function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/u, ''));
    reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать изображение'));
    reader.readAsDataURL(blob);
  });
}

/** Removes the blue launch screen once the page is painted (otherwise it stays up to launchShowDuration). */
export function hideSplash(): void {
  void bridge()?.Plugins?.SplashScreen?.hide({ fadeOutDuration: 250 }).catch(() => {});
}

/**
 * Push in the app: the permission and the token go through `@capacitor/push-notifications`. `provider` — what its
 * `registration` token is: `apns` on iOS (an Apple device token), `fcm` on Android when the build carries Firebase
 * config, null otherwise; `rustoreToken` asks RuStore Push for Android phones without Google services (null when
 * RuStore is not installed, the build is signed with another key, the app predates RuStore support, or on iOS).
 */
export interface NativePush { plugin: NativePushPlugin; provider: 'fcm' | 'apns' | null; rustoreToken(): Promise<string | null> }

export async function nativePush(): Promise<NativePush | null> {
  const capacitor = bridge();
  const plugin = capacitor?.Plugins?.PushNotifications;
  if (!plugin) return null;
  if (capacitor?.getPlatform?.() === 'ios') return { plugin, provider: 'apns', rustoreToken: async () => null };
  const shell = capacitor?.Plugins?.CanrushPush;
  if (!shell) return null;
  const fcm = await shell.status().then(status => status.fcm, () => false);
  return { plugin, provider: fcm ? 'fcm' : null, rustoreToken: () => shell.rustoreToken().then(result => result.token || null, () => null) };
}

/** The app runs on iOS/iPadOS (apps/ios), where WKWebView shares files through `navigator.share`. */
export function isNativeIos(): boolean {
  return bridge()?.getPlatform?.() === 'ios';
}

const PUSH_TOKEN_KEY = 'canrush:push-token';
/** The device's last registered token, so signing out can detach it from the account. */
export function storedPushToken(): string | null {
  try { return localStorage.getItem(PUSH_TOKEN_KEY); } catch { return null; }
}
export function storePushToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(PUSH_TOKEN_KEY, token);
    else localStorage.removeItem(PUSH_TOKEN_KEY);
  } catch { /* storage unavailable: the server drops stale tokens itself */ }
}

const APP_USER_AGENT = 'CanrushApp/';

function bridge(): CapacitorBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { Capacitor?: CapacitorBridge }).Capacitor;
}

/** Сайт открыт в приложении Canrush, а не в браузере. */
export function isNativeApp(): boolean {
  const platform = bridge()?.getPlatform?.();
  if (platform === 'android' || platform === 'ios') return true;
  return typeof navigator !== 'undefined' && navigator.userAgent.includes(APP_USER_AGENT);
}

/**
 * Системное меню «Поделиться» в приложении (в WebView нет `navigator.share`).
 * `unavailable` — не приложение или модуля нет, вызывающий сам выбирает запасной путь.
 */
export async function nativeShare(options: ShareOptions): Promise<'shared' | 'cancelled' | 'unavailable'> {
  const share = bridge()?.Plugins?.Share;
  if (!share) return 'unavailable';
  try {
    await share.share(options);
    return 'shared';
  } catch (error) {
    // Модуль отклоняет промис и при закрытии меню без выбора.
    if (error instanceof Error && /cancel/i.test(error.message)) return 'cancelled';
    return 'unavailable';
  }
}
