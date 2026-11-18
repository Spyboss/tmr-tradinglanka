import React, { useEffect, useState } from 'react';
import { Modal } from 'antd';
import { useHotkeys } from 'react-hotkeys-hook';
import { useShortcutHelp } from '../contexts/ShortcutHelpContext';
import { getPageShortcuts, globalShortcutGroups } from '../utils/shortcuts';
import { shortcutsAllowed } from '../utils/keyboard';

// The cheat sheet. Two sources, rendered the same way:
//   * what the current page reported (useListCursor) — rows, this page, and
//   * what is always available — the help key and the "g <letter>" jumps.
// Nothing is listed unless a key is actually bound, so it never lies.
const Key = ({ children }) => (
  <kbd className="shrink-0 rounded border border-gray-300 bg-gray-100 px-2 py-0.5 font-mono text-xs font-semibold text-gray-700 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100">
    {children}
  </kbd>
);

const Group = ({ title, items }) => (
  <section className="mt-5 first:mt-0">
    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
      {title}
    </h3>
    <dl className="space-y-1.5">
      {items.map((item) => (
        <div key={`${item.keys}|${item.description}`} className="flex items-center justify-between gap-4">
          <dt className="text-sm text-gray-700 dark:text-gray-300">{item.description}</dt>
          <dd className="shrink-0">
            <Key>{item.keys}</Key>
          </dd>
        </div>
      ))}
    </dl>
  </section>
);

const ShortcutHelp = () => {
  const { open, toggleHelp, closeHelp } = useShortcutHelp();
  const [page, setPage] = useState({ pageLabel: '', groups: [] });

  useHotkeys('?', (event) => {
    event.preventDefault();
    toggleHelp();
  }, { enabled: shortcutsAllowed, useKey: true, ignoreModifiers: true });

  // Read the page's manifest as the overlay opens, so it reflects the list
  // that is on screen right now.
  useEffect(() => {
    if (open) setPage(getPageShortcuts());
  }, [open]);

  const hasPageShortcuts = page.groups.length > 0;

  return (
    <Modal
      title="Keyboard shortcuts"
      open={open}
      onCancel={closeHelp}
      footer={null}
      width={520}
      className="shortcut-help-modal"
    >
      <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
        Shortcuts pause while you are typing in a field or a dialog is open.
      </p>

      {hasPageShortcuts && page.pageLabel && (
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">
          {page.pageLabel}
        </p>
      )}

      {hasPageShortcuts && page.groups.map((group) => (
        <Group key={group.title} title={group.title} items={group.items} />
      ))}

      {!hasPageShortcuts && (
        <p className="mb-2 mt-4 text-sm text-gray-600 dark:text-gray-300">
          List shortcuts are available on the Bills, Quotations, Inventory and Warranty
          Claims pages.
        </p>
      )}

      <div className="my-5 border-t border-gray-200 dark:border-slate-700" />

      {globalShortcutGroups().map((group) => (
        <Group key={group.title} title={group.title} items={group.items} />
      ))}

      <div className="mt-5 border-t border-gray-200 pt-3 dark:border-slate-700">
        <button
          type="button"
          onClick={closeHelp}
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Close (Esc)
        </button>
      </div>
    </Modal>
  );
};

export default ShortcutHelp;
