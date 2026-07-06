let _installPrompt: any = null;
const _listeners: Set<() => void> = new Set();

export function setInstallPrompt(prompt: any): void {
  _installPrompt = prompt;
  _listeners.forEach(fn => fn());
}

export function getInstallPrompt(): any { return _installPrompt; }

export function onInstallPromptChange(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export async function triggerInstall(): Promise<"accepted" | "dismissed" | null> {
  if (!_installPrompt) return null;
  _installPrompt.prompt();
  const { outcome } = await _installPrompt.userChoice;
  if (outcome === "accepted") { _installPrompt = null; }
  return outcome as "accepted" | "dismissed";
}

export function isInstallable(): boolean { return !!_installPrompt; }

export function isIosBrowser(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  return (window.navigator as any).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
}
