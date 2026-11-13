package com.reidy.appraisal.mapper;

import java.math.*;
import org.springframework.stereotype.Component;

// Rounding is centralized so providers use the same monetary precision instead of relying on
// implicit decimal behavior.
//
// Converts supported valuation amounts and percentage adjustments using explicit decimal rounding.
@Component
public class ValuationNormalizer {
    public BigDecimal dollars(BigDecimal value) {
        // Java: BigDecimal is immutable; setScale returns a value with explicit rounding rather
        // than changing the input.
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    public BigDecimal percentageAdjustment(BigDecimal source, BigDecimal percent) {
        return source == null || percent == null
                ? null
                // Decimal arithmetic: moving left two places converts a percent such as 5 into a
                // multiplier of 0.05 before rounding dollars.
                : dollars(source.multiply(percent).movePointLeft(2));
    }
}
