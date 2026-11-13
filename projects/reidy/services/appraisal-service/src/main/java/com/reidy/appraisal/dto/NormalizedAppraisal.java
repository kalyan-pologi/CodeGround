package com.reidy.appraisal.dto;

import java.math.BigDecimal;
import java.util.List;

// Provider-specific results converge on this structure so API consumers do not need separate
// response formats for each provider.
//
// Provides one response shape while leaving unavailable engine-specific valuation fields null.
// Java records generate component accessors, equals, hashCode and toString; final component
// references do not imply deep immutability.
public record NormalizedAppraisal(
        BigDecimal asIsValue,
        BigDecimal afterRepairValue,
        BigDecimal salesComparisonValue,
        BigDecimal costApproachValue,
        BigDecimal incomeApproachValue,
        BigDecimal netOperatingIncome,
        BigDecimal capitalizationRate,
        BigDecimal rehabilitationCostLow,
        BigDecimal rehabilitationCostHigh,
        List<ComparableAdjustment> comparables) {
    public record ComparableAdjustment(
            String reference, BigDecimal sourceValue, BigDecimal dollarAdjustment) {}
}
