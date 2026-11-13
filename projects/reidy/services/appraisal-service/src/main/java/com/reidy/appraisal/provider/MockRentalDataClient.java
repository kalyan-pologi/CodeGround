package com.reidy.appraisal.provider;

import com.reidy.appraisal.dto.RentalData;
import com.reidy.appraisal.dto.RentalEndpoint;
import io.micrometer.core.instrument.MeterRegistry;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.stereotype.Component;

// Synthetic results make the demo reproducible without paid credentials or a real rental-data
// dependency.
//
// Returns deterministic synthetic rental data so examples never require real analytics credentials.
@Component
public class MockRentalDataClient implements RentalDataClient {
    private final MeterRegistry metrics;

    public MockRentalDataClient(MeterRegistry metrics) {
        this.metrics = metrics;
    }

    public RentalData fetch(long propertyId, RentalEndpoint endpoint) {
        metrics.counter("rental.provider.calls", "endpoint", endpoint.name()).increment();
        BigDecimal rent = BigDecimal.valueOf(1500 + (propertyId % 20) * 50);
        return switch (endpoint) {
            case RENTAL_ESTIMATE -> new RentalData(endpoint, rent, null, List.of());
            case NEIGHBORHOOD_STATISTICS ->
                    new RentalData(endpoint, null, new BigDecimal("0.94"), List.of());
            case RENTAL_COMPARABLES ->
                    new RentalData(
                            endpoint,
                            null,
                            null,
                            List.of(
                                    new RentalData.RentalComparable("synthetic-rental-A", rent),
                                    new RentalData.RentalComparable(
                                            "synthetic-rental-B",
                                            rent.add(new BigDecimal("100")))));
        };
    }
}
