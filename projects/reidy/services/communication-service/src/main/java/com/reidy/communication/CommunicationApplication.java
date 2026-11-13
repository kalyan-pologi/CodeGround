package com.reidy.communication;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

// HTTP chat endpoints and Kafka notification listeners run together, using this service's own
// database.
//
// Starts one independently runnable service with only its own domain and shared infrastructure.
@SpringBootApplication(scanBasePackages = {"com.reidy.communication", "com.reidy.platform"})
@EntityScan({"com.reidy.communication.entity", "com.reidy.platform.entity"})
@EnableJpaRepositories({"com.reidy.communication.repository", "com.reidy.platform.repository"})
public class CommunicationApplication {
    public static void main(String[] args) {
        SpringApplication.run(CommunicationApplication.class, args);
    }
}
