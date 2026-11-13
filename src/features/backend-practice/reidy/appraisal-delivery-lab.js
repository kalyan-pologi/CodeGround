const readme = `# Task 12: paid PDF delivery and compatible land appraisals

Stories 2 and 5. A customer pays for a PDF but receives 404 because the download URL points to the wrong storage account. Separately, a land appraisal must fit the shared response model without inventing bedrooms, bathrooms, or ARV.

PDF path: bind one validated account/container configuration at startup. Check the report owner and stored blob reference first, validate the blob name, then ask a signer for a short-lived URL for that exact account/container. Do not concatenate a URL or expose credentials. The signer adapter must use the cloud SDK and the same account that holds the blob. Test wrong-account configuration separately from a genuinely missing blob.

Land path: validate required as-is value and lot size before persistence. Put LAND in the type discriminator, keep residential-only fields null, and preserve cross-type response compatibility. Zero means a real numeric zero, not "not applicable".

The Java checks cover correct storage target, invalid configuration, traversal-like names, owner rejection, land nullability, and no persistence after invalid input. In the real Reidy app, add integration tests against a storage emulator or test account and the SQL Server schema.

Interview explanation: "The PDFs existed, but the runtime configuration pointed signed downloads to a different storage account. I centralized and validated the account/container settings, verified the blob reference before signing, and added a configuration test. For land reports I used the shared schema with explicit nulls for fields that do not apply."`;

const storage = `import java.net.URI;
import java.time.Duration;

record PdfStorageSettings(String account, String container, Duration linkTtl) {
    PdfStorageSettings {
        if (account == null || !account.matches("[a-z0-9]{3,24}")
                || container == null || !container.matches("[a-z0-9-]{3,63}")
                || linkTtl == null || linkTtl.isZero() || linkTtl.isNegative()
                || linkTtl.compareTo(Duration.ofMinutes(30)) > 0)
            throw new IllegalArgumentException("Invalid PDF storage configuration");
    }
}

record StoredPdf(long reportId, long ownerId, String blobName) {}
interface PdfReportStore { StoredPdf find(long reportId); }
interface BlobSigner {
    boolean exists(String account, String container, String blobName);
    URI sign(String account, String container, String blobName, Duration ttl);
}`;

const pdfStarter = `import java.net.URI;

class PdfDeliveryService {
    PdfDeliveryService(PdfStorageSettings settings, PdfReportStore reports, BlobSigner signer) {
        // TODO: validate and keep one storage target.
    }
    URI download(long reportId, long requesterId) {
        // TODO: authorize, validate the stored name, verify existence, then sign.
        throw new UnsupportedOperationException("Implement Task 12 PDF path");
    }
}`;

const pdfSolution = `import java.net.URI;
import java.util.Objects;

class PdfDeliveryService {
    private final PdfStorageSettings settings;
    private final PdfReportStore reports;
    private final BlobSigner signer;

    PdfDeliveryService(PdfStorageSettings settings, PdfReportStore reports, BlobSigner signer) {
        this.settings = Objects.requireNonNull(settings); // Constructor validation fails startup.
        this.reports = Objects.requireNonNull(reports);
        this.signer = Objects.requireNonNull(signer);
    }

    URI download(long reportId, long requesterId) {
        if (reportId <= 0 || requesterId <= 0) throw new IllegalArgumentException("Invalid request");
        StoredPdf report = reports.find(reportId);
        if (report == null) throw new IllegalArgumentException("Report not found");
        if (report.ownerId() != requesterId) throw new SecurityException("Report access denied");
        String name = validBlobName(report.blobName());
        if (!signer.exists(settings.account(), settings.container(), name))
            throw new IllegalStateException("PDF missing from configured storage target");
        // The signer SDK encodes the blob path and signs it. Never build the SAS URL by hand.
        return signer.sign(settings.account(), settings.container(), name, settings.linkTtl());
    }

    private static String validBlobName(String name) {
        if (name == null || name.isBlank() || name.length() > 255 || name.contains("..")
                || name.contains("/") || name.indexOf((char) 92) >= 0 || !name.toLowerCase().endsWith(".pdf")
                || name.chars().anyMatch(Character::isISOControl))
            throw new IllegalArgumentException("Invalid stored PDF name");
        return name;
    }
}`;

