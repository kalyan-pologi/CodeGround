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
  'A Spring Boot API suddenly becomes 5× slower even though CPU utilization is low. How would you locate the bottleneck across threads, pools, blocking calls, and dependencies?',
  'Why can a Kubernetes pod be OOMKilled even when Java heap usage is below its maximum, and how would you troubleshoot JVM and container memory consumption?',
  'What happens internally when a Spring Boot application starts, including @SpringBootApplication, auto-configuration, component scanning, ApplicationContext, and bean lifecycle?',
  'How does dependency injection work in Spring, and how would you handle multiple beans, bean scopes, circular dependencies, and constructor vs. field injection?',
  'A @Transactional operation partially fails. How does Spring decide rollback, and why do self-invocation, private methods, exception handling, propagation, and isolation matter?',
  'How do @Async, CompletableFuture, RestTemplate, WebClient, and FeignClient differ, and when would you use each for asynchronous and inter-service communication?',
  'How would you evolve a production Spring Boot REST API without breaking clients, while handling validation, DTOs, pagination, versioning, and consistent errors?',
  'A Spring Boot application works locally but fails or performs poorly in production. How would you isolate configuration, startup, pool, observability, and resource differences?',
  'How does Hibernate work internally, and how would you resolve N+1 queries, LazyInitializationException, dirty checking, and lazy vs. eager loading issues?',
  'How do optimistic and pessimistic locking work, and how would you prevent lost updates when multiple transactions modify the same database record?',
  'A SQL query performs well with 100 records but becomes extremely slow with millions of records. How would you analyze execution plans, indexing, joins, and query optimization?',
  'How do database transactions and ACID properties work, and how does Spring manage commits, rollbacks, isolation levels, propagation, and connection pooling?',
  'How would you design efficient pagination, composite indexing, partitioning, and sharding for a database table containing 100 million records?',
  'How would you handle database schema migrations, versioning, backward compatibility, and data consistency during zero-downtime deployments?',
  'How would you design a scalable payment processing system using Spring Boot, REST APIs, Kafka, Redis, databases, and load balancing to handle thousands of requests per second?',
  'Retries are making a downstream outage worse. How would you prevent a cascading failure using deadlines, backoff, circuit breakers, bulkheads, fallbacks, and Resilience4j?',
  'How would you handle distributed transactions when payment succeeds but inventory reservation fails, using Saga, compensation transactions, eventual consistency, and the Transactional Outbox pattern?',
  'The same payment request reaches multiple instances. How would you guarantee idempotent processing with keys, constraints, conditional updates, and safe retries?',
  'Traffic suddenly increases by 10×. How would you protect and scale a microservices system using load balancing, autoscaling, caching, admission control, messaging, and load tests?',
  'How would you design communication and observability across microservices using REST, gRPC, Kafka, API Gateway, service discovery, correlation IDs, and distributed tracing?',
  'How does Apache Kafka work internally, including brokers, topics, partitions, offsets, consumer groups, rebalancing, and message ordering?',
  'How would you prevent message loss and duplicate processing in Kafka using producer acknowledgments, idempotent producers, transactions, offset management, and delivery guarantees?',
  'Kafka consumer lag keeps increasing while consumers appear healthy. How would you distinguish partition limits, hot keys, processing bottlenecks, database latency, retries, and rebalances?',
  'A Kafka message fails after consumption. How would you classify the failure, retry safely, route poison messages, commit offsets, and replay without duplicate side effects?',
  'How would you implement Redis caching using cache-aside, TTL, eviction, cache invalidation, and distributed locking while preventing stale data and cache stampedes?',
  'How would you implement authentication and authorization in Spring Boot microservices using Spring Security, OAuth2, JWT, RBAC, refresh tokens, and service-to-service authentication?',
  'How would you protect REST APIs against SQL injection, XSS, CSRF, IDOR/BOLA, unauthorized access, and sensitive data exposure?',
  'How would you test a payment microservice using JUnit, Mockito, integration testing, Testcontainers, concurrency testing, and failure scenarios?',
  'A production failure is intermittent and hard to reproduce. How would you use logs, metrics, traces, mitigation, rollback, and root-cause analysis to investigate it?',
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
  'Design an idempotent payment REST API that remains safe when clients retry, requests race, and the provider response is uncertain.',
  'Design a Kafka order workflow that survives consumer crashes, retries, dead-letter routing, replay, and database/Kafka consistency problems.',
  'What does spring-boot-starter-web add to an application, and how do its transitive dependencies lead to an embedded web server?',
  'How does Spring Boot load external configuration, resolve property precedence, and bind values with @Value and @ConfigurationProperties?',
  'How do Spring profiles work, and what happens when application.yml and application.properties both define the same property?',
  'What is SpringFactoriesLoader, how did auto-configuration imports evolve, and how does Spring Boot discover configuration classes?',
  'What is the difference between @SpringBootApplication, @ComponentScan, @EnableAutoConfiguration, and @Import, and how do you exclude auto-configuration?',
  'How does Spring Boot detect and start embedded Tomcat, and what is the precedence order for server.port?',
  'What is the difference between @RestController and @Controller internally, and what happens when a request reaches a REST endpoint?',
  'How does @Configuration differ from a normal class, and what is the complete Spring bean lifecycle?',
  'How does Spring Boot auto-configure a DataSource, and how would you diagnose connection-pool exhaustion?',
  'How does Spring exception translation work from JDBC or Hibernate exceptions to Spring DataAccessException types?',
  'How does Spring Boot manage dependency versions with its BOM, and what are the differences between a normal JAR and an executable fat JAR?',
  'How does Spring Boot configure logging by default, and how do you change logging safely in production?',
  'How does Actuator work internally, which endpoints should be exposed, and why is Spring Boot suitable for cloud-native applications?',
  'How do you make a scheduled Spring job safe when multiple application instances run, and how do you avoid duplicate execution?',
  'What are the most common Spring Boot performance mistakes, and how would you identify them with metrics, traces, and profiling?'
];

