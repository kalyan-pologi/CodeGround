package com.reidy.communication.controller;

import com.reidy.communication.service.DeadLetterService;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

// Operators inspect archived failures before replay; successful requeueing still requires
// background publication and consumer processing.
//
// Exposes consumer failure metadata and deliberate replay under the shared operations authorization
// policy.
// Spring MVC: response values pass through HTTP message converters, typically Jackson JSON, rather
// than resolving a server-side view.
@RestController
@RequestMapping("/api/ops/dead-letters")
public class DeadLetterOperationsController {
    private final DeadLetterService service;

    public DeadLetterOperationsController(DeadLetterService service) {
        this.service = service;
    }

    @GetMapping
    public Page<DeadLetterService.Summary> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.list(page, size);
    }

    @PostMapping("/{id}/replay")
    @ResponseStatus(org.springframework.http.HttpStatus.ACCEPTED)
    public void replay(@PathVariable long id) {
        service.replay(id);
    }
}
