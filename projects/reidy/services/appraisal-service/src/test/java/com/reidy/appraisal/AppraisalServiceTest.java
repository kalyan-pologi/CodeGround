package com.reidy.appraisal;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.reidy.appraisal.repository.*;
import com.reidy.appraisal.service.*;
import com.reidy.contracts.dto.PropertySnapshot;
import com.reidy.contracts.model.PropertyType;
import com.reidy.platform.exception.ApiException;
import com.reidy.platform.provider.PropertyClient;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

// Purchase replay checks protect the business guarantee that a repeated key cannot create another
// report or debit.
//
// Verifies billing consistency and replay availability when the remote property service later
// becomes unavailable.
// Testing: start a Spring application context so configuration, proxies and persistence can
// participate; this is broader than an isolated unit test.
@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:h2:mem:appraisaltest;DB_CLOSE_DELAY=-1",
            "spring.jpa.hibernate.ddl-auto=create-drop",
            "app.kafka.enabled=false",
            "app.kafka.create-topics=false"
        })
class AppraisalServiceTest {
    @MockitoBean PropertyClient properties;
    @Autowired PaidAppraisalService paid;
    @Autowired FreeAppraisalService free;
    @Autowired CreditAccountRepository accounts;
    @Autowired AppraisalHistoryRepository history;

    @Test
    void paidReplayAndFreeReadSurvivePropertyServiceFailure() {
        var snapshot =
                new PropertySnapshot(
                        42L,
                        "10 Synthetic Ave",
                        "Chicago",
                        "IL",
                        "60601",
                        PropertyType.RESIDENTIAL,
                        2,
                        new BigDecimal("1"),
                        1200,
                        2000,
                        new BigDecimal("250000"),
                        Instant.now(),
                        Instant.now(),
                        0L);
        when(properties.get(42)).thenReturn(snapshot);
        int balance = accounts.findById(1L).orElseThrow().balance;
        var key = UUID.randomUUID().toString();
        var report = paid.appraise(42, key);
        assertEquals(balance - 1, accounts.findById(1L).orElseThrow().balance);
        reset(properties);
        when(properties.get(42)).thenThrow(new IllegalStateException("remote unavailable"));
        assertEquals(report, paid.appraise(42, key));
        assertEquals(report.valuation(), free.retrieve(42).valuation());
        verify(properties, never()).get(42);
        assertThrows(ApiException.class, () -> paid.appraise(43, key));
        assertEquals(snapshot.id(), history.findById(report.reportId()).orElseThrow().propertyId);
    }
}
