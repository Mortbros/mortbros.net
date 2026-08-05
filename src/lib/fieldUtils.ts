import { nextTick } from 'vue';

export const focusInput = async (ref: { $el?: { querySelector: (selector: string) => HTMLElement | null } } | null, selector = 'input', autoSelect = true) => {
  await nextTick();
  const element = ref?.$el?.querySelector(selector) as HTMLInputElement | null;
  if (element) {
    element.focus();
    if (autoSelect) {
      await nextTick();
      element.select();
    }
  }
};

/** The navigation callbacks every field component accepts. */
export interface FieldNav {
  onNext?: () => void;
  onPrevious?: () => void;
}

/**
 * Standard field navigation: Enter or Tab advances, Shift+Tab goes back.
 *
 * `beforeNavigate` runs after preventDefault but before moving focus — use it
 * to commit the field's value (see PlainListField).
 *
 * Returns true when the event was handled, so callers can add their own keys:
 *
 *   if (handleFieldNavigation(e, props)) return
 *   // …field-specific keys here
 */
export const handleFieldNavigation = (
  event: KeyboardEvent,
  nav: FieldNav,
  beforeNavigate?: () => void,
): boolean => {
  const forward = (event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey;
  const backward = event.key === 'Tab' && event.shiftKey;
  if (!forward && !backward) return false;

  event.preventDefault();
  beforeNavigate?.();
  if (forward) nav.onNext?.();
  else nav.onPrevious?.();
  return true;
};

export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTodayDate = (): string => {
  return formatDate(new Date());
};

export const getYesterdayDate = (): string => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return formatDate(yesterday);
};
