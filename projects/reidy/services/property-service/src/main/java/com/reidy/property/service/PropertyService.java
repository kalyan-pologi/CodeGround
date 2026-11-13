package com.reidy.property.service;

import com.reidy.contracts.dto.PropertySnapshot;
import com.reidy.contracts.model.PropertyType;
import com.reidy.platform.exception.ApiException;
import com.reidy.platform.service.ActorIdentity;
import com.reidy.platform.service.NotificationPublisher;
import com.reidy.property.dto.PropertyRequest;
import com.reidy.property.entity.Property;
import com.reidy.property.repository.PropertyRepository;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Mapping to snapshots happens inside service methods so callers depend on an API contract rather
// than database relationships.
//
// Owns property business rules and records notification events in the same database transaction.
// Spring: a service is a component-scanned bean; singleton scope shares this instance across
// request threads, so request state must remain local.
@Service
// Transactions: proxy-intercepted calls use REQUIRED propagation by default; unchecked exceptions
// and Errors trigger rollback unless rules override it.
@Transactional
public class PropertyService {
    private final PropertyRepository properties;
    private final NotificationPublisher notifications;
    private final ActorIdentity actor;

    public PropertyService(
            PropertyRepository properties,
            NotificationPublisher notifications,
            ActorIdentity actor) {
        this.properties = properties;
        this.notifications = notifications;
        this.actor = actor;
    }

    // Transactions: readOnly is an optimization hint, not authorization or guaranteed write
    // prevention; default propagation still joins an existing transaction.
    @Transactional(readOnly = true)
    public PropertySnapshot get(long id) {
        return properties
                .findById(id)
                // Java: this method reference maps an Optional or Page value; it does not modify
                // the managed entity.
                .map(this::snapshot)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Property not found"));
    }

    public PropertySnapshot create(PropertyRequest request) {
        var property = properties.save(apply(new Property(), request));
        notifications.publish(
                com.reidy.contracts.event.PlatformEvent.create(
                        com.reidy.contracts.event.PlatformEvent.Type.PROPERTY_CREATED,
                        property.id.toString(),
                        java.util.Set.of(actor.currentUserOrDemo()),
                        "property " + property.id));
        return snapshot(property);
    }

    public PropertySnapshot update(long id, PropertyRequest request) {
        var property =
                properties
                        .findById(id)
                        .orElseThrow(
                                () -> new ApiException(HttpStatus.NOT_FOUND, "Property not found"));
        return snapshot(properties.saveAndFlush(apply(property, request)));
    }

    // Transactions: readOnly is an optimization hint, not authorization or guaranteed write
    // prevention; default propagation still joins an existing transaction.
    @Transactional(readOnly = true)
    public Page<PropertySnapshot> search(String city, PropertyType type, int page, int size) {
        if (page < 0 || size < 1 || size > 100)
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "page must be nonnegative and size must be 1-100");
        return properties
                .findAll(
                        // JPA Specification: this lambda builds Criteria predicates; filtering
                        // executes in the database rather than loading every property.
                        (root, query, cb) -> {
                            var predicate = cb.conjunction();
                            if (city != null)
                                predicate =
                                        cb.and(
                                                predicate,
                                                cb.equal(
                                                        cb.lower(root.get("city")),
                                                        // Java: Locale.ROOT avoids machine-locale
                                                        // differences when normalizing search text.
                                                        city.toLowerCase(java.util.Locale.ROOT)));
                            if (type != null)
                                predicate =
                                        cb.and(predicate, cb.equal(root.get("propertyType"), type));
                            return predicate;
                        },
                        PageRequest.of(page, size, Sort.by("id")))
                // Java: this method reference maps an Optional or Page value; it does not modify
                // the managed entity.
                .map(this::snapshot);
    }

    private Property apply(Property p, PropertyRequest r) {
        p.address = r.address();
        p.city = r.city();
        p.state = r.state();
        p.zipCode = r.zipCode();
        p.propertyType = r.propertyType();
        p.bedrooms = r.bedrooms();
        p.bathrooms = r.bathrooms();
        p.squareFootage = r.squareFootage();
        p.yearBuilt = r.yearBuilt();
        p.askingPrice = r.askingPrice();
        return p;
    }

    // Converts owned entities into a stable HTTP contract before data crosses a service boundary.
    private PropertySnapshot snapshot(Property p) {
        return new PropertySnapshot(
                p.id,
                p.address,
                p.city,
                p.state,
                p.zipCode,
                p.propertyType,
                p.bedrooms,
                p.bathrooms,
                p.squareFootage,
                p.yearBuilt,
                p.askingPrice,
                p.createdAt,
                p.updatedAt,
                p.version);
    }
}
