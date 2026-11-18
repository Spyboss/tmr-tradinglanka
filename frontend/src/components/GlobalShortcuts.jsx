import { useHotkeys } from 'react-hotkeys-hook';
import { useNavigate } from 'react-router-dom';
import { GO_TO } from '../utils/shortcuts';
import { shortcutsAllowed } from '../utils/keyboard';

// "g" then a letter jumps to a top-level page, the pattern GitHub and Gmail
// use. Sequences are the one binding react-hotkeys-hook does not run through
// the `enabled` guard, so the guard is applied inside the callback instead.
const sequences = GO_TO.map(({ key }) => `g>${key}`);

const GlobalShortcuts = () => {
  const navigate = useNavigate();

  useHotkeys(
    sequences,
    (event, hotkey) => {
      if (!shortcutsAllowed(event)) return;
      const pressed = hotkey.keys?.[hotkey.keys.length - 1];
      const destination = GO_TO.find(({ key }) => key === pressed);
      if (destination) navigate(destination.path);
    },
    { sequenceTimeoutMs: 1200 }
  );

  return null;
};

export default GlobalShortcuts;
