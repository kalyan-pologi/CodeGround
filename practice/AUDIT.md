# Final audit - 2026-10-19

This report records the audit before Judge0 integration. Run Code is now connected to Judge0 Java 17. Live success, compilation-error, and runtime-exception cases passed in Node and development/production browsers; Run Tests remains disabled.

Reviewed all 100 MCQs and 50 coding challenges for intended answers, explanations, assumptions, distinct scenarios, Java/Spring compatibility, starter code, solutions, and expected behavior. No question counts or difficulty totals changed.

## Corrections

- Added explicit collector generic types to the concurrent-collector MCQ. Without them, Java rejected the method reference before reaching the intended concurrency issue.
- Specified that the lazy-stream receipt method returns a String, removing ambiguity with an invalid void-returning map operation.
- Replaced a repeated record-immutability MCQ with a sealed-hierarchy compilation question.
- Clarified that permitAll does not disable unrelated security protections.
- Made the JWT audience validator reject a missing audience instead of throwing NullPointerException.
- Made the tenant reader reject absent authentication explicitly.
- Rejected Unicode blank header names and ignored Unicode blank email entries in the relevant exercises.
- Made shipment validation an explicit mapping step and preserved runtime cleanup failures as suppressed exceptions in atomic file publication.

## Verification results

| Check | Result |
| --- | --- |
| Bank structure and coverage | 100 MCQs (60 medium / 40 hard), 50 challenges (20 medium / 30 hard), all 22 topics represented in both modes; unique titles and IDs, four distinct MCQ options |
| MCQ Java checks | 30 representative snippets passed output, exception, intentional compiler-failure, and DST checks |
| Standalone challenges | All 24 starters and solutions compiled; examples and contract edge cases passed |
| JDBC contracts | Lookup, commit, insufficient funds, missing destination, rollback, connection ownership, and autocommit restoration checked with a temporary in-memory H2 database |
| Framework/JUnit snippets | All remaining 26 starters and solutions compiled against cached Spring Boot 3 / Framework 6 libraries with documented domain-type fixtures |
| Framework unit contracts | 15 suites passed, including JUnit/Mockito examples, ETags, missing JWT audience, tenant context, bounded executor rejection, WebClient retry filtering, validation, and metrics |
| Initial React render | Grouped topic options, 20-number navigator page, four answer options, and hidden explanation passed |
| Development and production browser | Scoring, answer reset/review, filters in both modes, pagination, four-column layout, Monaco typing/draft persistence/templates/reset, hidden solutions, disabled execution, mode persistence, and 375px layout passed in a fresh headless Chrome profile |
| Production build | Passed |

## Verification limits

Compilation and unit fixtures do not prove deployment-specific behavior. PostgreSQL/JPA locking and query plans, Redis, Kafka/RabbitMQ delivery, real JWT issuer discovery/signatures, Feign transport, and Docker/Testcontainers still require their actual integration environments. H2 checks are not PostgreSQL compatibility tests. Nondeterministic concurrency MCQs are reviewed by contract rather than assigned a fabricated exact output.

Run Code and Run Tests remain disabled because no execution provider is connected. Vite still reports a bundle-size warning for the locally bundled Monaco editor (approximately 2.6 MB minified application bundle, 695 KB gzip); this does not fail the build. No new application packages were added during this audit.

Repeatable commands and environment requirements are documented in [README.md](README.md).
