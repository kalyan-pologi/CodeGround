package com.reidy.appraisal.dto;

import java.time.Instant;

// The response distinguishes purchased history from reusable cache results while carrying the same
// normalized valuation shape.
//
// Returns valuation data together with its source, property reference, and valuation timestamp.
// Java records generate component accessors, equals, hashCode and toString; final component
// references do not imply deep immutability.
public record AppraisalResponse(
        Long reportId,
        Long propertyId,
        String source,
        Instant valuedAt,
        NormalizedAppraisal valuation) {}
