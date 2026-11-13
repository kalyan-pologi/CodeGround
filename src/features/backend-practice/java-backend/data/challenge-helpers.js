import { topics } from './topics.js';

// Assemble complete standalone exercises without repeating the Java harness.
export function javaChallenge(topic, difficulty, title, statement, expected, declarations, signature, body, example, pseudocode, checks, version = 'Java 17+') {
  const imports = 'import java.util.*;\nimport java.util.concurrent.*;\nimport java.util.concurrent.atomic.*;\nimport java.util.stream.*;\nimport java.time.*;\nimport java.time.zone.*;\nimport java.nio.file.*;\nimport java.nio.charset.StandardCharsets;\nimport java.io.*;\nimport java.math.*;\nimport java.lang.annotation.*;\nimport java.lang.reflect.*;\nimport java.sql.*;\n';
  const program = implementation => `${imports}\npublic class Main {\n${declarations}\n    ${signature} {\n${implementation}\n    }\n\n    public static void main(String[] args) throws Exception {\n${example}\n    }\n}\n`;
  return { topic: topics[topic], difficulty, title, statement, expected, environment: version, starter: program('        // TODO: implement the contract.\n        throw new UnsupportedOperationException("Not implemented");'), solution: program(body), pseudocode, notes: checks };
}

// Framework exercises are integration snippets for the explicitly named project context.
export function springChallenge(topic, difficulty, title, statement, expected, starter, solution, pseudocode, notes, environment = 'Java 17+ | Spring Boot 3 / Spring Framework 6') {
  return { topic: topics[topic], difficulty, title, statement, expected, starter, solution, pseudocode, notes, environment };
}
