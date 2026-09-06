import { Buffer } from 'node:buffer';

export interface AuthEnv {
  authSecret: string;
  authUrl: string;
  databaseUrl: string;
}

export interface SmtpEnv {
  fromName: string;
  host: string;
  password: string;
  port: number;
  user: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseUrl(name: string, protocols: string[]): URL {
  const value = required(name);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!protocols.includes(url.protocol)) throw new Error(`${name} uses an unsupported protocol`);
  return url;
}

export function getAuthEnv(): AuthEnv {
  const authUrl = parseUrl('BETTER_AUTH_URL', ['http:', 'https:']);
  if (authUrl.pathname !== '/' || authUrl.search || authUrl.hash) {
    throw new Error('BETTER_AUTH_URL must contain only the application origin');
  }
  if (
    process.env.NODE_ENV === 'production' &&
    authUrl.protocol !== 'https:' &&
    !['localhost', '127.0.0.1'].includes(authUrl.hostname)
  ) {
    throw new Error('BETTER_AUTH_URL must use HTTPS in production');
  }

  const databaseUrl = parseUrl('DATABASE_URL', ['postgres:', 'postgresql:']).toString();
  const authSecret = required('BETTER_AUTH_SECRET');
  if (Buffer.byteLength(authSecret, 'utf8') < 32) {
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 bytes');
  }

  return {
    authSecret,
    authUrl: authUrl.origin,
    databaseUrl,
  };
}

export function getSmtpEnv(): SmtpEnv {
  const port = Number(required('SMTP_PORT'));
  if (!Number.isInteger(port) || port !== 465) throw new Error('SMTP_PORT must be 465 for implicit TLS');

  const user = required('SMTP_USER');
  if (!user.includes('@')) throw new Error('SMTP_USER must be an email address');

  return {
    fromName: required('MAIL_FROM_NAME'),
    host: required('SMTP_HOST'),
    password: required('SMTP_PASSWORD'),
    port,
    user,
  };
}
