import { topics } from '../java-backend/data/topics.js';

const imports = `import java.math.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.function.*;
import java.time.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.io.*;
import java.lang.annotation.*;
import java.lang.reflect.*;`;

function unitSource(unit, starter) {
  const methods = unit.methods.map(method => `    ${method.signature} {\n${starter
    ? '        // TODO implement this operation and its contract.\n        throw new UnsupportedOperationException("Not implemented");'
    : method.body}\n    }`).join('\n\n');
  return `${unit.owner} {\n${unit.members || ''}\n${methods}\n}`;
}

function metadata(spec) {
  return {
    topic: topics[spec.topic], difficulty: 'Medium', title: spec.title,
    statement: spec.statement, requirements: spec.requirements,
    hintSteps: spec.hints, explanation: spec.explanation,
    pseudocode: spec.hints.join(' → '), notes: spec.notes,
    expected: spec.expected || `PASS: ${spec.title}`
  };
}

export function javaFeature(spec) {
  const helpers = `    @FunctionalInterface interface Action { void run() throws Exception; }
    static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
    static void reject(Class<? extends Throwable> type, Action action) {
        try { action.run(); }
        catch (Throwable failure) {
            if (type.isInstance(failure)) return;
            throw new AssertionError("Unexpected failure", failure);
        }
        throw new AssertionError("Expected " + type.getSimpleName());
    }
`;
  const program = starter => `${imports}\n\npublic class Main {\n${spec.model || ''}\n${unitSource({ owner: '    static final class Feature', members: spec.members, methods: spec.methods }, starter)}\n${helpers}\n    public static void main(String[] args) throws Exception {\n${spec.checks}\n        System.out.println(${JSON.stringify(`PASS: ${spec.title}`)});\n    }\n}\n`;
  return { ...metadata(spec), runtime: 'java',
    environment: 'Java 17 | Standalone feature task | Suggested time: 60–90 minutes',
    starter: program(true), solution: program(false) };
}

export function projectFeature(spec) {
  const program = starter => `${spec.imports}\n\n${spec.model || ''}\n\n${spec.units.map(unit => unitSource(unit, starter)).join('\n\n')}\n`;
  return { ...metadata(spec), runtime: 'project',
    environment: 'Java 17 | Spring Boot 3.5 exercise project | Suggested time: 60–90 minutes',
    starter: program(true), solution: program(false) };
}
