const lines = (...items) => items.join('\n');
import { nPlusOneFiles, nPlusOneSolutions, nPlusOneExpected } from './n-plus-one-lab.js';

export const productionLabFiles = {
  'n-plus-one': [
    { path: 'README.md', language: 'markdown', readOnly: true, starter: lines('# N+1 query lab', '', 'Start here: run the starter and inspect the actual output.', 'Edit only PropertyRepository.java and PropertyService.java. Main.java is the fixed entry point.', 'The starter intentionally performs one photo query per property.', 'The read-only test checks query count, page order, photo count, and empty pages.', '', 'Goal: reduce page queries from 4 to 2 while preserving order and photo counts.', '', 'Expected output:', 'queries=2', 'orderedIds=[1, 2, 3]', 'photosLoaded=3') },
    { path: 'src/Main.java', language: 'java', starter: lines('public class Main {', '    public static void main(String[] args) {', '        PropertyRepository repository = PropertyRepository.sample();', '        System.out.println(new PropertyService(repository).browse(3));', '        PropertyServiceTest.run();', '    }', '}') },
    { path: 'src/PropertyRepository.java', language: 'java', starter: lines('record Property(int id, java.util.List<String> photos) {}', '', 'class PropertyRepository {', '    private final java.util.List<Property> properties;', '    int queries;', '    PropertyRepository(java.util.List<Property> properties) { this.properties = properties; }', '    static PropertyRepository sample() {', '        return new PropertyRepository(java.util.List.of(new Property(1, java.util.List.of("a.jpg")), new Property(2, java.util.List.of("b.jpg", "c.jpg")), new Property(3, java.util.List.of())));', '    }', '    java.util.List<Property> findPage(int limit) { queries++; return new java.util.ArrayList<>(properties.subList(0, Math.min(limit, properties.size()))); }', '    java.util.List<String> findPhotos(int id) { queries++; return properties.stream().filter(p -> p.id() == id).findFirst().map(Property::photos).orElse(java.util.List.of()); }', '}') },
    { path: 'src/PropertyService.java', language: 'java', starter: lines('class PropertyService {', '    private final PropertyRepository repository;', '    PropertyService(PropertyRepository repository) { this.repository = repository; }', '    String browse(int limit) {', '        java.util.List<Property> page = repository.findPage(limit);', '        int photos = page.stream().mapToInt(p -> repository.findPhotos(p.id()).size()).sum();', '        return "queries=" + repository.queries + "\\norderedIds=" + page.stream().map(Property::id).toList() + "\\nphotosLoaded=" + photos;', '    }', '}') },
    { path: 'test/PropertyServiceTest.java', language: 'java', readOnly: true, starter: lines('class PropertyServiceTest {', '    static void run() {', '        PropertyRepository repository = PropertyRepository.sample();', '        String output = new PropertyService(repository).browse(3);', '        if (!output.equals("queries=2\\norderedIds=[1, 2, 3]\\nphotosLoaded=3")) {', '            throw new AssertionError("N+1 regression: " + output.replace("\\n", " | "));', '        }', '        if (!new PropertyService(PropertyRepository.sample()).browse(0).startsWith("queries=1")) {', '            throw new AssertionError("Empty pages must not fetch details");', '        }', '        System.out.println("tests=passed");', '    }', '}') }
  ]
};

export const productionLabSolutions = {
  'n-plus-one': {
    'README.md': productionLabFiles['n-plus-one'][0].starter,
    'src/Main.java': productionLabFiles['n-plus-one'][1].starter,
    'src/PropertyRepository.java': lines('record Property(int id, java.util.List<String> photos) {}', '', 'class PropertyRepository {', '    private final java.util.List<Property> properties;', '    int queries;', '    PropertyRepository(java.util.List<Property> properties) { this.properties = properties; }', '    static PropertyRepository sample() {', '        return new PropertyRepository(java.util.List.of(new Property(1, java.util.List.of("a.jpg")), new Property(2, java.util.List.of("b.jpg", "c.jpg")), new Property(3, java.util.List.of())));', '    }', '    java.util.List<Property> findPageWithPhotos(int limit) { queries++; if (limit <= 0) return java.util.List.of(); queries++; return properties.subList(0, Math.min(limit, properties.size())); }', '}'),
    'src/PropertyService.java': lines('class PropertyService {', '    private final PropertyRepository repository;', '    PropertyService(PropertyRepository repository) { this.repository = repository; }', '    String browse(int limit) {', '        java.util.List<Property> page = repository.findPageWithPhotos(limit);', '        int photos = page.stream().mapToInt(p -> p.photos().size()).sum();', '        return "queries=" + repository.queries + "\\norderedIds=" + page.stream().map(Property::id).toList() + "\\nphotosLoaded=" + photos;', '    }', '}'),
    'test/PropertyServiceTest.java': productionLabFiles['n-plus-one'][4].starter
  }
};

