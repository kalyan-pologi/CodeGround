package com.reidy.platform.exception;

import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

// Central error translation keeps controllers focused on successful flows and avoids returning
// internal stack traces to clients.
//
// Converts application and dependency failures into consistent HTTP problem responses.
// Spring MVC: advice handles matching controller exceptions centrally; failures earlier in servlet
// security filters use their own handlers.
@RestControllerAdvice
public class ExceptionHandlerAdvice {
    @ExceptionHandler(ApiException.class)
    ResponseEntity<ProblemDetail> domain(ApiException e) {
        var response = ResponseEntity.status(e.status);
        if (e.status == HttpStatus.SERVICE_UNAVAILABLE) response.header("Retry-After", "1");
        return response.body(ProblemDetail.forStatusAndDetail(e.status, e.getMessage()));
    }

    @ExceptionHandler({
        MethodArgumentNotValidException.class,
        org.springframework.http.converter.HttpMessageNotReadableException.class,
        org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
        org.springframework.web.bind.MissingServletRequestParameterException.class
    })
    ProblemDetail invalid(Exception e) {
        return ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST, "Invalid request fields or format");
    }

    @ExceptionHandler(org.springframework.dao.PessimisticLockingFailureException.class)
    ProblemDetail busy(Exception e) {
        return ProblemDetail.forStatusAndDetail(
                HttpStatus.SERVICE_UNAVAILABLE, "Resource busy; retry later");
    }

    @ExceptionHandler({
        com.reidy.platform.exception.RemoteServiceException.class,
        io.github.resilience4j.circuitbreaker.CallNotPermittedException.class,
        io.github.resilience4j.bulkhead.BulkheadFullException.class,
        org.springframework.transaction.TransactionTimedOutException.class,
        org.springframework.dao.QueryTimeoutException.class,
        org.springframework.transaction.CannotCreateTransactionException.class,
        org.springframework.dao.DataAccessResourceFailureException.class
    })
    ResponseEntity<ProblemDetail> dependencyUnavailable(Exception error) {
        org.slf4j.LoggerFactory.getLogger(ExceptionHandlerAdvice.class)
                .atWarn()
                .addKeyValue("errorType", error.getClass().getSimpleName())
                .log("dependency_unavailable");
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .header("Retry-After", "1")
                .body(
                        ProblemDetail.forStatusAndDetail(
                                HttpStatus.SERVICE_UNAVAILABLE,
                                "Dependency unavailable; retry later"));
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail unexpected(Exception error) {
        if (error instanceof org.springframework.web.ErrorResponse expected)
            return ProblemDetail.forStatusAndDetail(
                    expected.getStatusCode(), "Request could not be processed");
        if (error instanceof org.springframework.security.access.AccessDeniedException)
            return ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, "Access denied");
        org.slf4j.LoggerFactory.getLogger(ExceptionHandlerAdvice.class)
                .error("event=unexpected_request_failure", error);
        return ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Unexpected server error; use X-Request-Id for support");
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    ProblemDetail conflict(Exception e) {
        return ProblemDetail.forStatusAndDetail(
                HttpStatus.CONFLICT, "Concurrent update; retry the request");
    }
}
