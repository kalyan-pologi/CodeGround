package com.reidy.appraisal.service;

import com.reidy.appraisal.dto.AppraisalResponse;

// Keeping free retrieval separate from paid purchasing makes the absence of billing side effects
// visible in the design.
//
// Defines cache-only appraisal retrieval so free behavior cannot accidentally invoke paid
// processing.
public interface FreeAppraisalService {
    AppraisalResponse retrieve(long propertyId);
}