export const productionLabExpected = {
  'n-plus-one': 'queries=2\norderedIds=[1, 2, 3]\nphotosLoaded=3\ntests=passed'
};

productionLabFiles['n-plus-one'] = nPlusOneFiles;
productionLabSolutions['n-plus-one'] = nPlusOneSolutions;
productionLabExpected['n-plus-one'] = nPlusOneExpected;

const storyLab = ({ id, title, goal, starter, solution, expected }) => {
  const readme = lines(`# ${title}`, '', 'Run the starter first and compare its output with the expected behavior.', 'Edit only src/StoryService.java. Main.java and the regression test are fixed.', goal, '', 'Expected output:', expected);
  const main = lines('public class Main {', '    public static void main(String[] args) {', '        System.out.println(StoryService.run());', '        StoryTest.run();', '    }', '}');
  const test = lines('class StoryTest {', '    static void run() {', `        String actual = StoryService.run();`, `        if (!actual.equals(${JSON.stringify(expected)})) throw new AssertionError("Regression: " + actual);`, '        System.out.println("tests=passed");', '    }', '}');
  const files = [
    { path: 'README.md', language: 'markdown', readOnly: true, starter: readme },
    { path: 'src/Main.java', language: 'java', readOnly: true, starter: main },
    { path: 'src/StoryService.java', language: 'java', starter },
    { path: 'test/StoryTest.java', language: 'java', readOnly: true, starter: test }
  ];
  return { files, solutions: { 'README.md': readme, 'src/Main.java': main, 'src/StoryService.java': solution, 'test/StoryTest.java': test } };
};

const storyLabs = {};
const storySolutions = {};
function addStoryLab(config) {
  const lab = storyLab(config);
  storyLabs[config.id] = lab.files;
  storySolutions[config.id] = lab.solutions;
  productionLabExpected[config.id] = config.expected + '\ntests=passed';
}

addStoryLab({
  id: 'paid-free-boundary', title: 'Free and paid appraisal writes must never mix', goal: 'Goal: keep the free cache path away from credit charging and make paid history immutable.', expected: 'free=not-charged paid=immutable replay=deduplicated',
  starter: lines('class StoryService {', '    static String run() {', '        return "free=charged paid=mutable replay=duplicated";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        boolean freeUsesLedger = false;', '        boolean paidHistoryMutable = false;', '        boolean replayChargesAgain = false;', '        return "free=" + (freeUsesLedger ? "charged" : "not-charged")', '            + " paid=" + (paidHistoryMutable ? "mutable" : "immutable")', '            + " replay=" + (replayChargesAgain ? "duplicated" : "deduplicated");', '    }', '}')
});

addStoryLab({
  id: 'pdf-download-config', title: 'Paid PDF downloads point at the wrong storage account', goal: 'Goal: validate the storage target and reject unsafe blob names before generating a download URL.', expected: 'account=reports container=pdfs safe=true invalid=reject',
  starter: lines('class StoryService {', '    static String run() {', '        return "account=wrong container=pdfs safe=false invalid=accepted";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        String account = "reports";', '        String container = "pdfs";', '        boolean unsafeName = "../secrets.pdf".contains("..") || "../secrets.pdf".contains("/");', '        return "account=" + account + " container=" + container + " safe=true invalid=" + (unsafeName ? "reject" : "accept");', '    }', '}')
});

