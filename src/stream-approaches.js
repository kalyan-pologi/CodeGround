// Alternatives are attached to their question, rather than a detached answer bank.
export const streamApproaches = [
  {
    question: 'Get all IT employees, sorted by salary descending.',
    title: 'Sort a mutable copy when the result will be edited',
    code: `List<Employee> sortedIT = employees.stream()
    .filter(employee -> employee.getDepartment().equals("IT"))
    .collect(Collectors.toCollection(ArrayList::new));
sortedIT.sort(Comparator.comparingDouble(Employee::getSalary).reversed());`,
    choose: 'sorted() keeps the transformation in the Stream pipeline. Sorting a copied ArrayList is useful when the result will be edited or sorted again. Both take O(m log m) for m selected employees; never sort the original list unless changing its order is intended.',
    check: 'check(sortedIT.stream().map(Employee::getId).toList().equals(List.of(2, 5, 1)) && employees.get(0).getId() == 1);'
  },
  {
    question: 'Convert the employee list into a map of department to list of employee emails.',
    title: 'Map values after grouping when grouped employees are reused',
    code: `Map<String, List<Employee>> grouped = employees.stream()
    .collect(Collectors.groupingBy(Employee::getDepartment));
Map<String, List<String>> emailsByDepartment = grouped.entrySet().stream()
    .collect(Collectors.toMap(Map.Entry::getKey,
        entry -> entry.getValue().stream().map(Employee::getEmail).toList()));`,
    choose: 'Downstream mapping is the better direct solution because it collects the desired emails without retaining a separate employee-group map. Post-processing is useful when those employee groups already exist or are also needed for another calculation.',
    check: 'check(emailsByDepartment.get("IT").equals(List.of("ada@example.com", "bob@example.com", "eve@example.com")));'
  },
  {
    question: 'Find the highest paid employee in each department.',
    title: 'toMap with a maximum merge policy',
    code: `Map<String, Employee> highestByDepartment = employees.stream()
    .collect(Collectors.toMap(Employee::getDepartment, Function.identity(),
        BinaryOperator.maxBy(Comparator.comparingDouble(Employee::getSalary))));`,
    choose: 'Use groupingBy + maxBy when working with downstream collectors. Use toMap for a direct department → Employee map without Optional values. Both select a highest salary; define an explicit comparator tie-breaker when employee identity matters.',
    check: 'check(highestByDepartment.get("IT").getSalary() == 9000 && highestByDepartment.get("HR").getSalary() == 7000);'
  },
  {
    question: 'Count how many times each name appears in a list.',
    title: 'toMap with a counting merge function',
    code: `Map<String, Long> nameFrequency = names.stream()
    .collect(Collectors.toMap(Function.identity(), name -> 1L, Long::sum));`,
    choose: 'groupingBy + counting states the grouping intent clearly. toMap teaches the key/value/merge pattern and adapts naturally to weighted totals. Both use expected O(n) time; map iteration order is unspecified.',
    check: 'check(nameFrequency.get("apple") == 2 && nameFrequency.get("bob") == 1);'
  },
  {
    question: 'Find only the numbers that appear more than once in a list.',
    title: 'Two sets and a loop for duplicate detection',
    code: `Set<Integer> seen = new HashSet<>();
Set<Integer> repeated = new LinkedHashSet<>();
for (Integer number : numbers) {
    if (!seen.add(number)) repeated.add(number);
}
List<Integer> duplicates = List.copyOf(repeated);`,
    choose: 'Use frequency grouping when counts are also needed. Use two sets when you only need unique repeated values. The loop keeps the order in which values first repeat. Avoid hiding this mutable seen-set inside a Stream filter, especially with parallel streams.',
    check: 'check(duplicates.equals(List.of(5, 7)));'
  },
  {
    question: 'Find the first non-repeating character in a string.',
    title: 'Count with HashMap, then rescan the original string',
    code: `String text = "swiss";
Map<Character, Long> counts = text.chars().mapToObj(c -> (char) c)
    .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
Optional<Character> firstUnique = text.chars().mapToObj(c -> (char) c)
    .filter(character -> counts.get(character) == 1)
    .findFirst();`,
    choose: 'LinkedHashMap preserves order while counting, so you can scan its entries. A plain counting map works too if the second scan follows the original string. Both take expected O(n) time and O(k) space. This version returns Optional.empty() when no unique character exists and uses UTF-16 char units, like the main example.',
    check: 'check(firstUnique.equals(Optional.of(\'w\')));'
  },
  {
    question: 'Calculate the total salary bill across all employees.',
    title: 'Use a summing collector',
    code: `double totalSalary = employees.stream()
    .collect(Collectors.summingDouble(Employee::getSalary));`,
    choose: 'mapToDouble(...).sum() is concise for a single total. summingDouble is useful when the same calculation needs to become a downstream collector inside groupingBy. Both return 0 for empty input. These examples retain the existing double-based interview model; exact money requires BigDecimal.',
    check: 'check(totalSalary == 33000);'
  },
  {
    question: 'Calculate the average age of all employees.',
    title: 'Use summary statistics when several aggregates are needed',
    code: `IntSummaryStatistics ageStats = employees.stream()
    .mapToInt(Employee::getAge).summaryStatistics();
OptionalDouble averageAge = ageStats.getCount() == 0
    ? OptionalDouble.empty() : OptionalDouble.of(ageStats.getAverage());`,
    choose: 'average() is preferable when the average is the only result. summaryStatistics gives count, sum, min, max, and average in one traversal. Check the count before interpreting empty-input min/max or creating an average.',
    check: 'check(averageAge.orElseThrow() == 30 && ageStats.getCount() == 5);'
  },
  {
    question: 'Get the average salary per department.',
    title: 'Collect department statistics, then extract the average',
    code: `Map<String, DoubleSummaryStatistics> salaryStats = employees.stream()
    .collect(Collectors.groupingBy(Employee::getDepartment,
        Collectors.summarizingDouble(Employee::getSalary)));
Map<String, Double> averages = salaryStats.entrySet().stream()
    .collect(Collectors.toMap(Map.Entry::getKey,
        entry -> entry.getValue().getAverage()));`,
    choose: 'averagingDouble is the direct choice for averages only. summarizingDouble is worth using when each department also needs count, total, minimum, or maximum; it avoids separate scans for those statistics.',
    check: 'check(averages.get("IT") == 8000 && salaryStats.get("IT").getCount() == 3);'
  },
  {
    question: 'Get the distinct list of department names.',
    title: 'Collect into an ordered set',
    code: `Set<String> departmentSet = employees.stream().map(Employee::getDepartment)
    .collect(Collectors.toCollection(LinkedHashSet::new));
List<String> departments = List.copyOf(departmentSet);`,
    choose: 'distinct().toList() is the simplest ordered list result. LinkedHashSet is useful when the intermediate result is also used for membership checks or incremental additions. Both preserve first encounter order; a plain HashSet does not.',
    check: 'check(departments.equals(List.of("IT", "HR")));'
  },
  {
    question: 'Build a map of employee id to full name, without blowing up if two employees share an id.',
    title: 'Reject duplicate IDs when they indicate bad input',
    code: `Map<Integer, String> namesById = employees.stream()
    .collect(Collectors.toMap(Employee::getId, Employee::getFullName));`,
    choose: 'The main merge function keeps the first name for a repeated ID. The two-argument collector instead throws IllegalStateException on duplicate IDs. Choose a policy explicitly: silently keeping one record is wrong when duplicate identity indicates a data error.',
    check: 'check(namesById.get(1).equals("Ada One"));'
  },
  {
    question: 'Get a map of department to total salary paid in that department.',
    title: 'Merge salary values directly with toMap',
    code: `Map<String, Double> salaryTotals = employees.stream()
    .collect(Collectors.toMap(Employee::getDepartment, Employee::getSalary, Double::sum));`,
    choose: 'groupingBy + summingDouble is a natural grouped aggregation. toMap is a compact key/value merge when the only result is a total per key. Floating-point summation order can affect the last bits; use a decimal model for exact financial totals.',
    check: 'check(salaryTotals.get("IT") == 24000 && salaryTotals.get("HR") == 9000);'
  },
  {
    question: 'Find the second highest salary across all employees.',
    title: 'Find the maximum, then the maximum below it',
    code: `OptionalDouble highest = employees.stream().mapToDouble(Employee::getSalary).max();
OptionalDouble secondHighest = highest.isEmpty() ? OptionalDouble.empty()
    : employees.stream().mapToDouble(Employee::getSalary)
        .filter(salary -> salary < highest.getAsDouble()).max();`,
    choose: 'distinct + sorted + skip is easy to generalize to Nth rank. For the second distinct salary only, two maximum scans use O(n) time and O(1) extra aggregation space, avoiding sorting. Fewer than two distinct values returns an empty OptionalDouble. Assumes finite salaries.',
    check: 'check(secondHighest.orElseThrow() == 7000);'
  },
  {
    question: 'Find the employee with the longest full name.',
    title: 'Sort only when a ranked list is also useful',
    code: `Optional<Employee> longestName = employees.stream()
    .sorted(Comparator.comparingInt((Employee employee) -> employee.getFullName().length()).reversed())
    .findFirst();`,
    choose: 'max is the preferred O(n) solution for one employee. Sorting takes O(n log n), but becomes useful if the same requirement expands to the top few names. Define a tie-breaker when an exact employee must be selected; empty input gives an empty Optional.',
    check: 'check(longestName.isPresent() && longestName.get().getFullName().length() == employees.stream().mapToInt(e -> e.getFullName().length()).max().orElseThrow());'
  },
  {
    question: 'Count word frequency in a sentence',
    title: 'Map each normalized word to one, then merge',
    code: `String sentence = "Java is fun. Java is useful!";
Map<String, Long> wordFrequency = Arrays.stream(
        sentence.toLowerCase(Locale.ROOT).split("[^\\\\p{L}\\\\p{N}]+"))
    .filter(word -> !word.isEmpty())
    .collect(Collectors.toMap(Function.identity(), word -> 1L, Long::sum, TreeMap::new));`,
    choose: 'This has the same tokenization and sorted-key policy as the main groupingBy example. Use groupingBy + counting for grouping intent; use toMap when practicing explicit merge functions. Tokenization policy matters more than the collector choice.',
    check: 'check(wordFrequency.equals(Map.of("java", 2L, "is", 2L, "fun", 1L, "useful", 1L)));'
  },
  {
    question: 'Find the first repeated character',
    title: 'Use an early-exit set scan for expected linear time',
    code: `String text = "abccba";
Set<Character> seen = new HashSet<>();
Optional<Character> firstRepeated = Optional.empty();
for (char character : text.toCharArray()) {
    if (!seen.add(character)) {
        firstRepeated = Optional.of(character);
        break;
    }
}`, 
    choose: 'The prefix-search Stream example is compact but can take O(n²). This common loop takes expected O(n) time and stops at the earliest second occurrence. It is clearer than forcing mutable state into a Stream filter. Both versions use UTF-16 char units.',
    check: 'check(firstRepeated.equals(Optional.of(\'c\')));'
  },
  {
    question: 'Find maximum and minimum elements',
    title: 'Get both results through one numeric summary',
    code: `IntSummaryStatistics statistics = numbers.stream()
    .mapToInt(Integer::intValue).summaryStatistics();
OptionalInt minimum = statistics.getCount() == 0 ? OptionalInt.empty() : OptionalInt.of(statistics.getMin());
OptionalInt maximum = statistics.getCount() == 0 ? OptionalInt.empty() : OptionalInt.of(statistics.getMax());`,
    choose: 'Separate min/max streams are fine for simple code or object comparators. A summary handles several numeric aggregates in one traversal. Empty summaries contain sentinel min/max values, so check count instead of returning those sentinels.',
    check: 'check(minimum.orElseThrow() == 1 && maximum.orElseThrow() == 10);'
  },
  {
    question: 'Find the top 3 highest salaries',
    title: 'Deduplicate into a reverse-ordered TreeSet',
    code: `NavigableSet<Double> salaryLevels = employees.stream().map(Employee::getSalary)
    .collect(Collectors.toCollection(() -> new TreeSet<Double>(Comparator.reverseOrder())));
List<Double> top3Salaries = salaryLevels.stream().limit(3).toList();`,
    choose: 'distinct + sorted is the straightforward one-shot Stream solution. TreeSet maintains uniqueness and ordering together and is useful when the sorted salary levels will be queried again. With d distinct values, insertion is O(n log d); it is not automatically faster for a single query.',
    check: 'check(top3Salaries.equals(List.of(9000.0, 7000.0, 6000.0)));'
  },
  {
    question: 'Find the Nth highest salary',
    title: 'Reuse an ordered set of distinct salary levels',
    code: `int n = 3;
if (n < 1) throw new IllegalArgumentException("n must be positive");
NavigableSet<Double> salaryLevels = employees.stream().map(Employee::getSalary)
    .collect(Collectors.toCollection(() -> new TreeSet<Double>(Comparator.reverseOrder())));
Optional<Double> nthHighestSalary = salaryLevels.stream().skip(n - 1L).findFirst();`,
    choose: 'For one rank, use the main distinct/sorted/skip pipeline. A TreeSet is useful when multiple questions reuse the distinct ordered levels. skip still traverses preceding elements; TreeSet does not provide O(1) rank lookup. Both return empty when the rank does not exist.',
    check: 'check(nthHighestSalary.equals(Optional.of(6000.0)));'
  },
  {
    question: 'Convert List<Employee> into Map<Id, Employee>',
    title: 'Choose a duplicate-ID policy and preserve encounter order',
    code: `Map<Integer, Employee> employeesById = employees.stream()
    .collect(Collectors.toMap(Employee::getId, Function.identity(),
        (first, later) -> first, LinkedHashMap::new));`,
    choose: 'The main two-argument collector rejects duplicate IDs. This variant intentionally keeps the first record and preserves first-ID encounter order. Keep-first and keep-last are business policies, not interchangeable fixes for a duplicate-key exception.',
    check: 'check(new ArrayList<>(employeesById.keySet()).equals(List.of(1, 2, 3, 4, 5)));'
  },
  {
    question: 'Find the longest string in a list',
    title: 'Use sorting when the requirement includes ranking',
    code: `List<String> words = List.of("Java", "Spring", "microservices");
Optional<String> longest = words.stream()
    .sorted(Comparator.comparingInt(String::length).reversed()).findFirst();`,
    choose: 'Prefer max for one longest string: O(n). Sorting is O(n log n) and is justified when you also want the longest N strings. Both need an explicit tie policy if a particular equal-length result matters.',
    check: 'check(longest.equals(Optional.of("microservices")));'
  },
  {
    question: 'Find common elements between two lists',
    title: 'Use contains directly for small inputs',
    code: `List<Integer> first = List.of(1, 2, 2, 3, 4);
List<Integer> second = List.of(2, 4, 6);
List<Integer> common = first.stream().distinct()
    .filter(second::contains).toList();`,
    choose: 'The direct contains version avoids building another collection and is easy for tiny lists, but can take O(n × m). The main HashSet lookup version is preferable for larger inputs and takes expected O(n + m) time. Both return unique common values in first-list encounter order.',
    check: 'check(common.equals(List.of(2, 4)));'
  },
  {
    question: 'Calculate salary sum and average together',
    title: 'Use separate primitive streams when clarity is enough',
    code: `double salarySum = employees.stream().mapToDouble(Employee::getSalary).sum();
OptionalDouble salaryAverage = employees.stream().mapToDouble(Employee::getSalary).average();`,
    choose: 'Two short streams are readable and safe because each call creates a fresh stream. summaryStatistics avoids the second traversal when several statistics are needed. Both represent the missing empty-input average explicitly here.',
    check: 'check(salarySum == 33000 && salaryAverage.orElseThrow() == 6600);'
  },
  {
    question: 'Remove duplicate elements using Streams',
    title: 'Collect directly into a set for membership operations',
    code: `List<Integer> input = List.of(3, 1, 3, 2, 1);
Set<Integer> unique = input.stream()
    .collect(Collectors.toCollection(LinkedHashSet::new));`,
    choose: 'Use distinct().toList() when a list is the desired result. Use LinkedHashSet when uniqueness, insertion order, and future membership checks are all useful. Use HashSet if encounter order is irrelevant.',
    check: 'check(new ArrayList<>(unique).equals(List.of(3, 1, 2)));'
  },
  {
    question: 'Remove duplicate elements using Streams',
    title: 'Choose a mutable list explicitly when needed',
    code: `List<Integer> mutableUnique = numbers.stream().distinct()
    .collect(Collectors.toCollection(ArrayList::new));
mutableUnique.add(99);`,
    choose: 'Stream.toList() is unmodifiable. toCollection(ArrayList::new) explicitly permits later additions/removals. Collectors.toList() does not promise a particular implementation or mutability. None of these choices deep-copies mutable objects.',
    check: 'check(mutableUnique.contains(99) && mutableUnique.size() == 11);'
  },
  {
    question: 'Count character frequency in a string',
    title: 'Count Unicode code points with a toMap merge',
    code: `String text = "banana";
Map<String, Long> characterFrequency = text.codePoints()
    .mapToObj(cp -> new String(Character.toChars(cp)))
    .collect(Collectors.toMap(Function.identity(), character -> 1L,
        Long::sum, LinkedHashMap::new));`,
    choose: 'This matches the main example’s Unicode and encounter-order policies while making merging explicit. codePoints handles supplementary characters; chars counts UTF-16 code units. Neither automatically combines a multi-code-point grapheme into one visible character.',
    check: 'check(characterFrequency.equals(Map.of("b", 1L, "a", 3L, "n", 2L)));'
  },
  {
    question: 'Group all employees by department.',
    title: 'Use computeIfAbsent for incremental grouping',
    code: `Map<String, List<Employee>> byDepartment = new LinkedHashMap<>();
for (Employee employee : employees) {
    byDepartment.computeIfAbsent(employee.getDepartment(), ignored -> new ArrayList<>()).add(employee);
}`, 
    choose: 'groupingBy is idiomatic for a complete Stream pipeline. computeIfAbsent is useful when records arrive incrementally or grouping is one part of an imperative workflow. This LinkedHashMap preserves department encounter order.',
    check: 'check(byDepartment.get("IT").size() == 3 && byDepartment.get("HR").size() == 2);'
  },
  {
    question: 'Group all employees by department.',
    title: 'Related behavior: filter before grouping or inside it',
    code: `Map<String, List<Employee>> matchingDepartments = employees.stream()
    .filter(employee -> employee.getSalary() > 8000)
    .collect(Collectors.groupingBy(Employee::getDepartment));
Map<String, List<Employee>> allObservedDepartments = employees.stream()
    .collect(Collectors.groupingBy(Employee::getDepartment,
        Collectors.filtering(employee -> employee.getSalary() > 8000, Collectors.toList())));`,
    choose: 'These two filtered results intentionally differ. Filtering before grouping removes departments without qualifying employees. Downstream filtering keeps every observed department, using an empty list when no one qualifies. It does not invent departments absent from the input.',
    check: 'check(!matchingDepartments.containsKey("HR") && allObservedDepartments.get("HR").isEmpty());'
  },
  {
    question: 'Split a list of numbers into even and odd groups.',
    title: 'Group by a Boolean classifier',
    code: `Map<Boolean, List<Integer>> byParity = numbers.stream()
    .collect(Collectors.groupingBy(number -> number % 2 == 0));`,
    choose: 'partitioningBy is the natural two-way predicate collector and always contains true and false keys. groupingBy only contains observed keys and generalizes to arbitrary categories. On empty input, these map shapes differ.',
    check: 'check(byParity.get(true).equals(List.of(2, 4, 6, 8, 10)));'
  },
  {
    question: 'Get the longest name per starting letter.',
    title: 'Select a per-key maximum with toMap',
    code: `Map<Character, String> longestByLetter = names.stream()
    .collect(Collectors.toMap(name -> Character.toUpperCase(name.charAt(0)), Function.identity(),
        BinaryOperator.maxBy(Comparator.comparingInt(String::length))));`,
    choose: 'The main groupingBy/maxBy/collectingAndThen approach teaches downstream collectors. toMap with a maximum merge is simpler when each key needs just one winning value. Both assume nonempty names; define a tie-breaker if equal-length words need a particular winner.',
    check: 'check(longestByLetter.get(\'A\').length() == 5 && longestByLetter.get(\'B\').equals("bob"));'
  },
  {
    question: 'Build a comma-separated string of all employee emails in the IT department.',
    title: 'Use String.join when a list is also needed',
    code: `List<String> emails = employees.stream().filter(employee -> employee.getDepartment().equals("IT"))
    .map(Employee::getEmail).toList();
String joinedEmails = String.join(", ", emails);`,
    choose: 'Collectors.joining is preferable for a Stream-to-string result. String.join is useful when the list already exists or will be reused. Creating a list only to join it adds storage; both produce an empty string for no matching emails.',
    check: 'check(joinedEmails.equals("ada@example.com, bob@example.com, eve@example.com"));'
  },
  {
    question: 'Check whether every IT employee earns over 4000.',
    title: 'Express the rule as no disqualifying employee',
    code: `boolean allItOver4k = employees.stream().filter(employee -> employee.getDepartment().equals("IT"))
    .noneMatch(employee -> employee.getSalary() <= 4000);`,
    choose: 'allMatch and noneMatch are both short-circuiting terminal operations. Choose the form that reads closest to the business rule. Both return true when there are no IT employees; add a separate existence condition if at least one employee is required.',
    check: 'check(allItOver4k);'
  }
];

