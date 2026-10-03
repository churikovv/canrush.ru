'use client';
import { createContext, useContext, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';
interface NotificationIdentity { authenticated: boolean | null; unread: number }
const NotificationContext = createContext<{ identity: NotificationIdentity; setIdentity: Dispatch<SetStateAction<NotificationIdentity>> } | null>(null);
/** Root-layout state survives page navigation; no notification content is stored in browser storage. */
export function NotificationStateProvider({ children }: { children: ReactNode }) {
  const [identity,setIdentity] = useState<NotificationIdentity>({ authenticated: null, unread: 0 });
  return <NotificationContext.Provider value={{ identity,setIdentity }}>{children}</NotificationContext.Provider>;
}
export function useNotificationIdentity() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('NotificationStateProvider is required');
  return value;
}
