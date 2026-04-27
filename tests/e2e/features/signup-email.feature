Feature: Signup with email (MailHog)
  Exercises UIA email registration when Synapse is configured for 3pid
  email. Run with `npm run test:e2e:signup-email` (Docker + MailHog required).

  @email_signup
  Scenario: Email verification completes self-registration
    When I self-register with a new address on the e2e homeserver
    Then I should see the check-your-email step
    When I complete verification from MailHog and the app
    Then I should see successful signup on the login page
