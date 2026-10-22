// Android-оболочка (apps/android) грузит сайт в WebView, и Capacitor встраивает в страницу
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
interface CapacitorBridge {
  getPlatform?: () => string;
  Plugins?: {
    Share?: { share(options: ShareOptions): Promise<unknown> };
    PushNotifications?: NativePushPlugin;
    CanrushPush?: CanrushPushPlugin;
    SplashScreen?: { hide(options?: { fadeOutDuration?: number }): Promise<void> };
  };
}

/** Removes the blue launch screen once the page is painted (otherwise it stays up to launchShowDuration). */
export function hideSplash(): void {
  void bridge()?.Plugins?.SplashScreen?.hide({ fadeOutDuration: 250 }).catch(() => {});
}

/**
 * Push in the app: the permission and FCM go through `@capacitor/push-notifications` (`fcm` — the build carries
 * Firebase config); `rustoreToken` asks RuStore Push for phones without Google services (null when RuStore
 * is not installed, the build is signed with another key, or the app predates RuStore support).
 */
export interface NativePush { plugin: NativePushPlugin; fcm: boolean; rustoreToken(): Promise<string | null> }

export async function nativePush(): Promise<NativePush | null> {
  const plugins = bridge()?.Plugins;
  const plugin = plugins?.PushNotifications, shell = plugins?.CanrushPush;
  if (!plugin || !shell) return null;
  const fcm = await shell.status().then(status => status.fcm, () => false);
  return { plugin, fcm, rustoreToken: () => shell.rustoreToken().then(result => result.token || null, () => null) };
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
