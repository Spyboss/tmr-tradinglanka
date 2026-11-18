// The app's keyboard shortcuts, described once and consumed twice: the hooks
// bind these keys, and the '?' overlay lists them. A page that does not bind a
// key never advertises it, so the cheat sheet cannot drift from reality.
//
// Entry shape: { keys, description }. `keys` is what the user presses, with
// " / " for alternatives and a space for a sequence ("g d").

// Where "g <key>" jumps. GlobalShortcuts binds these; the overlay reads the
// same list, so adding a destination is a one-line change.
export const GO_TO = [
  { key: 'd', path: '/', label: 'Dashboard' },
  { key: 'b', path: '/bills', label: 'Bills' },
  { key: 'q', path: '/quotations', label: 'Quotations' },
  { key: 'i', path: '/inventory', label: 'Inventory' },
  { key: 'w', path: '/warranty-claims', label: 'Warranty claims' },
];

export const globalShortcutGroups = () => [
  {
    title: 'Anywhere',
    items: [{ keys: '?', description: 'Show this help' }],
  },
  {
    title: 'Jump to',
    items: GO_TO.map(({ key, label }) => ({ keys: `g ${key}`, description: label })),
  },
];

// A list page's shortcuts. The flags mirror the callbacks the page passed to
// useListCursor, so "p" only appears on pages that can actually download.
export const listShortcutGroups = ({ noun, canOpen, canEdit, canDownload, canCreate }) => {
  const rows = [
    { keys: 'j / ↓', description: `Next ${noun}` },
    { keys: 'k / ↑', description: `Previous ${noun}` },
    { keys: 'Home', description: `First ${noun}` },
    { keys: 'End', description: `Last ${noun}` },
  ];
  if (canOpen) rows.push({ keys: 'Enter', description: `Open ${noun}` });
  if (canEdit) rows.push({ keys: 'e', description: `Edit ${noun}` });
  if (canDownload) rows.push({ keys: 'p', description: `Download ${noun} as PDF` });
  rows.push({ keys: 'Esc', description: 'Clear the selection' });

  const page = [{ keys: '/', description: 'Focus the search box' }];
  if (canCreate) page.push({ keys: 'n', description: `New ${noun}` });

  return [
    { title: 'Rows', items: rows },
    { title: 'This page', items: page },
  ];
};

// What the current page reported about itself. Set by useListCursor on mount,
// cleared on unmount, read by the '?' overlay when it opens.
let currentPage = { pageLabel: '', groups: [] };

export const setPageShortcuts = (next) => {
  currentPage = next;
};

export const getPageShortcuts = () => currentPage;
