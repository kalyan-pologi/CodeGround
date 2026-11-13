package com.reidy.appraisal.dto;

import java.math.BigDecimal;
import java.util.List;

// Records provide accessors and value equality; nested collection contents still need separate
// consideration when reasoning about immutability.
//
// Transfers endpoint-specific rental results; decimal values avoid binary floating-point errors for
// money.
// Java records generate component accessors, equals, hashCode and toString; final component
// references do not imply deep immutability.
public record RentalData(
        // Identifies which resource supplied the fields present in this response.
        RentalEndpoint endpoint,
        // Decimal monetary values remain null when the endpoint does not provide rent.
        BigDecimal monthlyRent,
        // Stores a fraction such as 0.94 for ninety-four percent occupancy.
        BigDecimal occupancyRate,
        // A final list reference does not automatically make its contents immutable.
        List<RentalComparable> comparables) {
    // Groups each synthetic comparable reference with its monthly rental amount.
    public record RentalComparable(String reference, BigDecimal monthlyRent) {}
}
