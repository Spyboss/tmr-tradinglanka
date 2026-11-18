import React, { createContext, useContext, useMemo, useState } from 'react';

// The '?' cheat sheet is global, but it needs a trigger the user can see.
// The Navbar button and the keyboard key both go through this context.
const ShortcutHelpContext = createContext(null);

export const useShortcutHelp = () => useContext(ShortcutHelpContext);

export const ShortcutHelpProvider = ({ children }) => {
  const [open, setOpen] = useState(false);

  const value = useMemo(
    () => ({
      open,
      openHelp: () => setOpen(true),
      closeHelp: () => setOpen(false),
      toggleHelp: () => setOpen((previous) => !previous),
    }),
    [open]
  );

  return (
    <ShortcutHelpContext.Provider value={value}>
      {children}
    </ShortcutHelpContext.Provider>
  );
};
