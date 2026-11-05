import assert from 'node:assert/strict';
import { existsSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { challenges } from '../src/data/challenges.js';
import { frameworkContract } from './framework-contracts.mjs';

// Uses an existing local Maven cache; never downloads or adds app dependencies.
const repository = process.env.JAVA_PRACTICE_M2_ROOT || path.join(homedir(), '.m2', 'repository');
const jars = [];
function artifact(group, name, major) {
  const base = path.join(repository, ...group.split('.'), name);
  if (!existsSync(base)) throw new Error(`Missing cached dependency: ${group}:${name}`);
  const version = readdirSync(base).filter(version => version.startsWith(major + '.') &&
    /^\d+(\.\d+)*(?:\.Final|\.RELEASE)?$/.test(version) && existsSync(path.join(base, version, `${name}-${version}.jar`)))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
  if (!version) throw new Error(`No compatible cached JAR: ${group}:${name}:${major}.x`);
  jars.push(path.join(base, version, `${name}-${version}.jar`));
}
for (const name of ['core', 'beans', 'context', 'aop', 'expression', 'jcl', 'tx', 'jdbc', 'web', 'webmvc', 'webflux', 'test', 'orm']) artifact('org.springframework', `spring-${name}`, 6);
for (const name of ['spring-boot', 'spring-boot-autoconfigure', 'spring-boot-test', 'spring-boot-test-autoconfigure']) artifact('org.springframework.boot', name, 3);
for (const name of ['core', 'config', 'web', 'crypto', 'oauth2-core', 'oauth2-jose', 'oauth2-resource-server']) artifact('org.springframework.security', `spring-security-${name}`, 6);
for (const name of ['commons', 'jpa', 'redis', 'keyvalue']) artifact('org.springframework.data', `spring-data-${name}`, 3);
artifact('org.springframework.kafka', 'spring-kafka', 3);
artifact('org.springframework.cloud', 'spring-cloud-openfeign-core', 4);
artifact('io.github.openfeign', 'feign-core', 13);
artifact('jakarta.persistence', 'jakarta.persistence-api', 3);
artifact('jakarta.validation', 'jakarta.validation-api', 3);
if (existsSync(path.join(repository, 'jakarta', 'servlet', 'jakarta.servlet-api'))) artifact('jakarta.servlet', 'jakarta.servlet-api', 6);
else artifact('org.apache.tomcat.embed', 'tomcat-embed-core', 10);
artifact('org.junit.jupiter', 'junit-jupiter-api', 5);
artifact('org.junit.platform', 'junit-platform-commons', 1);
artifact('org.opentest4j', 'opentest4j', 1);
artifact('org.apiguardian', 'apiguardian-api', 1);
artifact('org.mockito', 'mockito-core', 5);
artifact('org.hamcrest', 'hamcrest', 2);
for (const name of ['core', 'commons', 'observation']) artifact('io.micrometer', `micrometer-${name}`, 1);
artifact('io.projectreactor', 'reactor-core', 3);
artifact('org.reactivestreams', 'reactive-streams', 1);
for (const name of ['testcontainers', 'junit-jupiter', 'postgresql', 'jdbc', 'database-commons']) artifact('org.testcontainers', name, 1);
artifact('junit', 'junit', 4);
artifact('org.slf4j', 'slf4j-api', 2);
artifact('net.bytebuddy', 'byte-buddy', 1);
artifact('net.bytebuddy', 'byte-buddy-agent', 1);
artifact('org.objenesis', 'objenesis', 3);
artifact('org.hibernate.validator', 'hibernate-validator', 8);
artifact('org.jboss.logging', 'jboss-logging', 3);
artifact('com.fasterxml', 'classmate', 1);
artifact('org.apache.tomcat.embed', 'tomcat-embed-el', 10);
for (const name of ['jackson-core', 'jackson-databind', 'jackson-annotations']) artifact('com.fasterxml.jackson.core', name, 2);

const fixtures = {
  31: 'package com.acme.orders; class OrderEntity {}',
  32: 'class Stock {}',
  33: 'class AuditEvent {}',
  34: 'class Product { long getVersion() { return 0; } void setName(String value) {} } interface ProductRepository { java.util.Optional<Product> findById(long id); void flush(); }',
  36: 'class Account { java.math.BigDecimal balance() { return java.math.BigDecimal.ZERO; } void debit(java.math.BigDecimal amount) {} void credit(java.math.BigDecimal amount) {} }',
  37: 'class PurchaseOrder { PurchaseOrder(java.util.UUID id, long customer) {} } class OutboxEvent { OutboxEvent(java.util.UUID event, java.util.UUID order, String type) {} }',
  47: challenges.find(question => question.id === 28).solution,
};
const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'java-practice-framework-'));
const classpath = jars.join(path.delimiter);
let compiled = 0;
let verified = 0;
try {
  for (const question of challenges.filter(question => !question.solution.includes('public class Main {'))) {
    const directory = path.join(temporaryRoot, String(question.id));
    mkdirSync(directory);
    const filename = question.id === 31 ? 'OrderSummary.java' : 'Exercise.java';
    const contract = frameworkContract(question);
    writeFileSync(path.join(directory, filename), question.starter);
    if (fixtures[question.id]) writeFileSync(path.join(directory, 'Context.java'), fixtures[question.id]);
    const args = ['--release', '17', '-parameters', '-cp', classpath, '-d', directory, filename];
    if (fixtures[question.id]) args.push('Context.java');
    // Argfile avoids Windows command-line length limits and quotes paths safely.
    writeFileSync(path.join(directory, 'javac.args'), args.map(arg => JSON.stringify(arg.replaceAll('\\', '/'))).join('\n'));
    const starterResult = spawnSync('javac', ['@javac.args'], { cwd: directory, encoding: 'utf8', timeout: 30000 });
    assert.equal(starterResult.status, 0, `Challenge ${question.id} starter: ${starterResult.error || starterResult.stderr}`);
    writeFileSync(path.join(directory, filename), question.solution + (contract || ''));
    const result = spawnSync('javac', ['@javac.args'], { cwd: directory, encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 0, `Challenge ${question.id} (${question.title}): ${result.error || result.stderr}`);
    if (contract) {
      writeFileSync(path.join(directory, 'java.args'), ['-Djdk.attach.allowAttachSelf=true', '-cp', directory + path.delimiter + classpath, 'Behavior'].map(arg => JSON.stringify(arg.replaceAll('\\', '/'))).join('\n'));
      const behavior = spawnSync('java', ['@java.args'], { cwd: directory, encoding: 'utf8', timeout: 15000 });
      assert.equal(behavior.status, 0, `Challenge ${question.id} behavior: ${behavior.error || behavior.stderr}`);
      verified++;
    }
    compiled++;
  }
  console.log(`${compiled} framework/JUnit starters and solution snippets compile; ${verified} unit-contract suites pass against real cached Spring Boot 3 / Framework 6 dependencies. Domain fixtures supply documented external types; this does not verify database, Redis, Kafka, HTTP issuer, or Docker integration behavior.`);
} finally {
  function cleanup(directory) {
    const relative = path.relative(temporaryRoot, directory);
    assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative));
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) cleanup(target); else unlinkSync(target);
    }
    rmdirSync(directory);
  }
  cleanup(temporaryRoot);
}