const landStarter = `import java.math.BigDecimal;

enum PropertyType { RESIDENTIAL, LAND }
record LandInput(BigDecimal asIsValue, BigDecimal lotSizeAcres) {}
record NormalizedAppraisal(PropertyType type, BigDecimal asIsValue,
                           BigDecimal lotSizeAcres, Integer bedrooms,
                           Integer bathrooms, BigDecimal afterRepairValue) {}
interface AppraisalRecordStore { void save(NormalizedAppraisal result); }

class LandAppraisalService {
    LandAppraisalService(AppraisalRecordStore store) { }
    NormalizedAppraisal normalizeAndSave(LandInput input) {
        // TODO: validate required land values before saving.
        // TODO: keep residential-only fields null.
        throw new UnsupportedOperationException("Implement Task 12 land path");
    }
}`;

const landSolution = `import java.math.BigDecimal;
import java.util.Objects;

enum PropertyType { RESIDENTIAL, LAND }
record LandInput(BigDecimal asIsValue, BigDecimal lotSizeAcres) {}
record NormalizedAppraisal(PropertyType type, BigDecimal asIsValue,
                           BigDecimal lotSizeAcres, Integer bedrooms,
                           Integer bathrooms, BigDecimal afterRepairValue) {}
interface AppraisalRecordStore { void save(NormalizedAppraisal result); }

class LandAppraisalService {
    private final AppraisalRecordStore store;
    LandAppraisalService(AppraisalRecordStore store) { this.store = Objects.requireNonNull(store); }

    NormalizedAppraisal normalizeAndSave(LandInput input) {
        if (input == null || input.asIsValue() == null || input.lotSizeAcres() == null
                || input.asIsValue().signum() <= 0 || input.lotSizeAcres().signum() <= 0)
            throw new IllegalArgumentException("Land requires positive value and lot size");
        NormalizedAppraisal result = new NormalizedAppraisal(PropertyType.LAND,
            input.asIsValue(), input.lotSizeAcres(), null, null, null);
        store.save(result); // Nothing is persisted before validation succeeds.
        return result;
    }
}`;

const spring = `import java.time.Duration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration
class PdfDeliveryConfiguration {
    @Bean
    PdfStorageSettings pdfStorageSettings(Environment environment) {
        return new PdfStorageSettings(
            environment.getRequiredProperty("appraisal.pdf.account"),
            environment.getRequiredProperty("appraisal.pdf.container"),
            Duration.ofMinutes(environment.getRequiredProperty("appraisal.pdf.link-minutes", Integer.class)));
    }

    @Bean
    PdfDeliveryService pdfDeliveryService(PdfStorageSettings settings,
                                          PdfReportStore reports, BlobSigner signer) {
        return new PdfDeliveryService(settings, reports, signer);
    }
}`;

const config = `appraisal:
  pdf:
    account: reportsaccount
    container: paid-reports
    link-minutes: 10
# Supply signer credentials through the cloud identity or secret provider, not this file.`;

