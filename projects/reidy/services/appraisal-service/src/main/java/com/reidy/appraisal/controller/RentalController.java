package com.reidy.appraisal.controller;

import com.reidy.appraisal.dto.RentalData;
import com.reidy.appraisal.dto.RentalEndpoint;
import com.reidy.appraisal.service.RentalAnalyticsService;
import org.springframework.web.bind.annotation.*;

// Spring converts the endpoint path into an enum; unsupported names are rejected before rental
// business logic runs.
//
// Returns rental analytics through the cache decorator rather than calling a provider directly.
// Spring MVC: response values pass through HTTP message converters, typically Jackson JSON, rather
// than resolving a server-side view.
@RestController
@RequestMapping("/api/properties/{propertyId}/rental")
public class RentalController {
    private final RentalAnalyticsService client;

    public RentalController(RentalAnalyticsService client) {
        this.client = client;
    }

    @GetMapping("/{endpoint}")
    public RentalData get(@PathVariable long propertyId, @PathVariable RentalEndpoint endpoint) {
        return client.get(propertyId, endpoint);
    }
}
