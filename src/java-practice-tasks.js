// Preserve the original question bank; describe the execution environment for the shared workbench.
export function javaPracticeTasks(challenges) {
  return challenges.map(challenge => {
    const standalone = challenge.starter.includes('public class Main')
      && !challenge.environment.includes('Java 21') && challenge.topic !== 'JDBC & SQL';
    return { ...challenge, runtime: standalone ? 'java' : 'project',
      executionNote: standalone ? 'Runs Java 17 through Judge0. A single Main class is supported.'
        : `${challenge.environment}. ${challenge.topic === 'JDBC & SQL' ? 'Requires a JDBC driver and a database.' : 'Run with the JDK and dependencies described in Checks and context.'}` };
  });
}