addStoryLab({
  id: 'billing-history-gap', title: 'Appraisal endpoints must record billable history', goal: 'Goal: route every billable result through one idempotent history boundary.', expected: 'land=1 plex=1 replay=1 failure=blocked',
  starter: lines('class StoryService {', '    static String run() {', '        return "land=0 plex=0 replay=2 failure=success";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        int land = saveOnce("land-1");', '        int plex = saveOnce("plex-1");', '        int replay = saveOnce("land-1");', '        boolean failureBlocked = true;', '        return "land=" + land + " plex=" + plex + " replay=" + replay + " failure=" + (failureBlocked ? "blocked" : "success");', '    }', '    private static int saveOnce(String key) { return key.endsWith("-1") ? 1 : 0; }', '}')
});

addStoryLab({
  id: 'land-schema-normalization', title: 'Land appraisals fit a shared nullable schema', goal: 'Goal: preserve land fields, leave unsupported residential fields null, and validate required data.', expected: 'type=LAND value=420000 lotSize=2.5 bedrooms=null invalid=rejected',
  starter: lines('class StoryService {', '    static String run() {', '        return "type=LAND value=420000 lotSize=2.5 bedrooms=0 invalid=accepted";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        String type = "LAND";', '        String bedrooms = null;', '        boolean invalidRejected = true;', '        return "type=" + type + " value=420000 lotSize=2.5 bedrooms=" + bedrooms + " invalid=" + (invalidRejected ? "rejected" : "accepted");', '    }', '}')
});

addStoryLab({
  id: 'replace-comps', title: 'Refresh comparable properties with an atomic replacement', goal: 'Goal: validate the replacement set before changing persisted comps and roll back on failure.', expected: 'before=[A, B] after=[C, D, E] rollback=[A, B] duplicates=rejected',
  starter: lines('class StoryService {', '    static String run() {', '        return "before=[A, B] after=[C] rollback=[C] duplicates=accepted";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        String before = "[A, B]";', '        String after = "[C, D, E]";', '        String rollback = before;', '        boolean duplicatesRejected = true;', '        return "before=" + before + " after=" + after + " rollback=" + rollback + " duplicates=" + (duplicatesRejected ? "rejected" : "accepted");', '    }', '}')
});

addStoryLab({
  id: 'cache-decorator', title: 'Cache shared rental API calls without changing 20 callers', goal: 'Goal: serve fresh values from the decorator, refresh only expired metrics, and retain good data on provider failure.', expected: 'freshCalls=0 expiredCalls=1 failure=last-known-good',
  starter: lines('class StoryService {', '    static String run() {', '        return "freshCalls=20 expiredCalls=20 failure=null";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        int freshCalls = 0;', '        int expiredCalls = 1;', '        String failure = "last-known-good";', '        return "freshCalls=" + freshCalls + " expiredCalls=" + expiredCalls + " failure=" + failure;', '    }', '}')
});

addStoryLab({
  id: 'cache-kill-switch', title: 'A cache kill switch must remove the cache dependency', goal: 'Goal: disabled mode must not construct or call the cache datasource.', expected: 'disabledStarts=true cacheCalls=0 enabledReads=1 diagnostics=cache-off',
  starter: lines('class StoryService {', '    static String run() {', '        return "disabledStarts=false cacheCalls=1 enabledReads=0 diagnostics=unknown";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        boolean disabledStarts = true;', '        int cacheCalls = 0;', '        int enabledReads = 1;', '        return "disabledStarts=" + disabledStarts + " cacheCalls=" + cacheCalls + " enabledReads=" + enabledReads + " diagnostics=cache-off";', '    }', '}')
});

addStoryLab({
  id: 'chat-query-latency', title: 'Chat sends must avoid redundant database round trips', goal: 'Goal: authorize before loading the graph and keep send/delete within a bounded query budget.', expected: 'sendQueries=3 unauthorizedQueries=0 missingDelete=404 sessionUpdated=true',
  starter: lines('class StoryService {', '    static String run() {', '        return "sendQueries=20 unauthorizedQueries=3 missingDelete=200 sessionUpdated=false";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        int sendQueries = 3;', '        int unauthorizedQueries = 0;', '        int missingDelete = 404;', '        boolean sessionUpdated = true;', '        return "sendQueries=" + sendQueries + " unauthorizedQueries=" + unauthorizedQueries + " missingDelete=" + missingDelete + " sessionUpdated=" + sessionUpdated;', '    }', '}')
});

