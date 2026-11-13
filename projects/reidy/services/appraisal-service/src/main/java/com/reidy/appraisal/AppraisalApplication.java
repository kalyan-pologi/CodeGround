package com.reidy.appraisal;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

// This process runs appraisal APIs independently; shared contracts describe remote properties
// without importing property-service entities.
//
// Starts one independently runnable service with only its own domain and shared infrastructure.
@SpringBootApplication(scanBasePackages = {"com.reidy.appraisal", "com.reidy.platform"})
@EntityScan({"com.reidy.appraisal.entity", "com.reidy.platform.entity"})
@EnableJpaRepositories({"com.reidy.appraisal.repository", "com.reidy.platform.repository"})
public class AppraisalApplication {
    public static void main(String[] args) {
        SpringApplication.run(AppraisalApplication.class, args);
    }
}