const questionIdsByTopic = {
  'Java Core': [1, 2, 3, 5, 6, 10, 11],
  JVM: [4, 18, 19, 21],
  'Java Streams': [7, 8, 58],
  Concurrency: [9, 12, 13, 14, 15, 16, 17, 53, 54, 55, 56, 57],
  'Spring Boot': [20, 22, 23, 24, 25, 26, 27, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75],
  Hibernate: [28],
  Database: [29, 30, 31, 32, 33],
  'System Design': [34, 36, 37, 59],
  Microservices: [35, 38, 39],
  Kafka: [40, 41, 42, 43, 60],
  Redis: [44],
  Security: [45, 46],
  Testing: [47],
  Observability: [48],
  Kubernetes: [49, 50],
  'CI/CD': [51],
  AWS: [52]
};

const topicByQuestionId = new Map(
  Object.entries(questionIdsByTopic).flatMap(([topic, ids]) => ids.map(id => [id, topic]))
);

const relatedTagsByTopic = {
  'Java Core': ['Java Core', 'Fundamentals'],
  JVM: ['JVM', 'Performance'],
  'Java Streams': ['Java Streams', 'Collections'],
  Concurrency: ['Concurrency', 'Multithreading'],
  'Spring Boot': ['Spring Boot', 'Spring Framework'],
  Hibernate: ['Hibernate', 'JPA'],
  Database: ['Database', 'SQL'],
  'System Design': ['System Design', 'Distributed Systems'],
  Microservices: ['Microservices', 'Resilience'],
  Kafka: ['Kafka', 'Messaging'],
  Redis: ['Redis', 'Caching'],
  Security: ['Security', 'Spring Security'],
  Testing: ['Testing', 'JUnit'],
  Observability: ['Observability', 'Production'],
  Kubernetes: ['Kubernetes', 'Cloud Deployment'],
  'CI/CD': ['CI/CD', 'DevOps'],
  AWS: ['AWS', 'Cloud Architecture']
};

