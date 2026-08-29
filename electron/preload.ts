import { contextBridge, ipcRenderer } from "electron";

/**
 * Preload script — runs in a sandboxed context between
 * the renderer (React app) and the main process.
 *
 * Only expose what is strictly necessary. DineQR doesn't need
 * filesystem access, shell commands, or other Node.js APIs —
 * all backend work goes through Firebase.
 */
contextBridge.exposeInMainWorld("electronAPI", {
  /** Application metadata */
  platform: process.platform,
  isElectron: true,

  /**
   * Runs Google's desktop OAuth flow in the system browser and resolves with
   * an ID token for firebase/auth signInWithCredential().
   */
  signInWithGoogle: (config: { clientId: string; clientSecret?: string }): Promise<string> =>
    ipcRenderer.invoke("auth:google", config),
});
