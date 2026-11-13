package com.reidy.appraisal.config;

import com.reidy.appraisal.entity.CreditAccount;
import com.reidy.appraisal.repository.CreditAccountRepository;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.*;

// The fictional account supports the learning flow; this seed is not a real customer billing or
// tenant model.
//
// Creates the fictional local credit account without running demo initialization in secured
// environments.
// Spring: configuration classes declare bean definitions; container-managed beans receive
// dependency injection and lifecycle callbacks.
@Configuration
// Spring: the profile expression controls bean registration at startup; changing an environment
// variable does not rebuild a running context.
@Profile("!prod & !uat")
public class DemoAccountInitializer {
    @Bean
    ApplicationRunner initializeAccount(CreditAccountRepository repository) {
        return args -> {
            if (!repository.existsById(1L)) {
                var a = new CreditAccount();
                a.id = 1L;
                a.balance = 100;
                repository.save(a);
            }
        };
    }
}
