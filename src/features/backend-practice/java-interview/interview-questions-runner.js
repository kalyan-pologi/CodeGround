import { fetchText } from '../../../services/note-content.js';
import questionStyles from '../../../styles/interview-questions.css?inline';

function addStyle(doc) {
  if (doc.querySelector('[data-interview-question-style]')) return;
  const style = doc.createElement('style');
  style.dataset.interviewQuestionStyle = 'true';
  style.textContent = questionStyles;
  doc.head.append(style);
}

const interviewQuestions = [
  'How does HashMap work internally, and what happens during hash collisions, resizing, and concurrent modification?',
  'How do equals(), hashCode(), ==, and compareTo() differ, and what happens when they are implemented incorrectly?',
  'How do you design an immutable Java class, and why does immutability help with thread safety?',
  'How does Java memory management work, including heap, stack, references, pass-by-value, and object allocation?',
  'How do Java generics, type erasure, reflection, and annotations work internally?',
  'How would you choose between HashMap, ConcurrentHashMap, Hashtable, CopyOnWriteArrayList, and TreeMap for different real-world applications?',
  'How do Java Streams work internally, and when can parallelStream() reduce performance compared to sequential streams?',
  'How would you process millions of records efficiently using Java Streams, batching, and pagination without exhausting memory?',
  'How do CompletableFuture, Future, and ExecutorService differ, and how would you execute and combine multiple asynchronous API calls with timeout and exception handling?',
  'How do functional interfaces, lambda expressions, method references, and Optional work in Java 8?',
  'What are the important Java 17 and Java 21 features, including records, sealed classes, pattern matching, switch expressions, and virtual threads?',
  'Two threads update the same bank account balance simultaneously. How do race conditions occur, and how would you fix them using synchronized, ReentrantLock, AtomicInteger, and CAS?',
  'How does the Java Memory Model work, and what are the differences between volatile, synchronized, atomicity, visibility, and happens-before relationships?',
  'How would you design and configure a ThreadPoolExecutor to handle 10,000 incoming tasks, including thread-pool sizing, queue capacity, rejection policies, and backpressure?',
  'What are deadlock, livelock, and starvation, and how would you detect, troubleshoot, and prevent them in production?',
  'How would you implement the producer-consumer pattern using BlockingQueue, Semaphore, wait(), notify(), notifyAll(), and CountDownLatch?',
  'How do platform threads, virtual threads, and ThreadLocal work, and what are their performance and memory implications in high-concurrency applications?',
  'A Java application crashes with OutOfMemoryError after running for several days. How would you identify memory leaks using heap dumps, GC logs, and profiling tools?',
  'How does Java garbage collection work, and how would you compare and tune G1GC, ZGC, and other collectors for throughput and low latency?',
  'A Spring Boot API becomes slow under high traffic even though CPU utilization is low. How would you investigate thread contention, connection pools, blocking calls, and resource exhaustion?',
  'Why can a Kubernetes pod be OOMKilled even when Java heap usage is below its maximum, and how would you troubleshoot JVM and container memory consumption?',
  'What happens internally when a Spring Boot application starts, including @SpringBootApplication, auto-configuration, component scanning, ApplicationContext, and bean lifecycle?',
  'How does dependency injection work in Spring, and how would you handle multiple beans, bean scopes, circular dependencies, and constructor vs. field injection?',
  'How does @Transactional work internally in Spring, and why might transactions fail because of self-invocation, private methods, exception handling, propagation, or isolation?',
  'How do @Async, CompletableFuture, RestTemplate, WebClient, and FeignClient differ, and when would you use each for asynchronous and inter-service communication?',
  'How would you design production-ready REST APIs using Spring Boot, including request validation, exception handling, DTOs, pagination, API versioning, and response standardization?',
  'A Spring Boot application works locally but fails or performs poorly in production. How would you troubleshoot profiles, configuration, Actuator, logging, startup, connection pools, and resource limitations?',
  'How does Hibernate work internally, and how would you resolve N+1 queries, LazyInitializationException, dirty checking, and lazy vs. eager loading issues?',
  'How do optimistic and pessimistic locking work, and how would you prevent lost updates when multiple transactions modify the same database record?',
  'A SQL query performs well with 100 records but becomes extremely slow with millions of records. How would you analyze execution plans, indexing, joins, and query optimization?',
  'How do database transactions and ACID properties work, and how does Spring manage commits, rollbacks, isolation levels, propagation, and connection pooling?',
  'How would you design efficient pagination, composite indexing, partitioning, and sharding for a database table containing 100 million records?',
  'How would you handle database schema migrations, versioning, backward compatibility, and data consistency during zero-downtime deployments?',
  'How would you design a scalable payment processing system using Spring Boot, REST APIs, Kafka, Redis, databases, and load balancing to handle thousands of requests per second?',
  'How would you prevent cascading failures in microservices using circuit breakers, retries, exponential backoff, timeouts, bulkheads, fallbacks, and Resilience4j?',
  'How would you handle distributed transactions when payment succeeds but inventory reservation fails, using Saga, compensation transactions, eventual consistency, and the Transactional Outbox pattern?',
  'How would you prevent duplicate payment processing across multiple microservice instances using idempotency keys, unique constraints, conditional updates, and retry handling?',
  'How would you scale a microservices application to handle a sudden 10x traffic spike using load balancing, autoscaling, caching, rate limiting, messaging, and performance testing?',
  'How would you design communication and observability across microservices using REST, gRPC, Kafka, API Gateway, service discovery, correlation IDs, and distributed tracing?',
  'How does Apache Kafka work internally, including brokers, topics, partitions, offsets, consumer groups, rebalancing, and message ordering?',
  'How would you prevent message loss and duplicate processing in Kafka using producer acknowledgments, idempotent producers, transactions, offset management, and delivery guarantees?',
  'Kafka consumer lag keeps increasing even though all consumers are running. How would you diagnose partition limitations, processing bottlenecks, database latency, and consumer configurations?',
  'How would you handle failed Kafka messages using retries, retry topics, dead-letter topics, poison-message handling, manual acknowledgment, and safe event replay?',
  'How would you implement Redis caching using cache-aside, TTL, eviction, cache invalidation, and distributed locking while preventing stale data and cache stampedes?',
  'How would you implement authentication and authorization in Spring Boot microservices using Spring Security, OAuth2, JWT, RBAC, refresh tokens, and service-to-service authentication?',
  'How would you protect REST APIs against SQL injection, XSS, CSRF, IDOR/BOLA, unauthorized access, and sensitive data exposure?',
  'How would you test a payment microservice using JUnit, Mockito, integration testing, Testcontainers, concurrency testing, and failure scenarios?',
  'How would you investigate intermittent production failures using centralized logging, metrics, distributed tracing, root-cause analysis, and rollback strategies?',
  'How would you containerize and deploy a Spring Boot microservice to AWS using Docker, Kubernetes/EKS, Pods, Services, Deployments, load balancers, and IAM?',
  'A Kubernetes pod repeatedly crashes, restarts, or fails health checks. How would you troubleshoot it using kubectl, logs, resource limits, readiness probes, and liveness probes?',
  'How would you design a secure CI/CD pipeline using Git, Jenkins, automated testing, security scanning, blue-green/canary deployments, rollback, and secrets management?',
  'How would you design scalable and highly available AWS infrastructure using EC2, EKS, ALB, RDS, DynamoDB, S3, IAM, VPC, and autoscaling?',
  'Write a Java program demonstrating a race condition and fix it using synchronized and AtomicInteger. Explain the expected output and internal working.',
  'Write a Java program using two threads to print odd and even numbers from 1 to 100 in sequence.',
  'Implement a producer-consumer system using BlockingQueue with multiple producers and consumers.',
  'Write a Java program to demonstrate deadlock and explain how to prevent it using lock ordering or tryLock().',
  'Implement a bounded ThreadPoolExecutor with custom thread-pool configuration, queue capacity, rejection handling, and graceful shutdown.',
  'Write Java Streams code to find the second-highest distinct salary in each department, group employees by department, and handle duplicate salaries.',
  'Design and implement an idempotent payment REST API using Spring Boot, database transactions, and unique constraints to prevent duplicate charges.',
  'Design a Kafka-based order processing workflow with retries, dead-letter topics, idempotent consumers, and database consistency.'
];

