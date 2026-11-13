package com.reidy.appraisal.service;

import com.reidy.appraisal.dto.*;
import com.reidy.appraisal.provider.RentalDataClient;
import com.reidy.platform.provider.PropertyClient;
import org.springframework.stereotype.Service;

// Property existence is validated through its owning service before the decorated rental client
// handles cache and provider access.
//
// Validates the remote property outside local transactions before retrieving provider-backed rental
// analytics.
// Spring: a service is a component-scanned bean; singleton scope shares this instance across
// request threads, so request state must remain local.
@Service
public class RentalAnalyticsService {
    private final PropertyClient properties;
    private final RentalDataClient rental;

    public RentalAnalyticsService(PropertyClient properties, RentalDataClient rental) {
        this.properties = properties;
        this.rental = rental;
    }

    public RentalData get(long propertyId, RentalEndpoint endpoint) {
        properties.get(propertyId);
        return rental.fetch(propertyId, endpoint);
    }
}
