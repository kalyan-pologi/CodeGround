package com.reidy.property;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

// Component scanning includes shared infrastructure; entity and repository scanning remain explicit
// so each service owns its persistence model.
//
// Starts one independently runnable service with only its own domain and shared infrastructure.
@SpringBootApplication(scanBasePackages = {"com.reidy.property", "com.reidy.platform"})
@EntityScan({"com.reidy.property.entity", "com.reidy.platform.entity"})
@EnableJpaRepositories({"com.reidy.property.repository", "com.reidy.platform.repository"})
public class PropertyApplication {
    public static void main(String[] args) {
        SpringApplication.run(PropertyApplication.class, args);
    }
}
