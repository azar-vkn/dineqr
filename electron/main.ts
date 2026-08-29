import { app, BrowserWindow, shell, ipcMain, dialog } from "electron";
import path from "path";
import http from "http";
import crypto from "crypto";
import { AddressInfo } from "net";

// ── Disable GPU acceleration to prevent invisible/blank window issues on Windows ──
app.disableHardwareAcceleration();

// ── Constants ─────────────────────────────────────────────────
const isDev = !app.isPackaged;
const APP_TITLE = "DineQR — Smart Restaurant Ordering";
const MIN_WIDTH = 1024;
const MIN_HEIGHT = 700;
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;

let mainWindow: BrowserWindow | null = null;
let sandboxFailureReported = false;

// ── Single Instance Lock ──────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // ── App Lifecycle ───────────────────────────────────────────
  // A GPU/utility process denied by the OS sandbox kills the app before any
  // window event fires, so this has to be listened for app-wide, once.
  app.on("child-process-gone", (_event, details) => {
    console.error("Child process gone:", details);
    if (details.exitCode === STATUS_ACCESS_DENIED) {
      reportSandboxFailure(`${details.type} process exited with ${hex(details.exitCode)}`);
    }
  });

  app.whenReady().then(() => {
    registerGoogleAuthHandler();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

/**
 * Child processes (renderer / GPU) exiting with STATUS_ACCESS_DENIED means
 * the OS refused to start Chromium's sandbox — almost always third-party
 * security software blocking an unsigned binary. Nothing the app can do at
 * runtime, so surface a real explanation instead of a blank window.
 */
const STATUS_ACCESS_DENIED = -1073741790;

function hex(code: number): string {
  return `0x${(code >>> 0).toString(16).toUpperCase()}`;
}

function reportSandboxFailure(detail: string): void {
  if (sandboxFailureReported) return;
  sandboxFailureReported = true;

  dialog.showErrorBox(
    "DineQR could not start",
    "Windows blocked DineQR from starting its secure sandbox process.\n\n" +
      "This is normally caused by antivirus or endpoint-protection software " +
      "(for example Malwarebytes' Exploit Protection) blocking the application.\n\n" +
      "To fix it, add this folder to your security software's exclusion list:\n" +
      `${path.dirname(app.getPath("exe"))}\n\n` +
      `Technical detail: ${detail}`
  );
  app.quit();
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: APP_TITLE,
    show: true,
    center: true,
    backgroundColor: "#fafaf9",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
      webSecurity: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.webContents.on("console-message", (details) => {
    console.log(
      `[Renderer Console] ${details.message} (at ${details.sourceId}:${details.lineNumber})`
    );
  });

  // ── Crash & load diagnostics ──
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer process gone:", details);
    if (details.reason === "crashed" && details.exitCode === STATUS_ACCESS_DENIED) {
      reportSandboxFailure(`renderer exited with ${hex(details.exitCode)}`);
    }
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) return;
      console.error(`Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
    }
  );

  // ── Open external links in default browser ──
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Prevent navigation away from the app
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    if (devUrl && url.startsWith(devUrl)) {
      return;
    }
    if (url.startsWith("file://") || url.startsWith("http://localhost")) {
      return;
    }
    event.preventDefault();
    shell.openExternal(url);
  });

  // ── Load the app ──
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (isDev && devServerUrl) {
    mainWindow.loadURL(devServerUrl).catch((err) => {
      console.error("Failed to load dev server URL, falling back to dist:", err);
      loadLocalBuild();
    });
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    loadLocalBuild();
  }

  function loadLocalBuild() {
    const indexPath = path.join(__dirname, "../../dist/index.html");
    mainWindow?.loadFile(indexPath).catch((err) => {
      console.error("Failed to load local build:", err);
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── Google Sign-In (loopback OAuth + PKCE) ────────────────────
// signInWithPopup() cannot work in Electron — window.open is denied and the
// OAuth callback never returns. Instead we run the OAuth flow Google supports
// for desktop apps: open the system browser, catch the redirect on a local
// loopback server, then hand the resulting ID token back to the renderer so
// Firebase can consume it via signInWithCredential().

const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function closingPage(message: string): string {
  return `<!doctype html><meta charset="utf-8"><title>DineQR</title>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fafaf9;color:#1c1917">
<div style="text-align:center"><h2 style="color:#059669">${message}</h2>
<p style="color:#78716c">You can close this tab and return to DineQR.</p></div></body>`;
}

interface GoogleAuthConfig {
  clientId: string;
  clientSecret?: string;
}

function registerGoogleAuthHandler(): void {
  ipcMain.handle("auth:google", async (_event, config: GoogleAuthConfig) => {
    if (!config?.clientId) {
      throw new Error("Missing Google desktop OAuth client ID");
    }

    const verifier = base64url(crypto.randomBytes(32));
    const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
    const state = base64url(crypto.randomBytes(16));

    return new Promise<string>((resolve, reject) => {
      const server = http.createServer();
      let settled = false;

      const finish = (err: Error | null, token?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        server.close();
        if (err) reject(err);
        else resolve(token!);
      };

      const timer = setTimeout(
        () => finish(new Error("Google sign-in timed out")),
        AUTH_TIMEOUT_MS
      );

      server.on("request", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        const error = url.searchParams.get("error");
        const code = url.searchParams.get("code");

        if (error) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(closingPage("Sign-in cancelled"));
          return finish(new Error(error));
        }
        if (!code) {
          res.writeHead(404).end();
          return;
        }
        if (url.searchParams.get("state") !== state) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(closingPage("Sign-in failed"));
          return finish(new Error("OAuth state mismatch — possible CSRF"));
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(closingPage("Signed in successfully"));

        try {
          const port = (server.address() as AddressInfo).port;
          const body = new URLSearchParams({
            code,
            client_id: config.clientId,
            redirect_uri: `http://127.0.0.1:${port}`,
            grant_type: "authorization_code",
            code_verifier: verifier,
          });
          if (config.clientSecret) body.set("client_secret", config.clientSecret);

          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
          });
          const payload = (await tokenRes.json()) as {
            id_token?: string;
            error_description?: string;
            error?: string;
          };

          if (!tokenRes.ok || !payload.id_token) {
            throw new Error(
              payload.error_description ?? payload.error ?? "Token exchange failed"
            );
          }
          finish(null, payload.id_token);
        } catch (err) {
          finish(err as Error);
        }
      });

      server.on("error", (err) => finish(err));

      server.listen(0, "127.0.0.1", () => {
        const port = (server.address() as AddressInfo).port;
        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.searchParams.set("client_id", config.clientId);
        authUrl.searchParams.set("redirect_uri", `http://127.0.0.1:${port}`);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", "openid email profile");
        authUrl.searchParams.set("code_challenge", challenge);
        authUrl.searchParams.set("code_challenge_method", "S256");
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("prompt", "select_account");
        shell.openExternal(authUrl.toString());
      });
    });
  });
}

// Quit when all windows are closed (except macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