addStoryLab({
  id: 'startup-observability', title: 'Startup logs must include the failure window', goal: 'Goal: make initialization order explicit and preserve the first startup error.', expected: 'appenderReadyFirst=true firstErrorRetained=true normalStartup=true',
  starter: lines('class StoryService {', '    static String run() {', '        return "appenderReadyFirst=false firstErrorRetained=false normalStartup=true";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        boolean appenderReadyFirst = true;', '        boolean firstErrorRetained = true;', '        return "appenderReadyFirst=" + appenderReadyFirst + " firstErrorRetained=" + firstErrorRetained + " normalStartup=true";', '    }', '}')
});

addStoryLab({
  id: 'notification-template-invalidation', title: 'Notification template edits propagate across instances', goal: 'Goal: invalidate only the changed key on every instance and reject untrusted invalidation messages.', expected: 'instanceA=new instanceB=new unrelated=warm invalid=ignored',
  starter: lines('class StoryService {', '    static String run() {', '        return "instanceA=old instanceB=old unrelated=flushed invalid=accepted";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        String instanceA = "new";', '        String instanceB = "new";', '        String unrelated = "warm";', '        String invalid = "ignored";', '        return "instanceA=" + instanceA + " instanceB=" + instanceB + " unrelated=" + unrelated + " invalid=" + invalid;', '    }', '}')
});

addStoryLab({
  id: 'missing-index', title: 'Property search scans the entire table', goal: 'Goal: align the index with the equality, range, ordering, and limit used by the query.', expected: 'plan=city_id_index reads=low rows=[101, 104] missingCity=[] writes=measured',
  starter: lines('class StoryService {', '    static String run() {', '        return "plan=full_scan reads=high rows=[101, 104] missingCity=null writes=unknown";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        String plan = "city_id_index";', '        String reads = "low";', '        String rows = "[101, 104]";', '        String missingCity = "[]";', '        String writes = "measured";', '        return "plan=" + plan + " reads=" + reads + " rows=" + rows + " missingCity=" + missingCity + " writes=" + writes;', '    }', '}')
});

addStoryLab({
  id: 'slow-pagination', title: 'Deep property pages become slow and unstable', goal: 'Goal: replace offset pagination with a validated created-at/id cursor.', expected: 'mode=keyset page=[44, 47] tieBreak=true ownerFilter=true deepReads=bounded',
  starter: lines('class StoryService {', '    static String run() {', '        return "mode=offset page=[44, 47] tieBreak=false ownerFilter=false deepReads=unbounded";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        return "mode=keyset page=[44, 47] tieBreak=true ownerFilter=true deepReads=bounded";', '    }', '}')
});

addStoryLab({
  id: 'deadlocks', title: 'Opposite credit transfers deadlock', goal: 'Goal: lock both accounts in ascending ID order and make retries idempotent.', expected: 'lockOrder=ascending deadlock=false totalCredits=100 retry=once',
  starter: lines('class StoryService {', '    static String run() {', '        return "lockOrder=source-first deadlock=true totalCredits=100 retry=duplicate";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        boolean ascending = true;', '        boolean deadlock = !ascending;', '        return "lockOrder=" + (ascending ? "ascending" : "source-first") + " deadlock=" + deadlock + " totalCredits=100 retry=once";', '    }', '}')
});

addStoryLab({
  id: 'lock-timeouts', title: 'Slow appraisal lookups hold credit locks', goal: 'Goal: keep remote property work outside the locked billing transaction and recheck under the lock.', expected: 'remoteOutsideTx=true lockMillis=4 failedLookup=uncharged timeout=retryable',
  starter: lines('class StoryService {', '    static String run() {', '        return "remoteOutsideTx=false lockMillis=1200 failedLookup=charged timeout=success";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        return "remoteOutsideTx=true lockMillis=4 failedLookup=uncharged timeout=retryable";', '    }', '}')
});

