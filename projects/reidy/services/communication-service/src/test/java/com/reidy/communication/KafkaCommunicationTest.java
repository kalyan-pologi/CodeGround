package com.reidy.communication;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.*;

import com.reidy.communication.dto.*;
import com.reidy.communication.repository.*;
import com.reidy.communication.service.*;
import com.reidy.contracts.event.EventTopics;
import com.reidy.platform.entity.NotificationOutbox.Status;
import com.reidy.platform.provider.PropertyClient;
import com.reidy.platform.repository.NotificationOutboxRepository;
import java.time.Duration;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

// An embedded broker exercises real publication and consumption, including duplicate events and
// malformed input recovery.
//
// Runs a real embedded broker to check outbox publication, consumer deduplication, and
// malformed-event dead-letter archival.
// Testing: start a Spring application context so configuration, proxies and persistence can
// participate; this is broader than an isolated unit test.
@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:h2:mem:communicationtest;DB_CLOSE_DELAY=-1",
            "spring.jpa.hibernate.ddl-auto=create-drop",
            "app.kafka.create-topics=false",
            "app.kafka.consumer-concurrency=1",
            "notifications.redis-enabled=false"
        })
@EmbeddedKafka(
        kraft = true,
        partitions = 1,
        topics = {
            EventTopics.PROPERTY_CREATED,
            EventTopics.APPRAISAL_COMPLETED,
            EventTopics.CHAT_MESSAGE_CREATED,
            EventTopics.PROPERTY_CREATED + ".DLT",
            EventTopics.APPRAISAL_COMPLETED + ".DLT",
            EventTopics.CHAT_MESSAGE_CREATED + ".DLT"
        })
@DirtiesContext
class KafkaCommunicationTest {
    @MockitoBean PropertyClient properties;
    @Autowired io.micrometer.core.instrument.MeterRegistry metrics;
    @Autowired ChatService chat;
    @Autowired NotificationRepository notifications;
    @Autowired ProcessedEventRepository processed;
    @Autowired DeadLetterRepository deadLetters;
    @Autowired NotificationOutboxRepository outbox;
    @Autowired KafkaTemplate<String, String> kafka;

    @Test
    void publishesChatOnceAndArchivesMalformedEvents() throws Exception {
        var conversation =
                chat.create(new ConversationRequest(null, Set.of("broker-demo", "buyer-demo")));
        chat.send(
                conversation.id(),
                new ChatMessageRequest("broker-demo", "chat-key", "Synthetic discussion"));
        await().atMost(Duration.ofSeconds(30))
                .until(
                        () ->
                                notifications
                                                .findByRecipientOrderByIdDesc(
                                                        "buyer-demo",
                                                        org.springframework.data.domain.PageRequest
                                                                .of(0, 10))
                                                .getTotalElements()
                                        == 1);
        var publication = outbox.findAll().get(0);
        await().atMost(Duration.ofSeconds(10))
                .until(
                        () ->
                                outbox.findById(publication.id).orElseThrow().status
                                        == Status.PUBLISHED);
        kafka.send(EventTopics.CHAT_MESSAGE_CREATED, "duplicate", publication.payload).get();
        kafka.send(EventTopics.CHAT_MESSAGE_CREATED, "duplicate", publication.payload).get();
        await().atMost(Duration.ofSeconds(10))
                .until(
                        () ->
                                metrics.counter("kafka.notification.events", "result", "duplicate")
                                                .count()
                                        >= 2);
        kafka.send(EventTopics.PROPERTY_CREATED, "invalid", "{broken-json").get();
        await().atMost(Duration.ofSeconds(20)).until(() -> deadLetters.count() == 1);
        assertEquals(1, processed.count());
        assertEquals(
                1,
                notifications
                        .findByRecipientOrderByIdDesc(
                                "buyer-demo", org.springframework.data.domain.PageRequest.of(0, 10))
                        .getTotalElements());
        assertEquals(EventTopics.PROPERTY_CREATED, deadLetters.findAll().get(0).originalTopic);
    }
}
