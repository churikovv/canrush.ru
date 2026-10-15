/** Client-side state of the Telegram Mini App shell. Empty outside Telegram. */

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { start_param?: string };
  ready(): void;
  expand(): void;
  openLink(url: string): void;
  openTelegramLink(url: string): void;
  showAlert(message: string): void;
  BackButton: {
    show(): void;
    hide(): void;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export type TelegramAuthState = 'idle' | 'signing-in' | 'signed-in' | 'unlinked';

export interface TelegramAppState {
  webApp: TelegramWebApp | null;
  auth: TelegramAuthState;
}

const SERVER_STATE: TelegramAppState = { webApp: null, auth: 'idle' };
let state: TelegramAppState = SERVER_STATE;
const listeners = new Set<() => void>();

export function getTelegramAppState(): TelegramAppState {
  return state;
}

export function getServerTelegramAppState(): TelegramAppState {
  return SERVER_STATE;
}

export function setTelegramAppState(next: Partial<TelegramAppState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function subscribeTelegramApp(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