const checks = `import java.net.URI;
import java.math.BigDecimal;
import java.time.Duration;

class AppraisalDeliveryAcceptanceTest {
    static void run() {
        int[] signCalls = {0};
        BlobSigner signer = new BlobSigner() {
            public boolean exists(String account, String container, String name) {
                equal("reportsaccount", account);
                equal("paid-reports", container);
                equal("report-1.pdf", name);
                return true;
            }
            public URI sign(String account, String container, String name, Duration ttl) {
                signCalls[0]++;
                return URI.create("https://" + account + ".blob.core.windows.net/" + container + "/" + name);
            }
        };
        PdfReportStore reports = id -> new StoredPdf(1, 7, "report-1.pdf");
        PdfDeliveryService service = new PdfDeliveryService(
            new PdfStorageSettings("reportsaccount", "paid-reports", Duration.ofMinutes(10)), reports, signer);
        equal("reportsaccount.blob.core.windows.net", service.download(1, 7).getHost());
        expect(SecurityException.class, () -> service.download(1, 8));
        expect(IllegalArgumentException.class, () -> new PdfStorageSettings("", "paid-reports", Duration.ofMinutes(10)));
        PdfDeliveryService unsafe = new PdfDeliveryService(
            new PdfStorageSettings("reportsaccount", "paid-reports", Duration.ofMinutes(10)),
            id -> new StoredPdf(1, 7, "../private.pdf"), signer);
        expect(IllegalArgumentException.class, () -> unsafe.download(1, 7));
        equal(1, signCalls[0]);

        int[] saves = {0};
        LandAppraisalService land = new LandAppraisalService(result -> saves[0]++);
        NormalizedAppraisal normalized = land.normalizeAndSave(new LandInput(new BigDecimal("420000"), new BigDecimal("2.5")));
        equal(PropertyType.LAND, normalized.type());
        equal(null, normalized.bedrooms());
        equal(null, normalized.afterRepairValue());
        expect(IllegalArgumentException.class, () -> land.normalizeAndSave(new LandInput(null, BigDecimal.ONE)));
        equal(1, saves[0]);
        System.out.println("Task 12 delivery and land checks passed");
    }
    private static void equal(Object expected, Object actual) {
        if (!java.util.Objects.equals(expected, actual)) throw new AssertionError("Expected " + expected + ", got " + actual);
    }
    private static void expect(Class<? extends Throwable> type, Runnable action) {
        try { action.run(); throw new AssertionError("Expected " + type.getSimpleName()); }
        catch (Throwable failure) { if (!type.isInstance(failure)) throw new AssertionError(failure); }
    }
}`;

export function appraisalDeliveryLab() {
  const files = [
    { path: 'README.md', language: 'markdown', readOnly: true, starter: readme },
    { path: 'src/PdfStorageSettings.java', language: 'java', readOnly: true, starter: storage },
    { path: 'src/PdfDeliveryService.java', language: 'java', starter: pdfStarter },
    { path: 'src/LandAppraisalService.java', language: 'java', starter: landStarter },
    { path: 'src/PdfDeliveryConfiguration.java', language: 'java', readOnly: true, starter: spring },
    { path: 'config/application-test.yml', language: 'yaml', readOnly: true, starter: config },
    { path: 'test/AppraisalDeliveryAcceptanceTest.java', language: 'java', readOnly: true, starter: checks }
  ];
  return {
    runtime: 'project',
    expected: 'PDF downloads authorize the caller and sign the blob stored in the configured account and container. Unsafe names are rejected. Land appraisals validate required fields and preserve null for residential fields that do not apply.',
    files,
    fileSolutions: Object.fromEntries(files.map(file => [file.path,
      file.path === 'src/PdfDeliveryService.java' ? pdfSolution
        : file.path === 'src/LandAppraisalService.java' ? landSolution : file.starter])),
    explanation: [
      'A PDF 404 can be caused by a valid blob in a different storage account. Validate account and container at startup, then use the stored blob reference and a signer for that exact target.',
      'Authorize before signing, reject unsafe stored names, and distinguish a missing blob from misconfiguration. A signed URL should be short-lived and should not expose credentials.',
      'Land output keeps its required value and lot size while unsupported residential fields remain null. Validate first so an invalid land report cannot be partially saved.'
    ],
    executionNote: 'Task 12 includes runnable Java checks. Verify signed URLs with the configured storage account and land persistence with the Reidy integration environment.'
  };
}
