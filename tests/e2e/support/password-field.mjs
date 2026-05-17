/** Matches account password field labels (EN/DE), not show/hide toggle buttons. */
export const PASSWORD_FIELD_NAME = /^(Password|Passwort)$/i

/**
 * Locates the account password input (masked or plain), excluding
 * visibility toggle buttons that also mention "password" in aria-label.
 */
export function passwordField(page) {
  return page.getByRole('textbox', { name: PASSWORD_FIELD_NAME })
}
