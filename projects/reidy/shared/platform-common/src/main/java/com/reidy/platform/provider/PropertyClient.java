package com.reidy.platform.provider;

import com.reidy.contracts.dto.PropertySnapshot;

// Consumers depend on this HTTP contract rather than a repository belonging to another service.
//
// Defines synchronous property lookup without importing the property service implementation or
// repositories.
public interface PropertyClient {
    PropertySnapshot get(long propertyId);
}
