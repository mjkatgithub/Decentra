Feature: Login
  As a user I want to be able to log in
  so that I can use the chat.

  @smoke
  Scenario: Display login page
    When I open the login page
    Then I should see the login form

  Scenario: Invalid credentials
    When I open the login page
    And I log in with "invalid" and "wrong"
    Then an error message should appear
