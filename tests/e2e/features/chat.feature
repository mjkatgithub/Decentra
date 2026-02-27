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

  Scenario: Reply composer and fallback rendering
    When I open the login page
    And I sign in with configured credentials
    And I open the seeded test room
    And I click reply on message body "E2E_SEED_BASE_MESSAGE"
    Then I should see the reply composer with preview "E2E_SEED_BASE_MESSAGE"
    When I cancel reply mode
    Then reply mode should be inactive
    And I should see a rendered reply for "E2E_REPLY_TO_VALID_EVENT"
    And I should see a missing-origin reply fallback

  Scenario: Add and remove message reaction
    When I open the login page
    And I sign in with configured credentials
    And I open the seeded test room
    And I add reaction "👍" on message body "E2E_SEED_BASE_MESSAGE"
    Then I should see reaction "👍" with count "1" on message body "E2E_SEED_BASE_MESSAGE"
    When I remove reaction "👍" on message body "E2E_SEED_BASE_MESSAGE"
    Then I should not see reaction "👍" on message body "E2E_SEED_BASE_MESSAGE"

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
