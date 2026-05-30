Feature: Chat
  As a logged-in user I want to send messages
  to communicate with others.

  @smoke
  Scenario: Chat page requires authentication
    When I open the chat page
    Then I am redirected to the root page

  Scenario: Account settings require authentication
    When I open the account settings page
    Then I am redirected to the root page

  Scenario: Space settings require authentication
    When I open the space settings page for "space-demo"
    Then I am redirected to the root page

  Scenario: Create space from rail appears in navigation
    When I open the login page
    And I sign in with configured credentials
    And I create a new space with a unique name
    Then I should see that space in the space rail

  Scenario: Reload on chat with valid session keeps chat
    When I open the login page
    And I sign in with configured credentials
    And I reload the current page
    Then I should be redirected to the chat page

  Scenario: Reload on chat without session redirects to root
    When I open the login page
    And I sign in with configured credentials
    And I clear the stored matrix session
    And I reload the current page
    Then I am redirected to the root page

  Scenario: E2EE fallback and timeline continuity
    When I open the login page
    And I sign in with secondary configured credentials
    And I open the seeded test room
    Then I should see message body "E2E_SEED_BASE_MESSAGE"
    And I should see an undecryptable fallback notice
    And I should see message body "E2E_POST_UNDECRYPTABLE_MESSAGE"

  Scenario: Image rendering and lightbox behavior
    When I open the login page
    And I sign in with secondary configured credentials
    And I open the seeded test room
    Then I should see image preview for "E2E_SEED_IMAGE"
    When I open the image preview for "E2E_SEED_IMAGE"
    Then the lightbox should be visible
    When I close the lightbox with the close button
    Then the lightbox should not be visible
    And I should see image fallback label "E2E_INVALID_IMAGE_FALLBACK"

  Scenario: Voice message playback in timeline
    When I open the login page
    And I sign in with secondary configured credentials
    And I open the seeded test room
    Then I should see voice message player for "E2E_SEED_VOICE"

  Scenario: Video message playback in timeline
    When I open the login page
    And I sign in with secondary configured credentials
    And I open the seeded test room
    Then I should see video message player for "E2E_SEED_VIDEO"

  Scenario: Upload and send video in chat
    When I open the login page
    And I sign in with configured credentials
    And I open the seeded test room
    When I upload video "e2e-upload.webm" in the message composer
    Then I should see video message player for "e2e-upload.webm"

  Scenario: Invalid video upload shows feedback
    When I open the login page
    And I sign in with configured credentials
    And I open the seeded test room
    When I upload invalid video "e2e-invalid.mov" in the message composer
    Then I should see composer upload error feedback

  Scenario: Upload and send audio file in chat
    When I open the login page
    And I sign in with configured credentials
    And I open the seeded test room
    When I upload audio "e2e-upload.webm" in the message composer
    Then I should see voice message player for "e2e-upload.webm"

  Scenario: Invalid audio upload shows feedback
    When I open the login page
    And I sign in with configured credentials
    And I open the seeded test room
    When I upload invalid audio "e2e-invalid.mov" in the message composer
    Then I should see composer upload error feedback

  Scenario: Record preview and send voice message
    When voice recording APIs are mocked in the browser
    And I open the login page
    And I sign in with configured credentials
    And I open the seeded test room
    When I record preview and send a voice message
    Then I should see voice message player for "voice-message.webm"

  Scenario: Voice recording permission denied feedback
    When voice recording permission is denied in the browser
    And I open the login page
    And I sign in with configured credentials
    And I open the seeded test room
    When I start voice recording from the composer
    Then I should see voice recording permission denied feedback

  Scenario: Thread sidebar open post and persist after reload
    When I open the login page
    And I sign in with configured credentials
    And I open the seeded test room
    And I open the thread on message body "E2E_SEED_BASE_MESSAGE"
    Then I should see the thread side panel
    When I send "E2E_THREAD_SEND_1" from the thread composer
    Then I should see message body "E2E_THREAD_SEND_1"
    When I reload the current page
    And I open the seeded test room
    And I open the thread on message body "E2E_SEED_BASE_MESSAGE"
    Then I should see message body "E2E_THREAD_SEND_1"
    When I close the thread side panel
    Then I should not see the thread side panel

  Scenario: Sent message appears immediately without manual scroll
    When I open the login page
    And I sign in with configured credentials
    And I open the seeded test room
    When I send "E2E_SEND_VISIBLE_IMMEDIATE" from the message composer
    Then I should see message body "E2E_SEND_VISIBLE_IMMEDIATE"

  Scenario: Edit sent message and persist after reload
    When I open the login page
    And I sign in with configured credentials
    And I open the seeded test room
    When I send "E2E_EDIT_ORIGINAL" from the message composer
    Then I should see message body "E2E_EDIT_ORIGINAL"
    When I click edit on message body "E2E_EDIT_ORIGINAL"
    Then I should see the edit composer active
    When I submit the edit composer with "E2E_EDIT_UPDATED"
    Then I should see message body "E2E_EDIT_UPDATED"
    And I should see the edited label on message body "E2E_EDIT_UPDATED"
    When I reload the current page
    And I open the seeded test room
    Then I should see message body "E2E_EDIT_UPDATED"
    And I should see the edited label on message body "E2E_EDIT_UPDATED"

  Scenario: Reply composer and fallback rendering
    When I open the login page
    And I sign in with configured credentials
    And I open the seeded test room
    And I click reply on message body "E2E_SEED_BASE_MESSAGE"
    Then I should see the reply composer with preview "E2E_SEED_BASE_MESSAGE"

  Scenario: Reply via tap on mobile viewport
    When I open the login page
    And I sign in with configured credentials
    And I use the mobile chat viewport
    And I open the seeded test room
    And I tap reply on message body "E2E_SEED_BASE_MESSAGE" on mobile
    Then I should see the reply composer with preview "E2E_SEED_BASE_MESSAGE"
    When I cancel reply mode
    Then reply mode should be inactive
    And I should see a rendered reply for "E2E_REPLY_TO_VALID_EVENT"
    And I should see a missing-origin reply fallback

  Scenario: Reply to image shows thumbnail and scrolls to original
    When I open the login page
    And I sign in with configured credentials
    And I open the seeded test room
    Then I should see a rendered reply for "E2E_REPLY_TO_IMAGE"
    And the reply to "E2E_REPLY_TO_IMAGE" should show an image thumbnail
    When I click the reply quote on message body "E2E_REPLY_TO_IMAGE"
    Then message body "E2E_SEED_IMAGE" should be visible in the timeline
    When I click the reply quote on message body "E2E_REPLY_TO_VALID_EVENT"
    Then message body "E2E_SEED_BASE_MESSAGE" should be visible in the timeline

  Scenario: Send image as reply creates image reply
    When I open the login page
    And I sign in with configured credentials
    And I open the seeded test room
    And I click reply on message body "E2E_SEED_BASE_MESSAGE"
    Then I should see the reply composer with preview "E2E_SEED_BASE_MESSAGE"
    When I upload image "e2e-upload.png" in the message composer
    Then I should see image preview for "e2e-upload.png"
    And the image message "e2e-upload.png" should show reply quote for "E2E_SEED_BASE_MESSAGE"

  Scenario: Send image in thread creates thread image
    When I open the login page
    And I sign in with configured credentials
    And I open the seeded test room
    And I open the thread on message body "E2E_SEED_BASE_MESSAGE"
    Then I should see the thread side panel
    When I upload image "e2e-upload.png" in the thread composer
    Then I should see image preview for "e2e-upload.png"

  Scenario: Unread indicator for inactive channel
    When I open the login page
    And I sign in with configured credentials
    And I open the side seeded test room
    And the secondary user sends "E2E_UNREAD_MARKER_MSG" to the main test room
    Then the main test room should show an unread indicator
    And the main test room should not show a mention unread indicator

  Scenario: Mention unread indicator for inactive channel
    When I open the login page
    And I sign in with configured credentials
    And I open the side seeded test room
    And the secondary user mentions the primary user with "E2E_MENTION_UNREAD_MSG" in the main test room
    Then the main test room should show a mention unread indicator

  Scenario: Opening channel clears mention unread indicator
    When I open the login page
    And I sign in with configured credentials
    And I open the side seeded test room
    And the secondary user mentions the primary user with "E2E_MENTION_CLEAR_MSG" in the main test room
    Then the main test room should show a mention unread indicator
    When I open the seeded test room
    Then the main test room should not show an unread indicator

  Scenario: Mention unread aggregates on the space rail
    When I open the login page
    And I sign in with configured credentials
    And I open the side seeded test room
    And the secondary user mentions the primary user with "E2E_SPACE_MENTION_MSG" in the seeded space channel
    Then the seeded test space should show a mention unread indicator on the space rail

  Scenario: Opening channel clears unread indicator
    When I open the login page
    And I sign in with configured credentials
    And I open the side seeded test room
    And the secondary user sends "E2E_UNREAD_CLEAR_MSG" to the main test room
    Then the main test room should show an unread indicator
    When I open the seeded test room
    Then the main test room should not show an unread indicator

  Scenario: Unread indicator survives reload
    When I open the login page
    And I sign in with configured credentials
    And I open the side seeded test room
    And the secondary user sends "E2E_UNREAD_RELOAD_MSG" to the main test room
    Then the main test room should show an unread indicator
    When I reload the current page
    And I open the side seeded test room
    Then the main test room should show an unread indicator

  Scenario: Pin message, list, navigate, and unpin
    When I open the login page
    And I sign in with configured credentials
    And I open the seeded test room
    When I send "E2E_PIN_TARGET" from the message composer
    Then I should see message body "E2E_PIN_TARGET"
    When I click pin on message body "E2E_PIN_TARGET"
    And I open the pinned messages panel
    Then I should see "E2E_PIN_TARGET" in the pinned messages panel
    When I reload the current page
    And I open the seeded test room
    And I open the pinned messages panel
    Then I should see "E2E_PIN_TARGET" in the pinned messages panel
    When I open pinned message "E2E_PIN_TARGET"
    Then I should see message body "E2E_PIN_TARGET"
    When I click unpin on message body "E2E_PIN_TARGET"
    And I open the pinned messages panel
    Then I should not see "E2E_PIN_TARGET" in the pinned messages panel

  Scenario: Composer emoji picker and shortcode autocomplete
    When I open the login page
    And I sign in with configured credentials
    And I open the seeded test room
    When I open the composer emoji picker
    And I select emoji "👋" from the composer picker
    And I send the composer draft
    Then I should see message body "👋"
    When I type ":see_no_evil:" in the message composer
    And I send the composer draft
    Then I should see message body "🙈"

  Scenario: Add and remove message reaction
    When I open the login page
    And I sign in with configured credentials
    And I open the seeded test room
    And I add reaction "👍" on message body "E2E_SEED_BASE_MESSAGE"
    Then I should see reaction "👍" with count "1" on message body "E2E_SEED_BASE_MESSAGE"
    When I remove reaction "👍" on message body "E2E_SEED_BASE_MESSAGE"
    Then I should not see reaction "👍" on message body "E2E_SEED_BASE_MESSAGE"

  Scenario: Typing indicator when another user composes
    When I open the login page
    And I sign in with configured credentials
    And I open the seeded test room
    And the secondary user starts typing in the main test room
    Then the typing indicator should be visible
    When the secondary user stops typing in the main test room
    Then the typing indicator should not be visible

  Scenario Outline: Member presence indicator reflects standard status
    When I open the login page
    And I sign in with configured credentials
    And I open the account settings page
    And I set my presence to "<presence>"
    And I open the chat page
    And I open the seeded test room
    Then I should see my member status indicator as "<presence>"

    Examples:
      | presence |
      | online   |
      | away     |
      | offline  |