function questionEntries() {
  return interviewQuestions.map((title, index) => ({
    id: `interview-question-${index + 1}`,
    title,
    file: `features/backend-practice/java-interview/questions/question-${String(index + 1).padStart(2, '0')}/question.html`
  }));
}

function mountSingleQuestionReader(doc, entries) {
  const body = doc.querySelector('.note-body');
  if (!body) return null;

  const reader = doc.createElement('main');
  reader.className = 'interview-question-reader';
  body.replaceChildren(reader);
  let selection = 0;

  const select = (index, shouldScroll = true) => {
    const question = entries[index];
    if (!question) return false;
    const currentSelection = ++selection;
    const scrollTop = doc.defaultView?.scrollY || doc.documentElement.scrollTop || 0;
    const panel = doc.createElement('article');
    panel.className = 'interview-question-answer';
    panel.id = question.id;
    const title = doc.createElement('h1');
    title.textContent = `Question: ${question.title}`;
    const status = doc.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = 'Loading answer…';
    panel.append(title, status);
    reader.replaceChildren(panel);
    if (shouldScroll) doc.defaultView?.scrollTo(0, scrollTop);

    fetchText(question.file).then(html => {
      if (currentSelection !== selection || !panel.isConnected) return;
      if (!html.trim()) {
        status.textContent = 'Answer not available yet.';
        return;
      }
      const template = doc.createElement('template');
      template.innerHTML = html;
      const sourceTitle = [...template.content.querySelectorAll('h2, h3')]
        .find(heading => heading.textContent.trim().startsWith('Question:'));
      sourceTitle?.remove();
      panel.replaceChildren(title, template.content);
    }).catch(() => {
      if (currentSelection === selection && panel.isConnected) {
        status.textContent = 'Could not load this answer. Please try again.';
      }
    });
    return true;
  };

  select(0, false);
  return { select, count: entries.length };
}