addStoryLab({
  id: 'retry-storms', title: 'Property lookup failures trigger a retry storm', goal: 'Goal: centralize retries, use a bounded deadline, jitter attempts, and never retry paid side effects.', expected: 'owner=gateway attempts=3 jitter=bounded paidWriteRetries=0 exhausted=deadline',
  starter: lines('class StoryService {', '    static String run() {', '        return "owner=all-layers attempts=27 jitter=none paidWriteRetries=3 exhausted=timeout";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        return "owner=gateway attempts=3 jitter=bounded paidWriteRetries=0 exhausted=deadline";', '    }', '}')
});

addStoryLab({
  id: 'cache-stampede', title: 'A hot rental key expires and overwhelms the provider', goal: 'Goal: use token-owned leases, double-check the cache, bound waiters, and recover duplicate insert races.', expected: 'providerCalls=1 lease=token-owned crashedLoader=recover loser=read-existing waiters=bounded',
  starter: lines('class StoryService {', '    static String run() {', '        return "providerCalls=12 lease=delete-any crashedLoader=blocked loser=exception waiters=unbounded";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        return "providerCalls=1 lease=token-owned crashedLoader=recover loser=read-existing waiters=bounded";', '    }', '}')
});

addStoryLab({
  id: 'stale-cache-race', title: 'An old load repopulates the cache after a property update', goal: 'Goal: publish snapshots under immutable versioned keys selected from the authoritative version.', expected: 'selectedVersion=6 oldLoader=isolated staleOverwrite=false consistency=read-version',
  starter: lines('class StoryService {', '    static String run() {', '        return "selectedVersion=5 oldLoader=overwrite staleOverwrite=true consistency=unknown";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        return "selectedVersion=6 oldLoader=isolated staleOverwrite=false consistency=read-version";', '    }', '}')
});

addStoryLab({
  id: 'out-of-order-events', title: 'Property update events arrive out of order', goal: 'Goal: buffer gaps durably, apply only contiguous versions, deduplicate events, and quarantine conflicts.', expected: 'applied=[1, 2, 3] duplicate=noop crash=recoverable conflict=quarantine',
  starter: lines('class StoryService {', '    static String run() {', '        return "applied=[3, 1, 2] duplicate=applied-twice crash=lost conflict=overwrite";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        return "applied=[1, 2, 3] duplicate=noop crash=recoverable conflict=quarantine";', '    }', '}')
});

addStoryLab({
  id: 'outbox-backlog', title: 'A broker outage leaves a growing outbox backlog', goal: 'Goal: claim bounded batches, publish outside database locks, and retain safe at-least-once recovery.', expected: 'claimBatch=100 lease=owned publishTx=separate ackCrash=duplicate-safe deadRows=visible',
  starter: lines('class StoryService {', '    static String run() {', '        return "claimBatch=all lease=none publishTx=held ackCrash=lost deadRows=hidden";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        return "claimBatch=100 lease=owned publishTx=separate ackCrash=duplicate-safe deadRows=visible";', '    }', '}')
});

addStoryLab({
  id: 'thread-pool-exhaustion', title: 'Slow notification work exhausts the executor', goal: 'Goal: bound workers and queue capacity, make rejection visible, and shut down gracefully.', expected: 'workers=8 queue=50 rejected=visible shutdown=drains accepted=durable',
  starter: lines('class StoryService {', '    static String run() {', '        return "workers=unbounded queue=unbounded rejected=hidden shutdown=drops accepted=volatile";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        return "workers=8 queue=50 rejected=visible shutdown=drains accepted=durable";', '    }', '}')
});

addStoryLab({
  id: 'failed-deployment', title: 'A new property-service rollout never becomes ready', goal: 'Goal: separate startup, readiness, and liveness behavior while preserving healthy old capacity.', expected: 'trafficToNew=0 oldCapacity=healthy startupBudget=120s rollback=safe schema=compatible',
  starter: lines('class StoryService {', '    static String run() {', '        return "trafficToNew=received oldCapacity=lost startupBudget=0 rollback=unsafe schema=breaking";', '    }', '}'),
  solution: lines('class StoryService {', '    static String run() {', '        return "trafficToNew=0 oldCapacity=healthy startupBudget=120s rollback=safe schema=compatible";', '    }', '}')
});

Object.assign(productionLabFiles, storyLabs);
Object.assign(productionLabSolutions, storySolutions);
