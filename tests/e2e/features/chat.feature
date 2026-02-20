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
  #
  # Manual validation scenarios for Issue #7 (image rendering):
  # 1) Send an `m.image` message from client A and open chat in client B.
  #    Confirm image preview is rendered in timeline and body text is used
  #    as alt/fallback label.
  # 2) Click image preview in timeline and confirm the lightbox opens.
  #    Confirm close button and backdrop click both close the lightbox.
  # 3) Send invalid image media content (missing/invalid URL) and confirm
  #    timeline still renders message with clear fallback text and no crash.
  # 4) Send a very large image and confirm timeline layout stays intact
  #    (no overflow outside message container, scrolling still works).
