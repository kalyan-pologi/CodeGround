package com.reidy.property.dto;

import com.reidy.contracts.model.PropertyType;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;

// Validation annotations apply when controllers use Valid; the record carries input data without
// persistence behavior.
//
// Validates incoming property fields before the service performs database writes.
// Java records generate component accessors, equals, hashCode and toString; final component
// references do not imply deep immutability.
public record PropertyRequest(
        @NotBlank @Size(max = 200) String address,
        @NotBlank @Size(max = 100) String city,
        @NotBlank @Pattern(regexp = "[A-Z]{2}") String state,
        @NotBlank @Pattern(regexp = "[0-9]{5}(-[0-9]{4})?") String zipCode,
        @NotNull PropertyType propertyType,
        @PositiveOrZero Integer bedrooms,
        @PositiveOrZero BigDecimal bathrooms,
        @NotNull @Positive Integer squareFootage,
        @Min(1600) @Max(2100) Integer yearBuilt,
        @NotNull @Positive BigDecimal askingPrice) {}
