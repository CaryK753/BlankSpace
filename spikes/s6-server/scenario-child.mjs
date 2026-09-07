import { runScenario } from './scenarios.mjs';

const id = process.argv[2];

try {
  const report = await runScenario(id);
  const exitCode = report.exitClassification === 'non-zero' ? 1 : 0;
  process.send?.({ type: 'report', report }, error => {
    if (error) process.exit(2);
    if (exitCode !== 0) process.exit(exitCode);
    process.exitCode = 0;
    process.disconnect?.();
  });
} catch (error) {
  process.send?.({
    type: 'runner-error',
    error: {
      name: error instanceof Error ? error.name : 'Error',
      message: error instanceof Error ? error.message : String(error),
    },
  }, () => process.exit(2));
}
