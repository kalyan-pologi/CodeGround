package com.reidy.property.controller;

import com.reidy.contracts.dto.PropertySnapshot;
import com.reidy.contracts.model.PropertyType;
import com.reidy.property.dto.PropertyRequest;
import com.reidy.property.service.PropertyService;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.data.domain.Page;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

// Spring validates request DTOs before delegation; the service returns snapshots rather than
// exposing managed JPA entities.
//
// Maps property HTTP requests to validated service operations without embedding persistence logic.
// Spring MVC: response values pass through HTTP message converters, typically Jackson JSON, rather
// than resolving a server-side view.
@RestController
@RequestMapping("/api/properties")
public class PropertyController {
    private final PropertyService service;

    public PropertyController(PropertyService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<PropertySnapshot> create(@Valid @RequestBody PropertyRequest r) {
        var p = service.create(r);
        return ResponseEntity.created(URI.create("/api/properties/" + p.id())).body(p);
    }

    @GetMapping("/{id}")
    public PropertySnapshot get(@PathVariable long id) {
        return service.get(id);
    }

    @PutMapping("/{id}")
    public PropertySnapshot update(@PathVariable long id, @Valid @RequestBody PropertyRequest r) {
        return service.update(id, r);
    }

    @GetMapping
    public Page<PropertySnapshot> search(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) PropertyType type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.search(city, type, page, size);
    }
}
