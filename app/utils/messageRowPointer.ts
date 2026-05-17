/** Max pointer movement (px) to treat pointerup as a tap, not a scroll. */
export const MESSAGE_ROW_TAP_MOVE_THRESHOLD_PX = 10;

const INTERACTIVE_ROW_SELECTOR = [
  "button",
  "a",
  "img",
  "[data-reaction-chip]",
  "[data-thread-preview]",
].join(", ");

export function isInteractiveMessageRowTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(target.closest(INTERACTIVE_ROW_SELECTOR));
}

export function isWithinMessageRowTapThreshold(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  thresholdPx: number = MESSAGE_ROW_TAP_MOVE_THRESHOLD_PX,
): boolean {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  return Math.hypot(deltaX, deltaY) <= thresholdPx;
}