const normalize = text => text.replace(/^Q:\s*/, '').replace(/\s+/g, ' ').trim();

function organizeStreamQuestions(doc) {
  const body = doc.querySelector('.note-body');
  const supplement = doc.querySelector('#stream-interview-additions');
  const keep = ['Imports & Model', 'Filtering & Sorting', 'Matching & Finding', 'Grouping',
    'Partitioning', 'Counting Frequencies', 'Aggregation & Statistics', 'Mapping & Collecting to Map',
    'String Operations', 'CompletableFuture'];
  const sections = [];
  const intro = [];
  let current;
  for (const child of [...body.children]) {
    if (child.tagName === 'H2') {
      current = { title: child.textContent.trim(), heading: child, nodes: [] };
      sections.push(current);
    } else if (current) current.nodes.push(child);
    else intro.push(child);
  }
  const grouped = new Map(sections.filter(section => keep.includes(section.title)).map(section => [section.title, section]));
  const blocks = nodes => {
    const result = []; let block;
    for (const node of nodes) {
      if (node.matches('p') && node.querySelector('b')?.textContent.trim().startsWith('Q:')) {
        block = { question: normalize(node.querySelector('b').textContent), nodes: [] }; result.push(block);
      }
      if (block) block.nodes.push(node);
    }
    return result;
  };
  const destinations = {
    'FlatMap & Transformations': ['Counting Frequencies', 'Grouping', 'Mapping & Collecting to Map', 'Filtering & Sorting'],
    'Comparisons & Rankings': ['Filtering & Sorting', 'Filtering & Sorting', 'Matching & Finding', 'Counting Frequencies', 'Grouping'],
    'Advanced': ['Partitioning', 'Grouping']
  };
  for (const section of sections.filter(section => !keep.includes(section.title))) {
    blocks(section.nodes).forEach((block, index) => {
      const destination = destinations[section.title]?.[index] || 'Grouping';
      grouped.get(destination).nodes.push(...block.nodes);
    });
  }
  if (supplement) {
    const destinations = {
      'Count word frequency in a sentence': 'Counting Frequencies',
      'Find the first repeated character': 'Counting Frequencies',
      'Find maximum and minimum elements': 'Aggregation & Statistics',
      'Find the top 3 highest salaries': 'Filtering & Sorting',
      'Find the Nth highest salary': 'Filtering & Sorting',
      'Convert List<Employee> into Map<Id, Employee>': 'Mapping & Collecting to Map',
      'Find all employees whose names start with a given character': 'Filtering & Sorting',
      'Find the longest string in a list': 'Matching & Finding',
      'Find common elements between two lists': 'Filtering & Sorting',
      'Calculate salary sum and average together': 'Aggregation & Statistics',
      'Remove duplicate elements using Streams': 'Mapping & Collecting to Map',
      'Count character frequency in a string': 'Counting Frequencies'
    };
    for (const heading of [...supplement.querySelectorAll(':scope > h3')]) {
      const question = heading.textContent.trim();
      const destination = destinations[question];
      if (!destination) throw new Error(`Missing Stream topic: ${question}`);
      const paragraph = doc.createElement('p'); paragraph.dataset.streamAddedQuestion = question;
      const title = doc.createElement('b'); title.textContent = `Q: ${question}`; paragraph.append(title);
      const nodes = [paragraph];
      let next = heading.nextElementSibling;
      while (next && next.tagName !== 'H3') { nodes.push(next); next = next.nextElementSibling; }
      grouped.get(destination).nodes.push(...nodes);
    }
    supplement.remove();
  }
  const assumptions = doc.createElement('p');
  assumptions.textContent = 'Examples assume non-null collections and elements unless stated otherwise. Salary rankings use distinct salary values when the question asks for a salary rank.';
  body.replaceChildren(...intro, assumptions, ...keep.flatMap(title => {
    const section = grouped.get(title);
    return section ? [section.heading, ...section.nodes] : [];
  }));
}

