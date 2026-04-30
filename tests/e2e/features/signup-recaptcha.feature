Feature: Signup with reCAPTCHA (Synapse UIA)
  Covers self-registration when Synapse enables registration captcha.
  Run with `npm run test:e2e:signup-recaptcha` (Docker required).

  @recaptcha_signup
  Scenario: Open registration completes after reCAPTCHA step
    Given I open the signup page for recaptcha e2e
    When I submit signup against captcha-enabled synapse
    Then I should see the signup captcha step
    When I consent and solve the signup recaptcha challenge
    Then I should land on login after captcha signup success
