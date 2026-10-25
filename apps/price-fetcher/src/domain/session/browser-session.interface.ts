export interface StorageStateInterface {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    /** Unix time in seconds, -1 for a session cookie. */
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
}

/** A browser session bound to the exit IP it was created with. */
export interface BrowserSessionInterface {
  id: string;
  exitIp: string;
  userAgent: string;
  platform: string;
  browserVersion: string;
  storageState: StorageStateInterface;
}