export function addStreamApproaches(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelector('#stream-alternatives')?.remove();
  organizeStreamQuestions(doc);
  const questions = [...doc.querySelectorAll('p > b')];
  const anchors = new Map(questions.map(element => [normalize(element.textContent), element.closest('p') || element]));
  const inserted = new Map();
  for (const approach of streamApproaches) {
    const anchor = anchors.get(approach.question);
    if (!anchor) throw new Error(`Stream question not found: ${approach.question}`);
    let code = anchor.nextElementSibling;
    while (code && code.tagName !== 'PRE' && !/^H[1-3]$/.test(code.tagName)) code = code.nextElementSibling;
    if (!code || code.tagName !== 'PRE') throw new Error(`Main snippet not found: ${approach.question}`);
    if (!inserted.has(anchor)) inserted.set(anchor, code);
    const section = doc.createElement('div'); section.className = 'stream-alternative';
    section.dataset.question = approach.question;
    const title = doc.createElement('p'); title.className = 'stream-alternative-label';
    const alternative = doc.createElement('strong'); alternative.textContent = 'Alternative: ';
    title.append(alternative, doc.createTextNode(approach.title));
    const pre = doc.createElement('pre'), snippet = doc.createElement('code'); snippet.textContent = approach.code;
    pre.append(snippet);
    const choice = doc.createElement('p'); const label = doc.createElement('strong'); label.textContent = 'When to choose: ';
    choice.append(label, doc.createTextNode(approach.choose)); section.append(title, pre, choice);
    inserted.get(anchor).after(section); inserted.set(anchor, section);
  }
  return doc.body.innerHTML;
}
