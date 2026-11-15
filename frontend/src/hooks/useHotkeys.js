import { useEffect, useRef } from 'react';

// Central keyboard-shortcut registry for keyboard-driven usage.
//
// Pages call useHotkeys([...]) to register shortcuts; the ShortcutHelp
// overlay (?) reads the registry so its list is always accurate for the
// current page. A single global keydown listener dispatches, and every
// shortcut is blocked while the user is typing or an antd overlay
// (select dropdown, date picker, modal, popconfirm) owns the keyboard.

const registry = new Map();
let listenerInstalled = false;
let nextId = 0;

const isEditableElement = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
};

// True while something else owns the keyboard: typing in a field, or an
// open antd dropdown / picker / modal / popconfirm. This is the guard that
// stops single-letter shortcuts from firing mid-typing or behind a dialog.
const keyboardIsBusy = () => {
  if (isEditableElement(document.activeElement)) return true;
  return !!document.querySelector(
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden),' +
    '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden),' +
    '.ant-modal-wrap,' +
    '.ant-popover:not(.ant-popover-hidden),' +
    '.ant-dropdown:not(.ant-dropdown-hidden)'
  );
};

// Focus the current page's search box (any element marked data-page-search).
// Selects existing text so the next keystroke replaces the query.
export const focusPageSearch = () => {
  const marker = document.querySelector('[data-page-search]');
  if (!marker) return false;
  const input = marker.tagName === 'INPUT' ? marker : marker.querySelector('input');
  if (!input) return false;
  input.focus();
  if (typeof input.select === 'function') input.select();
  return true;
};

// Focus the first keyboard-navigable table row (used by ArrowDown in
// search boxes to jump into the results list).
export const focusFirstRow = () => {
  const row = document.querySelector('.ant-table-tbody tr[tabindex]');
  if (!row) return false;
  row.focus();
  return true;
};

// Single characters match case-insensitively (Caps Lock gives 'N'); named
// keys like ArrowDown and Escape pass through unchanged.
const normalizeKey = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);

const handleKeyDown = (e) => {
  // Ctrl/Cmd/Alt combos belong to the browser (reload, find, close tab...)
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // Escape inside the page search box leaves it. Checked before the busy
  // guard because the search box is an input (the guard would skip it).
  if (e.key === 'Escape') {
    const active = document.activeElement;
    if (active && active.closest && active.closest('[data-page-search]')) {
      active.blur();
    }
    return;
  }

  if (keyboardIsBusy()) return;

  const key = normalizeKey(e);
  for (const getShortcuts of registry.values()) {
    for (const shortcut of getShortcuts()) {
      if (!shortcut.handler || shortcut.key !== key) continue;
      e.preventDefault();
      shortcut.handler(e);
      return;
    }
  }
};

const ensureListener = () => {
  if (listenerInstalled) return;
  window.addEventListener('keydown', handleKeyDown);
  listenerInstalled = true;
};

// Register shortcuts for the lifetime of the calling component.
// shortcuts: [{ key: 'n', description: 'New bill', handler: fn }]
// Entries without a handler are display-only (shown in the ? help overlay).
// The latest array is used on every keypress, so handlers never go stale.
export default function useHotkeys(shortcuts) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const id = ++nextId;
    registry.set(id, () => shortcutsRef.current || []);
    ensureListener();
    return () => {
      registry.delete(id);
    };
  }, []);
}

// All shortcuts currently registered by mounted components, deduped.
export const getRegisteredShortcuts = () => {
  const seen = new Set();
  const result = [];
  for (const getShortcuts of registry.values()) {
    for (const shortcut of getShortcuts()) {
      const signature = `${shortcut.key}|${shortcut.description}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      result.push(shortcut);
    }
  }
  return result;
};
