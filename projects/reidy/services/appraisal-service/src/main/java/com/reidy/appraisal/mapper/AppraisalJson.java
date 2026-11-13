package com.reidy.appraisal.mapper;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.reidy.appraisal.dto.NormalizedAppraisal;
import org.springframework.stereotype.Component;

// Persisted reports use the normalized DTO shape; serialization failures stop the operation rather
// than saving an unreadable report.
//
// Serializes normalized snapshots without coupling persistence services to JSON conversion details.
@Component
public class AppraisalJson {
    private final ObjectMapper mapper;

    public AppraisalJson(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public String write(NormalizedAppraisal value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("Cannot serialize appraisal", e);
        }
    }

    public NormalizedAppraisal read(String value) {
        try {
            return mapper.readValue(value, NormalizedAppraisal.class);
        } catch (Exception e) {
            throw new IllegalStateException("Cannot read appraisal", e);
        }
    }
}
