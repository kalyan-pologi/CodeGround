package com.reidy.appraisal.service;

import com.reidy.appraisal.dto.AppraisalResponse;

// Controllers depend on this interface, allowing orchestration to change without changing the
// endpoint contract.
//
// Defines the billed appraisal operation independently of its persistence implementation.
public interface PaidAppraisalService {
    AppraisalResponse appraise(long propertyId, String idempotencyKey);
}
