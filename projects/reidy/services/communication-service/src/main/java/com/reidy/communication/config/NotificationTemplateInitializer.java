package com.reidy.communication.config;

import com.reidy.communication.entity.NotificationTemplate;
import com.reidy.communication.repository.NotificationTemplateRepository;
import com.reidy.contracts.event.PlatformEvent;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.*;

// Local template seeding makes asynchronous notifications readable immediately; deployed data setup
// remains an operational responsibility.
//
// Seeds local notification wording while deployed environments initialize templates through
// migrations.
// Spring: configuration classes declare bean definitions; container-managed beans receive
// dependency injection and lifecycle callbacks.
@Configuration
// Spring: the profile expression controls bean registration at startup; changing an environment
// variable does not rebuild a running context.
@Profile("!prod & !uat")
public class NotificationTemplateInitializer {
    @Bean
    ApplicationRunner initializeTemplates(NotificationTemplateRepository templates) {
        return args -> {
            for (var type : PlatformEvent.Type.values()) {
                if (!templates.existsById(type.name())) {
                    var template = new NotificationTemplate();
                    template.eventType = type.name();
                    template.body =
                            switch (type) {
                                case PROPERTY_CREATED -> "Property created: {subject}";
                                case APPRAISAL_COMPLETED -> "Appraisal completed: {subject}";
                                case NEW_CHAT_MESSAGE -> "New chat message in {subject}";
                            };
                    templates.save(template);
                }
            }
        };
    }
}
