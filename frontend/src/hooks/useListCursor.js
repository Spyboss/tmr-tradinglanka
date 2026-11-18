import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { shortcutsAllowed, shortcutsAllowedExceptOnControls } from '../utils/keyboard';
import { listShortcutGroups, setPageShortcuts } from '../utils/shortcuts';

// Keyboard navigation for a list page: one table, one selected row.
//
// The selection is React state keyed by the record's id, never DOM focus. Two
// consequences matter:
//   * every action key (Enter, e, p) acts on the row that is highlighted, no
//     matter where the focus happens to be, and
//   * a refetch that still contains that record keeps the highlight, so
//     searching or reloading does not lose your place. A record that is gone
//     drops the selection by itself.
//
// The action keys bind only when the page supplies the matching callback, and
// the '?' overlay is built from the same decision — no dead keys in the help.

const defaultRowKey = (record) => record?._id ?? record?.id ?? record?.key;

const escapeForSelector = (value) =>
  typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : String(value).replace(/"/g, '\\"');

export default function useListCursor({
  items = [],
  noun = 'row',
  pageLabel,
  getRowKey = defaultRowKey,
  onOpen,
  onEdit,
  onDownload,
  onCreate,
  onCommitSearch,
}) {
  const [selectedKey, setSelectedKey] = useState(null);

  // Record ids compare as strings: they arrive as ObjectIds, numbers or
  // strings depending on the endpoint, and the DOM only ever holds strings.
  const keyOf = useCallback((record) => String(getRowKey(record)), [getRowKey]);

  // The rows the table is actually showing, in visual order. antd paginates
  // and sorts the data itself, so the incoming array is not the list the user
  // is moving through: without this, j walked past the last rendered row and
  // the highlight vanished into a page the user could not see. Falls back to
  // the incoming array when nothing is rendered (the mobile card lists).
  const visibleKeys = useCallback(() => {
    const rendered = Array.from(document.querySelectorAll('tr[data-row-key]'))
      .map((row) => row.getAttribute('data-row-key'));
    return rendered.length ? rendered : items.map(keyOf);
  }, [items, keyOf]);

  // Set when the user leaves the search box downwards: the rows on screen may
  // belong to a search that has not been committed yet, so after the next
  // result set arrives the first row is selected again. Typing, or pressing a
  // navigation key, clears it.
  const pendingFirstRow = useRef(false);

  const selectedIndex = selectedKey == null
    ? -1
    : items.findIndex((record) => keyOf(record) === selectedKey);
  const selectedRecord = selectedIndex >= 0 ? items[selectedIndex] : null;

  // Keep the '?' overlay in sync with what this page actually binds.
  const canOpen = !!onOpen;
  const canEdit = !!onEdit;
  const canDownload = !!onDownload;
  const canCreate = !!onCreate;

  const groups = useMemo(
    () => listShortcutGroups({ noun, canOpen, canEdit, canDownload, canCreate }),
    [noun, canOpen, canEdit, canDownload, canCreate]
  );

  useEffect(() => {
    setPageShortcuts({ pageLabel: pageLabel || noun, groups });
    return () => setPageShortcuts({ pageLabel: '', groups: [] });
  }, [groups, pageLabel, noun]);

  // Results arrive as a fresh array on every fetch, so this is "the list
  // changed". Honour a pending jump, then drop a selection whose row is gone.
  useEffect(() => {
    if (pendingFirstRow.current) {
      pendingFirstRow.current = false;
      const keys = visibleKeys();
      setSelectedKey(keys.length ? keys[0] : null);
      return;
    }
    setSelectedKey((previous) => {
      if (previous == null) return previous;
      return items.some((record) => keyOf(record) === previous) ? previous : null;
    });
    // getRowKey and visibleKeys are deliberately not dependencies: pages pass
    // inline functions, and this effect is about the arrival of new results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Following the selection with the viewport is what makes arrow keys usable
  // on a 20-row page. Keyboard moves land here; the row is already visible
  // when the pointer is what moved, so block: 'nearest' does nothing there.
  useEffect(() => {
    if (selectedKey == null) return;
    const row = document.querySelector(`tr[data-row-key="${escapeForSelector(selectedKey)}"]`);
    if (row) row.scrollIntoView({ block: 'nearest' });
  }, [selectedKey]);

  const clearSelection = useCallback(() => {
    pendingFirstRow.current = false;
    setSelectedKey(null);
  }, []);

  // From nothing selected, both directions select the first row: the point of
  // pressing j on a fresh list is "start here", not "do nothing".
  const move = useCallback(
    (delta) => {
      pendingFirstRow.current = false;
      const keys = visibleKeys();
      if (!keys.length) {
        setSelectedKey(null);
        return;
      }
      const from = selectedKey == null ? -1 : keys.indexOf(selectedKey);
      const next = from < 0 ? 0 : Math.min(Math.max(from + delta, 0), keys.length - 1);
      setSelectedKey(keys[next]);
    },
    [visibleKeys, selectedKey]
  );

  const jumpTo = useCallback(
    (edge) => {
      pendingFirstRow.current = false;
      const keys = visibleKeys();
      if (!keys.length) return;
      setSelectedKey(edge === 'last' ? keys[keys.length - 1] : keys[0]);
    },
    [visibleKeys]
  );

  // '/' — the marker is spread onto the raw input by antd, so the marker IS
  // the field. Returns false when the page has no search box, which leaves
  // the key alone instead of swallowing it.
  const focusSearch = useCallback(() => {
    const marker = document.querySelector('[data-page-search]');
    const input = !marker ? null : marker.tagName === 'INPUT' ? marker : marker.querySelector('input');
    if (!input) return false;
    input.focus();
    if (typeof input.select === 'function') input.select();
    return true;
  }, []);

  // Keys pressed inside the search box. The global handlers are disabled while
  // typing, so these three moves are handled locally.
  const searchKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.currentTarget.blur();
        clearSelection();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        // Pages that debounce their search commit it here, so the first row
        // selected below belongs to the query the user just typed.
        onCommitSearch?.();
        pendingFirstRow.current = true;
        const keys = visibleKeys();
        setSelectedKey(keys.length ? keys[0] : null);
        event.currentTarget.blur();
      }
    },
    [visibleKeys, clearSelection, onCommitSearch]
  );

  useHotkeys('ArrowDown,j', (event) => {
    event.preventDefault();
    move(1);
  }, { enabled: shortcutsAllowed });

  useHotkeys('ArrowUp,k', (event) => {
    event.preventDefault();
    move(-1);
  }, { enabled: shortcutsAllowed });

  useHotkeys('Home', (event) => {
    event.preventDefault();
    jumpTo('first');
  }, { enabled: shortcutsAllowed });

  useHotkeys('End', (event) => {
    event.preventDefault();
    jumpTo('last');
  }, { enabled: shortcutsAllowed });

  useHotkeys('Enter', (event) => {
    if (!selectedRecord) return;
    event.preventDefault();
    onOpen(selectedRecord);
  }, { enabled: (event) => canOpen && shortcutsAllowedExceptOnControls(event) });

  useHotkeys('e', (event) => {
    if (!selectedRecord) return;
    event.preventDefault();
    onEdit(selectedRecord);
  }, { enabled: (event) => canEdit && shortcutsAllowed(event) });

  useHotkeys('p', (event) => {
    if (!selectedRecord) return;
    event.preventDefault();
    onDownload(selectedRecord);
  }, { enabled: (event) => canDownload && shortcutsAllowed(event) });

  useHotkeys('n', (event) => {
    event.preventDefault();
    onCreate();
  }, { enabled: (event) => canCreate && shortcutsAllowed(event) });

  // '/' and '?' are produced characters (Shift on most layouts), so they are
  // matched on the produced key with modifiers ignored.
  useHotkeys('/', (event) => {
    if (focusSearch()) event.preventDefault();
  }, { enabled: shortcutsAllowed, useKey: true, ignoreModifiers: true });

  useHotkeys('Escape', (event) => {
    if (selectedKey == null) return;
    event.preventDefault();
    clearSelection();
  }, { enabled: shortcutsAllowed });

  // antd Table's rowClassName.
  const rowClassName = useCallback(
    (record) => (keyOf(record) === selectedKey ? 'row-active' : ''),
    [keyOf, selectedKey]
  );

  return {
    selectedIndex,
    selectedKey,
    selectedRecord,
    rowClassName,
    searchKeyDown,
    focusSearch,
    clearSelection,
    move,
    jumpTo,
  };
}
