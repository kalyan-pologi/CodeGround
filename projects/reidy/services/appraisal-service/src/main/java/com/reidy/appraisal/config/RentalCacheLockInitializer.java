package com.reidy.appraisal.config;

import com.reidy.appraisal.entity.RentalCacheLock;
import com.reidy.appraisal.repository.RentalCacheLockRepository;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.*;

// Pre-created lock buckets allow coordination even when no cache row exists yet for a property and
// endpoint.
//
// Seeds local coordination buckets; deployed databases receive these rows through versioned
// migrations.
// Spring: configuration classes declare bean definitions; container-managed beans receive
// dependency injection and lifecycle callbacks.
@Configuration
// Spring: the profile expression controls bean registration at startup; changing an environment
// variable does not rebuild a running context.
@Profile("!prod & !uat")
public class RentalCacheLockInitializer {
    @Bean
    ApplicationRunner initializeLockBuckets(RentalCacheLockRepository repository) {
        return args -> {
            for (int id = 0; id < 16; id++)
                if (!repository.existsById(id)) {
                    var bucket = new RentalCacheLock();
                    bucket.id = id;
                    repository.save(bucket);
                }
        };
    }
}
