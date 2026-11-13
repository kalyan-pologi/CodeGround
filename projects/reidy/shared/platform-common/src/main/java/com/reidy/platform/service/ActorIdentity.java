package com.reidy.platform.service;

import com.reidy.platform.exception.ApiException;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

// Local demo identities simplify learning; secured profiles require caller-supplied identities to
// match the authenticated token subject.
//
// Resolves the authenticated subject and rejects user impersonation in secured environments.
@Component
public class ActorIdentity {
    private final Environment environment;

    public ActorIdentity(Environment environment) {
        this.environment = environment;
    }

    public String currentUserOrDemo() {
        var actor = SecurityContextHolder.getContext().getAuthentication();
        return actor == null || actor instanceof AnonymousAuthenticationToken
                ? "demo-user"
                : actor.getName();
    }

    public void requireIdentity(String requestedUser) {
        if (environment.acceptsProfiles(Profiles.of("prod", "uat"))
                && !currentUserOrDemo().equals(requestedUser))
            throw new ApiException(
                    HttpStatus.FORBIDDEN, "Requested user must match authenticated subject");
    }

    public void requireParticipant(java.util.Set<String> participants) {
        if (environment.acceptsProfiles(Profiles.of("prod", "uat"))
                && !participants.contains(currentUserOrDemo()))
            throw new ApiException(
                    HttpStatus.FORBIDDEN, "Creator must be a conversation participant");
    }
}
