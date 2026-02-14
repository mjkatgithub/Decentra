export default {
  import: ['./tests/e2e/step-definitions/**/*.mjs', './tests/e2e/support/**/*.mjs'],
  paths: ['./tests/e2e/features/**/*.feature'],
  format: ['progress', 'html:./tests/e2e/reports/cucumber-report.html'],
  formatOptions: { snippetInterface: 'async-await' }
}
