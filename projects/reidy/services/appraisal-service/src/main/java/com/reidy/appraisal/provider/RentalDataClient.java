package com.reidy.appraisal.provider;

import com.reidy.appraisal.dto.RentalData;
import com.reidy.appraisal.dto.RentalEndpoint;

// Caching, resilience and transport share this interface, allowing decorators to add behavior
// without changing callers.
//
// Defines a shared rental transport contract implemented by mocks, HTTP clients, and decorators.
public interface RentalDataClient {
    RentalData fetch(long propertyId, RentalEndpoint endpoint);
}