const detailTagRules = [
  [/HashMap|ConcurrentHashMap|Hashtable|TreeMap/i, ['Collections']],
  [/equals\(\)|hashCode|compareTo/i, ['Object Contracts']],
  [/immutable|immutability/i, ['Immutability']],
  [/memory|heap|stack|OutOfMemory|garbage collection|G1GC|ZGC/i, ['Memory Management']],
  [/Streams|parallelStream/i, ['Stream API']],
  [/CompletableFuture|Future|ExecutorService|ThreadPoolExecutor|BlockingQueue|Semaphore|CountDownLatch/i, ['Executors']],
  [/thread|race condition|volatile|synchronized|CAS|deadlock|livelock|starvation/i, ['Thread Safety']],
  [/Spring Boot|SpringFactoriesLoader|Spring profile|@SpringBootApplication|auto-configur/i, ['Spring Boot']],
  [/configuration|property precedence|@Value|@ConfigurationProperties|application\.yml/i, ['Configuration']],
  [/@Transactional|transaction|ACID|rollback|propagation|isolation/i, ['Transactions']],
  [/REST|RestTemplate|WebClient|FeignClient|@RestController|@Controller/i, ['REST APIs']],
  [/Hibernate|JPA|LazyInitialization|N\+1|locking|DataSource|JDBC|SQL|index|partitioning|sharding/i, ['Persistence']],
  [/payment|idempotent|Saga|outbox/i, ['Resilience']],
  [/microservices|distributed|circuit breaker|bulkhead|Resilience4j/i, ['Distributed Systems']],
  [/Kafka|consumer|producer|offset|partition|dead-letter|replay/i, ['Event Driven']],
  [/Redis|cache|TTL|eviction|cache stampede/i, ['Caching']],
  [/authentication|authorization|OAuth2|JWT|RBAC|SQL injection|XSS|CSRF|IDOR/i, ['Application Security']],
  [/JUnit|Mockito|Testcontainers|testing/i, ['Automated Testing']],
  [/logs|metrics|traces|observability|root-cause/i, ['Production Diagnostics']],
  [/Kubernetes|pod|kubectl|health checks/i, ['Container Operations']],
  [/CI\/CD|Jenkins|deployment|rollback/i, ['Delivery']],
  [/AWS|EC2|EKS|ALB|RDS|DynamoDB|S3|IAM|VPC/i, ['Cloud Architecture']]
];

function tagsForQuestion(title, topic) {
  const tags = [...(relatedTagsByTopic[topic] || [topic])];
  detailTagRules.forEach(([pattern, additions]) => {
    if (pattern.test(title)) additions.forEach(tag => { if (!tags.includes(tag)) tags.push(tag); });
  });
  return tags.slice(0, 4);
}

