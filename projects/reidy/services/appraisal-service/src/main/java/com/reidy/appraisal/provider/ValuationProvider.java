package com.reidy.appraisal.provider;

import com.reidy.appraisal.dto.NormalizedAppraisal;
import com.reidy.contracts.dto.PropertySnapshot;

// Different property categories implement one valuation contract; orchestration selects the
// suitable provider.
//
// Separates valuation generation from billing, report persistence, and HTTP handling.
public interface ValuationProvider {
    NormalizedAppraisal value(PropertySnapshot property);
}
