package com.reidy.platform.config;

import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.*;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

// Worker threads are reused, so copied logging context must be restored after every task to avoid
// mixing request identities.
//
// Bounds live delivery work and propagates request context across background threads.
// Spring: configuration classes declare bean definitions; container-managed beans receive
// dependency injection and lifecycle callbacks.
@Configuration
@EnableAsync
@org.springframework.scheduling.annotation.EnableScheduling
public class AsyncConfig {
    @Bean("deliveryExecutor")
    public ThreadPoolTaskExecutor deliveryExecutor() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("delivery-");
        // Overload must never run a delivery on the primary request thread.
        executor.setRejectedExecutionHandler(
                (task, pool) ->
                        LoggerFactory.getLogger(AsyncConfig.class)
                                .warn("event=delivery_rejected reason=queue_full_or_shutdown"));
        executor.setTaskDecorator(
                task -> {
                    // ThreadLocal: capture logging context before handoff; pooled worker threads do
                    // not automatically inherit the submitting request's MDC.
                    var context = org.slf4j.MDC.getCopyOfContextMap();
                    return () -> {
                        var previous = org.slf4j.MDC.getCopyOfContextMap();
                        try {
                            if (context == null) org.slf4j.MDC.clear();
                            else org.slf4j.MDC.setContextMap(context);
                            task.run();
                        } finally {
                            // Thread reuse: restore prior context in finally so the next task
                            // cannot inherit this request's logging identifiers.
                            if (previous == null) org.slf4j.MDC.clear();
                            else org.slf4j.MDC.setContextMap(previous);
                        }
                    };
                });
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(10);
        return executor;
    }
}