function questionEntries() {
  return interviewQuestions.map((title, index) => ({
    id: `interview-question-${index + 1}`,
    title,
    topic: topicByQuestionId.get(index + 1),
    tags: tagsForQuestion(title, topicByQuestionId.get(index + 1)),
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

  const select = index => {
    const question = entries[index];
    if (!question) return false;
    const currentSelection = ++selection;
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
    doc.defaultView?.scrollTo(0, 0);

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

  return { select, count: entries.length, reader };
}

function mountInterviewQuestionHome(doc, entries, questionReader) {
  const body = doc.querySelector('.note-body');
  if (!body) return null;
  const home = doc.createElement('section');
  home.className = 'interview-question-home';
  home.innerHTML = `<header class="interview-question-home-header"><div><p class="interview-question-eyebrow">Java interview preparation</p><h1>Java Interview Questions</h1></div><span class="interview-question-total">${entries.length} questions</span></header>
    <div class="interview-question-home-filters"><input type="search" aria-label="Search interview questions" placeholder="Search by question or topic"><select aria-label="Filter by topic"><option value="">All topics</option></select><span class="interview-question-shown" aria-live="polite"></span></div>
    <div class="interview-question-home-columns" aria-hidden="true"><span>#</span><span>Question</span></div>
    <ol class="interview-question-home-list"></ol>`;
  const search = home.querySelector('input');
  const filter = home.querySelector('select');
  const shown = home.querySelector('.interview-question-shown');
  const list = home.querySelector('ol');
  [...new Set(entries.map(entry => entry.topic))].sort().forEach(topic => {
    const option = doc.createElement('option');
    option.value = topic;
    option.textContent = topic;
    filter.append(option);
  });
  const render = () => {
    const query = search.value.trim().toLowerCase();
    const topic = filter.value;
    const filtered = entries.filter(entry => (!topic || entry.topic === topic) && (!query || entry.title.toLowerCase().includes(query) || entry.tags.some(tag => tag.toLowerCase().includes(query))));
    shown.textContent = `${filtered.length} shown`;
    list.replaceChildren(...filtered.map(entry => {
      const item = doc.createElement('li');
      const button = doc.createElement('button');
      button.type = 'button';
      button.dataset.target = entry.id;
      button.innerHTML = `<span class="interview-question-number">${entry.id.replace('interview-question-', '')}</span><span class="interview-question-home-title"><strong></strong><small class="interview-question-home-topic"></small></span>`;
      button.querySelector('strong').textContent = entry.title;
      button.querySelector('.interview-question-home-topic').textContent = entry.tags.join(' · ');
      button.addEventListener('click', () => {
        home.hidden = true;
        questionReader.reader.hidden = false;
        questionReader.select(Number(entry.id.replace('interview-question-', '')) - 1);
      });
      item.append(button);
      return item;
    }));
    if (!filtered.length) list.innerHTML = '<li class="interview-question-home-empty">No questions match your search.</li>';
  };
  body.replaceChildren(home, questionReader.reader);
  questionReader.reader.hidden = true;
  search.addEventListener('input', render);
  filter.addEventListener('change', render);
  render();
  return home;
}

export function mountInterviewQuestionDrawer(doc) {
  if (doc.body.dataset.interviewQuestionDrawer) return;
  const entries = questionEntries();
  if (!entries.length) return;
  doc.body.dataset.interviewQuestionDrawer = 'true';
  addStyle(doc);
  const questionReader = mountSingleQuestionReader(doc, entries);
  const home = mountInterviewQuestionHome(doc, entries, questionReader);

  const toolbar = doc.createElement('div');
  toolbar.className = 'interview-question-toolbar';
  toolbar.hidden = true;
  toolbar.innerHTML = '<button type="button" aria-haspopup="dialog" aria-controls="interview-question-drawer"><span aria-hidden="true">☰</span> Interview Questions</button>';
  toolbar.style.left = '18px';
  toolbar.style.right = 'auto';
  toolbar.replaceChildren();
  toolbar.innerHTML = `<button class="interview-question-menu" type="button" aria-label="Open interview questions" aria-haspopup="dialog" aria-controls="interview-question-drawer"><span aria-hidden="true">☰</span></button>
    <strong>Java Interview Questions</strong>
    <button class="interview-question-home-button" type="button">Questions home</button>
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
    const filtered = entries.filter(entry => entry.title.toLowerCase().includes(query) || entry.tags.some(tag => tag.toLowerCase().includes(query)));
    list.innerHTML = filtered.map(entry => `<button type="button" data-target="${entry.id}"><span class="interview-question-dot" aria-hidden="true"></span><span>${entry.id.replace('interview-question-', '')}. ${entry.title}</span><small>${entry.tags.join(' · ')}</small></button>`).join('') || '<p class="interview-question-empty">No questions match your search.</p>';
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
  toolbar.querySelector('.interview-question-home-button').addEventListener('click', () => {
    questionReader.reader.hidden = true;
    home.hidden = false;
    toolbar.hidden = true;
    doc.defaultView?.scrollTo(0, 0);
  });
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
    home.hidden = true;
    questionReader.reader.hidden = false;
    toolbar.hidden = false;
    drawer.close();
  });
  home.addEventListener('click', event => {
    if (event.target.closest('[data-target]')) toolbar.hidden = false;
  });
  render();
}
