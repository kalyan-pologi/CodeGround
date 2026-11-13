package com.reidy.appraisal.provider;

import com.reidy.appraisal.dto.NormalizedAppraisal;
import com.reidy.appraisal.mapper.ValuationNormalizer;
import com.reidy.contracts.dto.PropertySnapshot;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.stereotype.Component;

// The formula demonstrates provider selection and normalized output; its values are educational
// examples rather than market estimates.
//
// Produces deterministic residential valuations for learning without claiming market accuracy.
@Component
public class MockResidentialValuationProvider implements ValuationProvider {
    private final ValuationNormalizer normalizer;

    public MockResidentialValuationProvider(ValuationNormalizer n) {
        normalizer = n;
    }

    public NormalizedAppraisal value(PropertySnapshot p) {
        var value =
                normalizer.dollars(
                        BigDecimal.valueOf(p.squareFootage()).multiply(new BigDecimal("180")));
        return new NormalizedAppraisal(
                value,
                value.add(new BigDecimal("25000")),
                null,
                null,
                null,
                null,
                null,
                new BigDecimal("15000"),
                new BigDecimal("25000"),
                List.of());
    }
}
