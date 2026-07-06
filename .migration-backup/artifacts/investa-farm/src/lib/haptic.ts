export type HapticPattern = "light" | "medium" | "heavy" | "success" | "error" | "warning";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light:   30,
  medium:  50,
  heavy:   80,
  success: [30, 50, 30],
  error:   [80, 30, 80],
  warning: [60, 40, 60],
};

export function haptic(type: HapticPattern = "light"): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(PATTERNS[type]);
    }
  } catch {
  }
}
