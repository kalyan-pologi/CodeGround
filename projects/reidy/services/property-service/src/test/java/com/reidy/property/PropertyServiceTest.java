package com.reidy.property;

import static org.junit.jupiter.api.Assertions.*;

import com.reidy.contracts.model.PropertyType;
import com.reidy.platform.repository.NotificationOutboxRepository;
import com.reidy.property.dto.PropertyRequest;
import com.reidy.property.service.PropertyService;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.support.TransactionTemplate;

// These checks exercise the database and event intent together, verifying that transaction rollback
// does not leave a publication behind.
//
// Checks owned property persistence and transactional publication without requiring a running
// broker.
// Testing: start a Spring application context so configuration, proxies and persistence can
// participate; this is broader than an isolated unit test.
@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:h2:mem:propertytest;DB_CLOSE_DELAY=-1",
            "spring.jpa.hibernate.ddl-auto=create-drop",
            "app.kafka.enabled=false",
            "app.kafka.create-topics=false"
        })
class PropertyServiceTest {
    @Autowired PropertyService properties;
    @Autowired NotificationOutboxRepository outbox;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;

    PropertyRequest request() {
        return new PropertyRequest(
                "10 Synthetic Ave",
                "Chicago",
                "IL",
                "60601",
                PropertyType.RESIDENTIAL,
                2,
                new BigDecimal("1"),
                1200,
                2000,
                new BigDecimal("250000"));
    }

    @Test
    void createsSnapshotAndOutboxAtomically() {
        long before = outbox.count();
        var property = properties.create(request());
        assertEquals(property.id(), properties.get(property.id()).id());
        assertEquals(before + 1, outbox.count());
        var transaction = new TransactionTemplate(transactions);
        assertThrows(
                IllegalStateException.class,
                () ->
                        transaction.executeWithoutResult(
                                status -> {
                                    properties.create(request());
                                    throw new IllegalStateException("simulate rollback");
                                }));
        assertEquals(before + 1, outbox.count());
    }
}
