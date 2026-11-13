package com.reidy.communication.config;

import com.reidy.platform.exception.InvalidEventException;
import java.time.Duration;
import org.apache.kafka.common.TopicPartition;
import org.springframework.context.annotation.*;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.*;
import org.springframework.kafka.listener.*;
import org.springframework.kafka.support.ExponentialBackOffWithMaxRetries;
import org.springframework.util.backoff.FixedBackOff;

// Source processing has bounded retries; DLT archival instead keeps retrying so a temporary
// database failure does not discard recovery evidence.
//
// Source failures retry briefly, then reach a matching dead-letter partition only after the broker
// acknowledges recovery.
// Spring: configuration classes declare bean definitions; container-managed beans receive
// dependency injection and lifecycle callbacks.
@Configuration
public class KafkaConsumerConfig {
    @Bean
    ConcurrentKafkaListenerContainerFactory<String, String> notificationKafkaFactory(
            ConsumerFactory<String, String> consumers, KafkaTemplate<String, String> template) {
        var recoverer =
                new DeadLetterPublishingRecoverer(
                        template,
                        (record, error) ->
                                new TopicPartition(record.topic() + ".DLT", record.partition()));
        // A failed DLT send must remain a processing failure rather than falsely completing
        // recovery.
        recoverer.setFailIfSendResultIsError(true);
        recoverer.setWaitForSendResultTimeout(Duration.ofSeconds(12));
        var backoff = new ExponentialBackOffWithMaxRetries(2);
        backoff.setInitialInterval(250);
        backoff.setMultiplier(2);
        backoff.setMaxInterval(1000);
        var errors = new DefaultErrorHandler(recoverer, backoff);
        // Malformed contracts go directly to recovery because waiting cannot fix their content.
        errors.addNotRetryableExceptions(InvalidEventException.class);
        var factory = new ConcurrentKafkaListenerContainerFactory<String, String>();
        factory.setConsumerFactory(consumers);
        factory.setCommonErrorHandler(errors);
        // Record acknowledgment follows successful listener completion, after the database
        // transaction returns.
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.RECORD);
        return factory;
    }

    // Dead-letter archive failures remain on the DLT instead of recursively creating another
    // dead-letter topic.
    @Bean
    ConcurrentKafkaListenerContainerFactory<String, String> deadLetterKafkaFactory(
            ConsumerFactory<String, String> consumers) {
        var factory = new ConcurrentKafkaListenerContainerFactory<String, String>();
        factory.setConsumerFactory(consumers);
        factory.setCommonErrorHandler(
                new DefaultErrorHandler(new FixedBackOff(1000, FixedBackOff.UNLIMITED_ATTEMPTS)));
        // Record acknowledgment follows successful listener completion, after the database
        // transaction returns.
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.RECORD);
        return factory;
    }
}
