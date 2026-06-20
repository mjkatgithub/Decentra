Feature: Signup
  As a new user I want to open the sign-up page
  so that I can create an account.

  @smoke
  Scenario: Navigate from landing page to signup page
    When I open the landing page
    And I navigate to the signup page
    Then I should see the signup form

  Scenario: Open signup page directly
    When I open the signup page
    Then I should see the signup form
