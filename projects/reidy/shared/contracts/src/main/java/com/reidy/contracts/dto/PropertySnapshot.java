package com.reidy.contracts.dto;

import com.reidy.contracts.model.PropertyType;
import java.math.BigDecimal;
import java.time.Instant;

// A value snapshot crosses the HTTP boundary without exposing JPA proxies or requiring another
// service to understand entity mappings.
//
// Carries immutable property data across HTTP without sharing database entities between services.
// Java records generate component accessors, equals, hashCode and toString; final component
// references do not imply deep immutability.
public record PropertySnapshot(
        Long id,
        String address,
        String city,
        String state,
        String zipCode,
        PropertyType propertyType,
        Integer bedrooms,
        BigDecimal bathrooms,
        Integer squareFootage,
        Integer yearBuilt,
        BigDecimal askingPrice,
        Instant createdAt,
        Instant updatedAt,
        Long version) {}
