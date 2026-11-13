package com.reidy.platform.exception;

// A provider-specific subtype preserves failure meaning while reusing the shared remote-failure
// classification.
//
// Preserves rental-specific failures while sharing safe retry classification with other HTTP
// clients.
public class RentalProviderException extends RemoteServiceException {
    public RentalProviderException(boolean retryable, Throwable cause) {
        super("Rental provider request failed", retryable, cause);
    }
}
