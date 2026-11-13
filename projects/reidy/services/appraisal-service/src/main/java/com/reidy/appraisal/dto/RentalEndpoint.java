package com.reidy.appraisal.dto;

// An enum constrains supported rental resources, avoiding arbitrary endpoint strings throughout
// cache and provider logic.
//
// Identifies the three rental resources that have independent cache expiration settings.
public enum RentalEndpoint {
    RENTAL_ESTIMATE,
    NEIGHBORHOOD_STATISTICS,
    RENTAL_COMPARABLES
}
