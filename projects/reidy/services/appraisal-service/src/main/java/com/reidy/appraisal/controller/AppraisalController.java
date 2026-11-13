package com.reidy.appraisal.controller;

import com.reidy.appraisal.dto.AppraisalResponse;
import com.reidy.appraisal.service.FreeAppraisalService;
import com.reidy.appraisal.service.PaidAppraisalService;
import org.springframework.web.bind.annotation.*;

// The paid endpoint changes billing state; the free endpoint reads an existing cache entry without
// purchasing a report.
//
// Keeps HTTP handling separate from valuation, billing, remote property lookup, and database
// transactions.
// Spring MVC: response values pass through HTTP message converters, typically Jackson JSON, rather
// than resolving a server-side view.
@RestController
@RequestMapping("/api/properties/{propertyId}/appraisals")
public class AppraisalController {
    private final PaidAppraisalService paid;
    private final FreeAppraisalService free;

    // Constructor injection makes required dependencies explicit and keeps paid and free behavior
    // independently replaceable.
    public AppraisalController(PaidAppraisalService paid, FreeAppraisalService free) {
        this.paid = paid;
        this.free = free;
    }

    // POST creates a billed report; the service coordinates idempotency and atomic local
    // persistence.
    @PostMapping("/paid")
    public AppraisalResponse paid(
            @PathVariable long propertyId,
            // Optional binding lets the service produce its explicit validation error when the
            // header is missing.
            @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return paid.appraise(propertyId, key);
    }

    // GET reads cached data without initiating remote property lookup, valuation, or credit
    // deductions.
    @GetMapping("/free")
    public AppraisalResponse free(@PathVariable long propertyId) {
        return free.retrieve(propertyId);
    }
}