export function mountInterviewQuestionDrawer(doc) {
  if (doc.body.dataset.interviewQuestionDrawer) return;
  const entries = questionEntries();
  if (!entries.length) return;
  doc.body.dataset.interviewQuestionDrawer = 'true';
  addStyle(doc);
  const questionReader = mountSingleQuestionReader(doc, entries);

  const toolbar = doc.createElement('div');
  toolbar.className = 'interview-question-toolbar';
  toolbar.innerHTML = '<button type="button" aria-haspopup="dialog" aria-controls="interview-question-drawer"><span aria-hidden="true">☰</span> Interview Questions</button>';
  toolbar.style.left = '18px';
  toolbar.style.right = 'auto';
  toolbar.replaceChildren();
  toolbar.innerHTML = `<button class="interview-question-menu" type="button" aria-label="Open interview questions" aria-haspopup="dialog" aria-controls="interview-question-drawer"><span aria-hidden="true">☰</span></button>
    <strong>Java Interview Questions</strong>
    <button class="interview-question-nav" type="button" data-direction="previous" aria-label="Previous question">‹</button>
    <button class="interview-question-nav" type="button" data-direction="next" aria-label="Next question">›</button>
    <span class="interview-question-count" aria-live="polite">1 / ${entries.length}</span>`;
  doc.body.prepend(toolbar);

  const drawer = doc.createElement('dialog');
  drawer.className = 'interview-question-drawer';
  drawer.id = 'interview-question-drawer';
  drawer.setAttribute('aria-label', 'Java interview questions');
  drawer.innerHTML = `<div class="interview-question-drawer-inner">
    <header><h2>Java Interview Questions</h2><button type="button" aria-label="Close interview questions">×</button></header>
    <label><span class="interview-question-sr-only">Search questions</span><input type="search" placeholder="Search questions"></label>
    <div class="interview-question-list"></div>
  </div>`;
  doc.body.append(drawer);

  const list = drawer.querySelector('.interview-question-list');
  const search = drawer.querySelector('input');
  const close = drawer.querySelector('header button');
  const render = () => {
    const query = search.value.trim().toLowerCase();
    const filtered = entries.filter(entry => entry.title.toLowerCase().includes(query));
    list.innerHTML = filtered.map(entry => `<button type="button" data-target="${entry.id}"><span class="interview-question-dot" aria-hidden="true"></span><span>${entry.id.replace('interview-question-', '')}. ${entry.title}</span><small>Java</small></button>`).join('') || '<p class="interview-question-empty">No questions match your search.</p>';
  };

  const count = toolbar.querySelector('.interview-question-count');
  let activeIndex = 0;
  const selectQuestion = index => {
    if (!questionReader?.select(index)) return false;
    activeIndex = index;
    count.textContent = `${index + 1} / ${questionReader.count}`;
    return true;
  };

  toolbar.querySelector('.interview-question-menu').addEventListener('click', () => { drawer.showModal(); search.focus(); });
  toolbar.querySelector('[data-direction="previous"]').addEventListener('click', () => selectQuestion(Math.max(0, activeIndex - 1)));
  toolbar.querySelector('[data-direction="next"]').addEventListener('click', () => selectQuestion(Math.min(questionReader.count - 1, activeIndex + 1)));
  close.addEventListener('click', () => drawer.close());
  drawer.addEventListener('click', event => { if (event.target === drawer) drawer.close(); });
  search.addEventListener('input', render);
  list.addEventListener('click', event => {
    const button = event.target.closest('[data-target]');
    if (!button) return;
    const index = Number(button.dataset.target.replace('interview-question-', '')) - 1;
    if (!selectQuestion(index)) return;
    drawer.close();
  });
  render();
}
