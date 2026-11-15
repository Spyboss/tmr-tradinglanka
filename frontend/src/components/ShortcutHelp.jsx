import React, { useEffect, useState } from 'react';
import { Modal } from 'antd';
import useHotkeys, { getRegisteredShortcuts } from '../hooks/useHotkeys';

// "?" opens a shortcut cheat sheet built live from the registry, so it
// always lists exactly the shortcuts active on the current page.
const ShortcutHelp = () => {
  const [open, setOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState([]);

  useHotkeys([
    { key: '?', description: 'Show keyboard shortcuts', handler: () => setOpen((prev) => !prev) },
  ]);

  useEffect(() => {
    if (open) setShortcuts(getRegisteredShortcuts());
  }, [open]);

  return (
    <Modal
      title="Keyboard Shortcuts"
      open={open}
      onCancel={() => setOpen(false)}
      footer={null}
      width={480}
      className="shortcut-help-modal"
    >
      {shortcuts.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">No shortcuts on this page.</p>
      ) : (
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
          Shortcuts work when you are not typing in a field.
        </p>
      )}
      <div className="space-y-2">
        {shortcuts.map((shortcut) => (
          <div key={`${shortcut.key}-${shortcut.description}`} className="flex items-center justify-between gap-4">
            <span className="text-sm text-gray-700 dark:text-gray-300">{shortcut.description}</span>
            <kbd className="shrink-0 px-2 py-1 text-xs font-mono font-semibold bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-slate-600 rounded">
              {shortcut.key}
            </kbd>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Close (Esc)
        </button>
      </div>
    </Modal>
  );
};

export default ShortcutHelp;
