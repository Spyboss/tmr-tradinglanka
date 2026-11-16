import { useState, useEffect, useCallback, useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

// Keyboard-driven list navigation, shared by the list pages (BillList,
// QuotationList, and later Inventory etc.).
//
// Model: ONE selected row (React state, not DOM focus) drives the action
// keys, so they behave identically no matter where focus is — the failure
// mode of v1, where keys worked only while a row happened to have DOM
// focus. Mouse hover and keyboard arrows move the same selection, and the
// row is highlighted visually, so what you see highlighted is always what
// Enter/e/p will act on.
//
// Typing is guarded by react-hotkeys-hook itself (hotkeys are skipped
// while the event target is an input/textarea/select); the guard below
// adds the antd cases the library cannot know about.

// True while an antd overlay owns the keyboard (modal, popconfirm,
// dropdown, date picker). Closed popups stay in the DOM but carry a
// -hidden class, so :not(-hidden) is what makes this correct.
const overlayOpen = () =>
  !!document.querySelector(
    '.ant-modal-wrap,' +
    '.ant-popover:not(.ant-popover-hidden),' +
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden),' +
    '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden),' +
    '.ant-dropdown:not(.ant-dropdown-hidden)'
  );

// List shortcuts fire only when the page is idle: no overlay owns the
// keyboard and no button or link has focus (their native Enter/Space must
// win, otherwise pressing Enter on a focused Delete button would also
// navigate the row).
const shortcutGuard = (e) => {
  const t = e.target;
  if (t && t.closest && t.closest('button, a, [role="button"], [role="link"]')) return false;
  if (overlayOpen()) return false;
  return true;
};

// The current page's shortcut manifest, read by the '?' help overlay.
// Set by useListCursor on mount, cleared on unmount.
let pageShortcuts = [];
export const getPageShortcuts = () => pageShortcuts;

export default function useListCursor({
  items = [],
  onOpen,
  onEdit,
  onDownload,
  onCreate,
  shortcuts = [],
  resetKey = '',
}) {
  const [selected, setSelected] = useState(-1);

  // Keep the '?' help overlay in sync with this page's shortcuts.
  useEffect(() => {
    pageShortcuts = shortcuts;
    return () => {
      pageShortcuts = [];
    };
  }, [shortcuts]);

  // Reset the selection whenever the result set changes identity (new
  // search, filter or page), so a shortcut never silently acts on a row
  // the user has not seen.
  // keepNextReset: set right after committing a search, so the reset that
  // follows the commit does not clear the "select first row" it triggers.
  const keepNextReset = useRef(false);
  useEffect(() => {
    if (keepNextReset.current) {
      keepNextReset.current = false;
      return;
    }
    setSelected(-1);
  }, [resetKey]);

  // Clamp when the list shrinks (delete, narrower results).
  useEffect(() => {
    setSelected((prev) => {
      if (prev < items.length) return prev;
      return items.length ? items.length - 1 : -1;
    });
  }, [items.length]);

  // Keyboard moves scroll the selected row into view. Mouse moves don't
  // need it: the row under the cursor is already visible, so this is a
  // no-op there (block: 'nearest').
  useEffect(() => {
    if (selected < 0) return;
    document.querySelector('tr.row-active')?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const move = useCallback(
    (delta) => {
      setSelected((prev) => {
        if (items.length === 0) return -1;
        if (prev < 0) return 0;
        return Math.min(Math.max(prev + delta, 0), items.length - 1);
      });
    },
    [items.length]
  );

  const selectedRecord =
    selected >= 0 && selected < items.length ? items[selected] : null;

  // Focus the page's search box ('/'). The data-page-search marker is
  // spread through to the raw input by antd/rc-input, so the marker IS
  // the input.
  const focusSearch = useCallback(() => {
    const marker = document.querySelector('[data-page-search]');
    if (!marker) return;
    const input = marker.tagName === 'INPUT' ? marker : marker.querySelector('input');
    if (!input) return;
    input.focus();
    if (typeof input.select === 'function') input.select();
  }, []);

  // Shortcuts are global on the page and guarded by shortcutGuard.
  // Callbacks do their own preventDefault: the library applies the
  // preventDefault OPTION before the enabled guard, which would eat
  // native Enter/Space on the buttons we deliberately ignore.
  useHotkeys('ArrowDown,j', (e) => {
    e.preventDefault();
    move(1);
  }, { enabled: shortcutGuard });

  useHotkeys('ArrowUp,k', (e) => {
    e.preventDefault();
    move(-1);
  }, { enabled: shortcutGuard });

  useHotkeys('Enter', (e) => {
    if (!selectedRecord) return;
    e.preventDefault();
    onOpen?.(selectedRecord);
  }, { enabled: shortcutGuard });

  useHotkeys('e', (e) => {
    if (!selectedRecord) return;
    e.preventDefault();
    onEdit?.(selectedRecord);
  }, { enabled: shortcutGuard });

  useHotkeys('p', (e) => {
    if (!selectedRecord) return;
    e.preventDefault();
    onDownload?.(selectedRecord);
  }, { enabled: shortcutGuard });

  useHotkeys('n', (e) => {
    if (!onCreate) return;
    e.preventDefault();
    onCreate();
  }, { enabled: shortcutGuard });

  // '/' is a produced character (Shift on some layouts): match the
  // produced key and ignore modifier state, per the library docs.
  useHotkeys('/', (e) => {
    e.preventDefault();
    focusSearch();
  }, { enabled: shortcutGuard, useKey: true, ignoreModifiers: true });

  useHotkeys('Escape', (e) => {
    if (selected < 0) return;
    e.preventDefault();
    setSelected(-1);
  }, { enabled: shortcutGuard });

  // ArrowDown from the search box: leave typing mode and select the first
  // row. `committing` is true when the caller just changed the search
  // state, so the reset that follows the commit keeps this selection.
  const moveFromSearch = useCallback(
    (e, committing = false) => {
      if (committing) keepNextReset.current = true;
      setSelected(items.length ? 0 : -1);
      e.currentTarget.blur();
    },
    [items.length]
  );

  // Highlight helper for antd Table's rowClassName.
  const rowClassName = useCallback(
    (record, index) => (index === selected ? 'row-active' : ''),
    [selected]
  );

  return { selected, selectedRecord, setSelected, move, moveFromSearch, focusSearch, rowClassName };
}
