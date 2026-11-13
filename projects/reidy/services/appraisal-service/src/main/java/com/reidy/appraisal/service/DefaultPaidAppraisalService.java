package com.reidy.appraisal.service;

import com.reidy.appraisal.dto.AppraisalResponse;
import com.reidy.appraisal.provider.*;
import com.reidy.contracts.model.PropertyType;
import com.reidy.platform.exception.ApiException;
import com.reidy.platform.provider.PropertyClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

// The initial replay lookup avoids unnecessary work; the store repeats that check under a lock to
// handle concurrent purchases.
//
// Performs remote reads before opening the local billing transaction, avoiding idle database
// connections during HTTP waits.
// Spring: a service is a component-scanned bean; singleton scope shares this instance across
// request threads, so request state must remain local.
@Service
public class DefaultPaidAppraisalService implements PaidAppraisalService {
    private final PropertyClient properties;
    private final PaidAppraisalStore store;
    private final MockResidentialValuationProvider residential;
    private final MockCommercialValuationProvider commercial;

    public DefaultPaidAppraisalService(
            PropertyClient properties,
            PaidAppraisalStore store,
            MockResidentialValuationProvider residential,
            MockCommercialValuationProvider commercial) {
        this.properties = properties;
        this.store = store;
        this.residential = residential;
        this.commercial = commercial;
    }

    // Replaying a purchased report does not require the property service to remain available.
    public AppraisalResponse appraise(long propertyId, String key) {
        if (key == null || key.isBlank() || key.length() > 100)
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "Idempotency-Key must contain 1-100 characters");
        // Check replay before HTTP so a previously purchased report remains available during
        // property-service downtime.
        var previous = store.previous(propertyId, key);
        if (previous != null) return previous;
        // Fetch the remote snapshot before the store opens its billing transaction.
        var property = properties.get(propertyId);
        if (property.propertyType() == PropertyType.LAND)
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY, "Land valuation is not supported");
        // Select category-specific valuation logic while keeping the purchase workflow identical.
        ValuationProvider provider =
                property.propertyType() == PropertyType.COMMERCIAL ? commercial : residential;
        return store.purchase(property, key, provider.value(property));
    }
}
