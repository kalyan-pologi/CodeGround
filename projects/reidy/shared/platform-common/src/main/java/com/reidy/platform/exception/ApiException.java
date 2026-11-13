package com.reidy.platform.exception;

import org.springframework.http.HttpStatus;

// Business validation carries an intentional HTTP status; unexpected infrastructure errors are
// handled separately by the global advice.
//
// Carries an intentional HTTP failure status without exposing infrastructure exceptions to clients.
public class ApiException extends RuntimeException {
    public final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }
}
