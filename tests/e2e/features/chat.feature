Feature: Chat
  As a logged-in user I want to send messages
  to communicate with others.

  Scenario: Chat page requires authentication
    When I open the chat page
    Then I am redirected to the login page
