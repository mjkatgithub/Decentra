Feature: Chat
  As a logged-in user I want to send messages
  to communicate with others.

  @smoke
  Scenario: Chat page requires authentication
    When I open the chat page
    Then I am redirected to the login page

  Scenario: Account settings require authentication
    When I open the account settings page
    Then I am redirected to the login page

  Scenario: Space settings require authentication
    When I open the space settings page for "space-demo"
    Then I am redirected to the login page

  # Manual E2EE validation scenarios for Issue #4:
  # 1) Open an encrypted room and confirm readable message text is shown.
  # 2) Trigger an undecryptable event and confirm a user-facing fallback is
  #    rendered ("...could not be decrypted") without UI crash.
  # 3) Verify timeline keeps updating after decryption callbacks.
