package com.reidy.platform.exception;

// Repeating the same malformed payload cannot repair its contract, so the consumer error handler
// skips ordinary retries.
//
// Rejects unsupported or malformed event contracts before consumers perform any database writes.
public class InvalidEventException extends RuntimeException {
    public InvalidEventException(String message) {
        super(message);
    }

    public InvalidEventException(String message, Throwable cause) {
        super(message, cause);
    }
}
