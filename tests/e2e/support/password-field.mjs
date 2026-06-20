/** Matches account password field labels (EN/DE), not show/hide toggle buttons. */
export const PASSWORD_FIELD_NAME = /^(Password|Passwort)$/i

/**
 * Locates the account password input (masked or plain), excluding
 * visibility toggle buttons that also mention "password" in aria-label.
 */
export function passwordField(page) {
  return page.getByRole('textbox', { name: PASSWORD_FIELD_NAME })
}

/**
 * Fills masked password inputs reliably. Playwright `fill()` on a masked
 * field bypasses `beforeinput` and leaves the Vue model empty or truncated.
 * Reveal the secret first, then fill the plain text input.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} password
 */
export async function fillPasswordField(page, password) {
  const field = passwordField(page)
  const showPasswordButton = page.getByRole('button', {
    name: /Show password|Passwort anzeigen/i,
  })
  if (await showPasswordButton.isVisible().catch(() => false)) {
    await showPasswordButton.click()
  }
  await field.fill(password)
}
