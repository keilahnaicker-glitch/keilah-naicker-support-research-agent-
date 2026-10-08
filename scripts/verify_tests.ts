import { runAllTests } from '../src/server/test_runner.ts';

async function main() {
  console.log("Running all 14 benchmark tests...");
  const summary = await runAllTests();
  console.log(`\n================ TEST SUMMARY ================`);
  console.log(`Total Tests: ${summary.total_tests}`);
  console.log(`Passed: ${summary.passed_tests}`);
  console.log(`Failed: ${summary.failed_tests}`);
  console.log(`Designated Resolved Scenarios: ${summary.resolved_scenarios_passed} / ${summary.resolved_scenarios_total}`);
  console.log(`First-Contact Resolution Rate: ${summary.fcr_rate_percentage}%`);
  console.log(`Target Met (>=80%): ${summary.target_met ? "YES" : "NO"}`);
  console.log(`==============================================\n`);

  for (const r of summary.results) {
    console.log(`[${r.passed ? "PASS" : "FAIL"}] ${r.test_id}: ${r.scenario_title}`);
    console.log(`       Action: ${r.observed_action} | DB Verified: ${r.db_state_verified} | Duration: ${r.duration_ms}ms`);
    if (!r.passed) {
      console.log(`       Evidence:`, r.evidence);
    }
  }

  if (summary.failed_tests > 0 || !summary.target_met) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
