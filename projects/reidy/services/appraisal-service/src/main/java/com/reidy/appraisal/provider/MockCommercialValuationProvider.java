package com.reidy.appraisal.provider;

import com.reidy.appraisal.dto.NormalizedAppraisal;
import com.reidy.appraisal.mapper.ValuationNormalizer;
import com.reidy.contracts.dto.PropertySnapshot;
import java.math.*;
import java.util.List;
import org.springframework.stereotype.Component;

// Commercial valuation uses a separate implementation so category-specific rules do not spread into
// the controller.
//
// Demonstrates sales, cost, and income valuation fields using explicit synthetic assumptions.
@Component
public class MockCommercialValuationProvider implements ValuationProvider {
    private final ValuationNormalizer normalizer;

    public MockCommercialValuationProvider(ValuationNormalizer n) {
        normalizer = n;
    }

    public NormalizedAppraisal value(PropertySnapshot p) {
        var sales =
                normalizer.dollars(
                        BigDecimal.valueOf(p.squareFootage()).multiply(new BigDecimal("220")));
        var noi =
                normalizer.dollars(
                        BigDecimal.valueOf(p.squareFootage()).multiply(new BigDecimal("16")));
        return new NormalizedAppraisal(
                null,
                null,
                sales,
                sales.multiply(new BigDecimal("1.10")),
                noi.divide(new BigDecimal("0.08"), 2, RoundingMode.HALF_UP),
                noi,
                new BigDecimal("0.08"),
                null,
                null,
                List.of(
                        new NormalizedAppraisal.ComparableAdjustment(
                                "synthetic-comparable",
                                sales,
                                normalizer.percentageAdjustment(sales, new BigDecimal("5")))));
    }
}
