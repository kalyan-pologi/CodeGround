package com.reidy.platform.config;

import com.reidy.contracts.event.EventTopics;
import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.KafkaAdmin;

// Source and dead-letter topics need matching partition counts because recovery sends failures to
// the corresponding partition.
//
// Creates local demonstration topics; secured environments expect operations to provision matching
// topic policies.
// Spring: configuration classes declare bean definitions; container-managed beans receive
// dependency injection and lifecycle callbacks.
@Configuration
// Spring: the profile expression controls bean registration at startup; changing an environment
// variable does not rebuild a running context.
@Profile("!prod & !uat")
// Spring Boot: register this configuration or component only when the configured property condition
// matches during startup.
@ConditionalOnProperty(
        name = {"app.kafka.enabled", "app.kafka.create-topics"},
        havingValue = "true")
public class KafkaTopicsConfig {
    @Bean
    KafkaAdmin.NewTopics businessTopics(
            @Value("${app.kafka.partitions:3}") int partitions,
            @Value("${app.kafka.replication-factor:1}") int replicas) {
        var topics = new java.util.ArrayList<NewTopic>();
        for (String topic : EventTopics.all()) {
            topics.add(TopicBuilder.name(topic).partitions(partitions).replicas(replicas).build());
            topics.add(
                    TopicBuilder.name(topic + ".DLT")
                            .partitions(partitions)
                            .replicas(replicas)
                            .build());
        }
        return new KafkaAdmin.NewTopics(topics.toArray(NewTopic[]::new));
    }
}
