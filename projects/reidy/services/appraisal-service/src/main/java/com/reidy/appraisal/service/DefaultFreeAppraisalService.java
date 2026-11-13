package com.reidy.appraisal.service;

import com.reidy.appraisal.dto.AppraisalResponse;
import com.reidy.appraisal.mapper.AppraisalJson;
import com.reidy.appraisal.repository.AppraisalCacheRepository;
import com.reidy.platform.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// A missing cache entry is an API error; this path deliberately never calls a provider or deducts
// credits.
//
// Reads reusable valuations without invoking paid providers or changing billing history.
// Spring: a service is a component-scanned bean; singleton scope shares this instance across
// request threads, so request state must remain local.
@Service
public class DefaultFreeAppraisalService implements FreeAppraisalService {
    private final AppraisalCacheRepository cache;
    private final AppraisalJson json;

    public DefaultFreeAppraisalService(AppraisalCacheRepository c, AppraisalJson j) {
        cache = c;
        json = j;
    }

    // Transactions: readOnly is an optimization hint, not authorization or guaranteed write
    // prevention; default propagation still joins an existing transaction.
    @Transactional(readOnly = true)
    // Returns only a previously cached valuation; missing cache data produces an explicit response.
    public AppraisalResponse retrieve(long propertyId) {
        var r =
                cache.findById(propertyId)
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND,
                                                "No cached appraisal available; request a paid appraisal first"));
        return new AppraisalResponse(
                null, propertyId, "CACHE", r.updatedAt, json.read(r.resultJson));
    }
}
