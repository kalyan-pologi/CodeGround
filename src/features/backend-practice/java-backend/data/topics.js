export const topicGroups = [
  { label: 'Core Java', topics: [
    'Java Fundamentals', 'Strings & OOP', 'Collections & Generics',
    'Streams & Functional Programming', 'Exceptions & File I/O', 'Date & Time API',
    'Multithreading & Concurrency', 'JVM & Memory', 'Java 8-21 Features',
    'Reflection & Annotations', 'JDBC & SQL', 'Build Tools & Testing',
  ] },
  { label: 'Spring Framework', topics: [
    'Spring Core & Dependency Injection', 'Spring Boot & REST APIs',
    'Spring Data JPA & Hibernate', 'Transactions & AOP', 'Spring Security',
    'Spring Cache & Redis', 'Messaging & Async', 'Microservices & Resilience',
    'Spring Testing', 'Observability & Performance',
  ] },
];
export const topics = topicGroups.flatMap(group => group.topics);
