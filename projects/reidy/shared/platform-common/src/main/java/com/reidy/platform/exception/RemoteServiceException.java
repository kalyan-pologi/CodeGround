package com.reidy.platform.exception;

// The retryable flag distinguishes transient dependency failures from failures that another attempt
// is unlikely to fix.
//
// Marks transient dependency failures explicitly so retries never include arbitrary business
// errors.
public class RemoteServiceException extends RuntimeException {
    private final boolean retryable;

    public RemoteServiceException(String message, boolean retryable, Throwable cause) {
        super(message, cause);
        this.retryable = retryable;
    }

    public boolean retryable() {
        return retryable;
    }
}
