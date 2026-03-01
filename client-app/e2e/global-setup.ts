import { chromium, request } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
const COOKIE_DOMAIN = new URL(BASE_URL).hostname;
const PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH;

function fileExists(candidate: string): boolean {
  try {
    return fs.existsSync(candidate);
  } catch {
    return false;
  }
}

function listCandidatesForBrowserDir(dirPath: string): string[] {
  return [
    path.join(dirPath, 'chrome.exe'),
    path.join(dirPath, 'chrome-win', 'chrome.exe'),
    path.join(dirPath, 'chrome-win64', 'chrome.exe'),
    path.join(dirPath, 'chrome-headless-shell', 'chrome-headless-shell.exe'),
    path.join(dirPath, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
  ];
}

function findChromiumExecutableFromPlaywrightDir(playwrightDir: string): string[] {
  try {
    if (!fs.statSync(playwrightDir).isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const folderCandidates = fs
    .readdirSync(playwrightDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name.toLowerCase().startsWith('chromium'))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => path.join(playwrightDir, name))
    .flatMap((dir) => listCandidatesForBrowserDir(dir));

  return folderCandidates.filter(fileExists);
}

function getChromeFallbackCandidates(): string[] {
  if (os.platform() !== 'win32') {
    return [];
  }

  const programFiles = process.env.ProgramFiles;
  const programFilesX86 = process.env['ProgramFiles(x86)'];
  return [
    ...(programFiles ? [path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe')] : []),
    ...(programFilesX86
      ? [path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe')]
      : []),
    ...(programFiles ? [path.join(programFiles, 'Google', 'Chrome Beta', 'Application', 'chrome.exe')] : []),
    ...(programFilesX86
      ? [path.join(programFilesX86, 'Google', 'Chrome Beta', 'Application', 'chrome.exe')]
      : []),
    ...(programFiles ? [path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe')] : []),
  ].filter(fileExists);
}

function resolvePlayableChromiumPaths(): Array<string | undefined> {
  const candidates: Array<string> = [];

  if (PLAYWRIGHT_BROWSERS_PATH) {
    const explicit = PLAYWRIGHT_BROWSERS_PATH;

    // 특정 환경(파이썬 자동화 작업공간 등)에서 주입되는 임시 경로는 제외한다.
    const allowlistedRoots = ['ms-playwright', '.cache\\ms-playwright', '.cache/ms-playwright'];
    const isWhitelisted = allowlistedRoots.some((root) => explicit.includes(root));

    if (isWhitelisted && fileExists(explicit)) {
      if (explicit.toLowerCase().endsWith('.exe')) {
        candidates.push(explicit);
      } else {
        candidates.push(...findChromiumExecutableFromPlaywrightDir(explicit));
      }
    }
    delete process.env.PLAYWRIGHT_BROWSERS_PATH;
  }

  const home = os.homedir();
  const browserRoots: string[] = [
    path.join(home, 'AppData', 'Local', 'ms-playwright'),
    path.join(home, '.cache', 'ms-playwright'),
    path.join(home, '.cache', 'ms-playwright', 'chromium'),
  ];
  browserRoots.push(path.join(process.cwd(), 'node_modules', 'playwright-core', '.local-browsers'));
  browserRoots.push(path.join(process.cwd(), 'node_modules', 'playwright', '.local-browsers'));

  for (const root of browserRoots) {
    candidates.push(...findChromiumExecutableFromPlaywrightDir(root));
  }

  candidates.push(...getChromeFallbackCandidates());

  // 마지막 폴백: Playwright 기본 탐색(실패 시 내부에서 사용 경로를 선택)
  const unique = new Set(candidates.filter((candidate): candidate is string => !!candidate));
  return [...unique, undefined];
}

export const AUTH_DIR = path.join(__dirname, '.auth');
export const USER_STATE = path.join(AUTH_DIR, 'user.json');
export const ADMIN_STATE = path.join(AUTH_DIR, 'admin.json');

/**
 * Parse Set-Cookie header strings into Playwright cookie objects.
 */
function parseSetCookies(setCookieHeaders: string[]): Array<{
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}> {
  return setCookieHeaders.map((header) => {
    const parts = header.split(';').map((p) => p.trim());
    const [nameValue, ...attrs] = parts;
    const eqIdx = nameValue.indexOf('=');
    const name = nameValue.substring(0, eqIdx);
    const value = nameValue.substring(eqIdx + 1);

    const cookie: any = {
      name,
      value,
      domain: COOKIE_DOMAIN,
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    };

    for (const attr of attrs) {
      const lower = attr.toLowerCase();
      if (lower === 'httponly') {
        cookie.httpOnly = true;
      } else if (lower === 'secure') {
        cookie.secure = true;
      } else if (lower.startsWith('path=')) {
        cookie.path = attr.split('=')[1];
      } else if (lower.startsWith('domain=')) {
        cookie.domain = attr.split('=')[1];
      } else if (lower.startsWith('max-age=')) {
        const maxAge = parseInt(attr.split('=')[1], 10);
        cookie.expires = Math.floor(Date.now() / 1000) + maxAge;
      } else if (lower.startsWith('expires=')) {
        cookie.expires = Math.floor(new Date(attr.substring(8)).getTime() / 1000);
      } else if (lower.startsWith('samesite=')) {
        const val = attr.split('=')[1].toLowerCase();
        if (val === 'strict') cookie.sameSite = 'Strict';
        else if (val === 'none') cookie.sameSite = 'None';
        else cookie.sameSite = 'Lax';
      }
    }

    // Always force domain to match the test environment (backend may send domain=localhost)
    cookie.domain = COOKIE_DOMAIN;
    // Force secure=false for non-HTTPS environments (e.g. staging over HTTP)
    if (!BASE_URL.startsWith('https')) {
      cookie.secure = false;
    }

    return cookie;
  });
}

async function authenticate(
  browser: import('@playwright/test').Browser,
  role: 'USER' | 'ADMIN',
  outputPath: string,
) {
  // Use same emails as devLogin helper for consistency (ADMIN_EMAILS only needs one entry)
  const email = role === 'ADMIN' ? 'admin@dorami.shop' : 'buyer@test.com';

  // 1. Call dev-login API at Node.js level (bypasses CORS)
  const apiContext = await request.newContext({ baseURL: BACKEND_URL });

  const loginRes = await apiContext.post('/api/auth/dev-login', {
    data: { email, name: `E2E ${role}`, role },
  });

  if (!loginRes.ok()) {
    throw new Error(`dev-login failed: ${loginRes.status()}`);
  }

  const loginData = await loginRes.json();
  let user = loginData.data.user;

  // Extract cookies from response headers
  const setCookieHeaders = loginRes
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value);
  const cookies = parseSetCookies(setCookieHeaders);

  // 2. If USER, complete profile using the same API context (cookies auto-forwarded)
  if (role === 'USER') {
    // GET request triggers CSRF token cookie generation (guard sets csrf-token cookie on GET)
    const meCheck = await apiContext.get('/api/users/me');
    const meCheckData = meCheck.ok() ? (await meCheck.json()).data : null;

    // Only call complete-profile if fields are missing
    if (!meCheckData?.instagramId || !meCheckData?.depositorName) {
      const state = await apiContext.storageState();
      const csrfToken = state.cookies.find((c) => c.name === 'csrf-token')?.value ?? '';

      const profileRes = await apiContext.post('/api/users/complete-profile', {
        headers: { 'X-CSRF-Token': csrfToken },
        data: {
          depositorName: 'E2E테스트',
          instagramId: `@e2e_user_${user.id?.slice(0, 8) ?? 'test'}`,
          fullName: 'E2E Test User',
          address1: '123 Test Street',
          address2: 'Apt 1',
          city: 'New York',
          state: 'NY',
          zip: '10001',
          phone: '(212) 555-1234',
        },
      });
      if (!profileRes.ok()) {
        console.warn(`complete-profile: ${profileRes.status()} ${await profileRes.text()}`);
      }
    }
  }

  // 3. Fetch full user profile
  const meRes = await apiContext.get('/api/users/me');
  if (meRes.ok()) {
    const meData = await meRes.json();
    user = meData.data || user;
  }

  // Verify USER profile is complete — if not, useProfileGuard will redirect all
  // profile-guarded routes (/cart, /my-page) to /profile/register during tests.
  if (role === 'USER' && (!user?.instagramId || !user?.depositorName)) {
    throw new Error(
      `global-setup: USER profile incomplete after complete-profile call. ` +
        `instagramId=${user?.instagramId}, depositorName=${user?.depositorName}. ` +
        `Check that /api/users/complete-profile succeeded and /api/users/me returns the updated fields.`,
    );
  }

  await apiContext.dispose();

  // 4. Create browser context, set cookies and localStorage
  const context = await browser.newContext();
  await context.addCookies(cookies);

  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });

  // Seed Zustand auth-storage in localStorage
  await page.evaluate((userData) => {
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: { user: userData, isAuthenticated: true, isLoading: false },
        version: 0,
      }),
    );
  }, user);

  // Save storageState (cookies + localStorage)
  await context.storageState({ path: outputPath });
  await context.close();
}

async function globalSetup() {
  const executablePaths = resolvePlayableChromiumPaths();

  fs.mkdirSync(AUTH_DIR, { recursive: true });

  let lastError: unknown;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  for (const executablePath of executablePaths) {
    const launchOptions = {
      args: ['--no-sandbox'],
      ...(executablePath ? { executablePath } : {}),
    };
    try {
      browser = await chromium.launch(launchOptions);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!browser) {
    throw lastError instanceof Error ? lastError : new Error('Playwright browser launch failed');
  }
  await authenticate(browser, 'USER', USER_STATE);
  await authenticate(browser, 'ADMIN', ADMIN_STATE);
  await browser.close();
}

export default globalSetup;
