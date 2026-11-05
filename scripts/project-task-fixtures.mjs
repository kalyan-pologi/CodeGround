export const jdbcChecks = `import java.math.BigDecimal;
import java.sql.*;
import java.util.*;
import org.h2.jdbcx.JdbcDataSource;
public class JdbcChecks {
    static void check(boolean condition) { if (!condition) throw new AssertionError("JDBC acceptance failure"); }
    public static void main(String[] args) throws Exception {
        JdbcDataSource source = new JdbcDataSource();
        source.setURL("jdbc:h2:mem:property_exercise;DB_CLOSE_DELAY=-1");
        try (Connection connection = source.getConnection(); Statement statement = connection.createStatement()) {
            statement.execute("create table properties(id bigint primary key, city varchar(200), price decimal(19,2))");
        }
        PropertyJdbcAdapter adapter = new PropertyJdbcAdapter(source);
        adapter.insertAll(List.of(new PropertyRow(3, "Chicago", new BigDecimal("300000")),
            new PropertyRow(1, "Chicago", new BigDecimal("250000")),
            new PropertyRow(2, "Austin", new BigDecimal("200000"))));
        check(adapter.findAfter(" chicago ", new BigDecimal("300000"), 0, 1).get(0).id() == 1);
        check(adapter.findAfter("Chicago", new BigDecimal("300000"), 1, 10).get(0).id() == 3);
        check(adapter.findAfter("Chicago' OR 1=1 --", new BigDecimal("999999"), 0, 10).isEmpty());
        try {
            adapter.insertAll(List.of(new PropertyRow(4, "Chicago", BigDecimal.TEN), new PropertyRow(3, "Chicago", BigDecimal.TEN)));
            throw new AssertionError("Expected duplicate primary key");
        } catch (SQLException expected) { }
        try (Connection connection = source.getConnection(); Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery("select count(*) from properties")) {
            rows.next(); check(rows.getInt(1) == 3);
        }
        check(adapter.updatePrice(1, new BigDecimal("250000"), new BigDecimal("260000")));
        check(!adapter.updatePrice(1, new BigDecimal("250000"), new BigDecimal("270000")));
        System.out.println("JDBC acceptance checks passed");
    }
}`;

export const junitChecks = `import org.junit.platform.engine.discovery.DiscoverySelectors;
import org.junit.platform.launcher.core.LauncherDiscoveryRequestBuilder;
import org.junit.platform.launcher.core.LauncherFactory;
import org.junit.platform.launcher.listeners.SummaryGeneratingListener;
public class JunitChecks {
    public static void main(String[] args) {
        var listener = new SummaryGeneratingListener();
        var launcher = LauncherFactory.create();
        launcher.registerTestExecutionListeners(listener);
        launcher.execute(LauncherDiscoveryRequestBuilder.request()
            .selectors(DiscoverySelectors.selectClass(args[0])).build());
        var summary = listener.getSummary();
        if (!summary.getFailures().isEmpty()) {
            Throwable cause = summary.getFailures().get(0).getException();
            while (cause.getCause() != null && cause.getCause() != cause) cause = cause.getCause();
            cause.printStackTrace();
            throw new AssertionError("JUnit failures: " + summary.getTotalFailureCount());
        }
        if (summary.getTestsSucceededCount() == 0) throw new AssertionError("No tests ran");
        System.out.println("JUnit checks passed: " + summary.getTestsSucceededCount());
    }
}`;

export const mvcConfiguration = `@org.springframework.boot.SpringBootConfiguration
@org.springframework.context.annotation.Import({PropertyController.class, PropertyErrors.class})
class ExerciseApplication {}`;
