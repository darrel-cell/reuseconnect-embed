import { useState } from 'react';

/**
 * Show password requirement hints only while the user is focused on this password field
 * or has typed at least one character.
 */
export function useShowPasswordHints(password: string) {
  const [focused, setFocused] = useState(false);
  const showHints = focused || password.length > 0;

  const passwordInputProps = {
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };

  return { showHints, passwordInputProps };
}
