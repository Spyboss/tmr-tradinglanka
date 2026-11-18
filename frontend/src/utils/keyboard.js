// Shared rules for when a page-level keyboard shortcut may fire.
//
// Every hook and component that binds a bare-key shortcut uses these, so a
// key behaves the same everywhere: it is ignored while the user is typing,
// and it is ignored while an antd overlay owns the keyboard. Nothing else
// disables it.

const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

// True when the event landed in a field that expects the typed characters.
export const isTypingTarget = (target) =>
  !!(target && typeof target.closest === 'function' && target.closest(EDITABLE_SELECTOR));

// antd keeps closed overlays mounted, so "exists" is not "is open". An
// overlay only owns the keyboard while it actually renders boxes. The
// [aria-modal] entry also covers hand-rolled dialogs such as the install
// prompt: they sit on top of a list just as effectively as an antd modal.
const OVERLAY_SELECTOR = [
  '[aria-modal="true"]',
  '.ant-modal-wrap',
  '.ant-drawer-content-wrapper',
  '.ant-popover',
  '.ant-select-dropdown',
  '.ant-picker-dropdown',
  '.ant-dropdown',
].join(',');

export const overlayOwnsKeyboard = () => {
  const overlays = document.querySelectorAll(OVERLAY_SELECTOR);
  for (let i = 0; i < overlays.length; i += 1) {
    if (overlays[i].getClientRects().length > 0) return true;
  }
  return false;
};

// One DOM walk per keyboard event, shared by every bound shortcut: a dozen
// handlers must not each ask the same question again.
const overlayCache = new WeakMap();
const overlayFor = (event) => {
  if (!overlayCache.has(event)) overlayCache.set(event, overlayOwnsKeyboard());
  return overlayCache.get(event);
};

// Row navigation and single-letter actions: available whenever the page is
// idle. A focused button or link deliberately does NOT block these, because
// clicking a toolbar button used to leave focus on it and silently kill every
// list shortcut until the user clicked somewhere neutral.
export const shortcutsAllowed = (event) =>
  !isTypingTarget(event.target) && !overlayFor(event);

// Enter belongs to a focused control first: pressing it while the Delete
// button is focused must confirm that button, not open the selected row.
const CONTROL_SELECTOR = [
  'button',
  'a[href]',
  '[role="button"]',
  '[role="link"]',
  '[role="combobox"]',
  '[role="switch"]',
  '[role="tab"]',
  'summary',
].join(',');

export const controlHasFocus = (target) =>
  !!(target && typeof target.closest === 'function' && target.closest(CONTROL_SELECTOR));

export const shortcutsAllowedExceptOnControls = (event) =>
  shortcutsAllowed(event) && !controlHasFocus(event.target);
