-- Every service owns an independent copy of this publication table inside its own database.

create table notification_outbox (
    attempts int not null,
    completed_at datetimeoffset(6),
    created_at datetimeoffset(6) not null,
    lease_until datetimeoffset(6),
    next_attempt_at datetimeoffset(6) not null,
    version bigint,
    status varchar(20) not null check (status in ('PENDING','PROCESSING','PUBLISHED','DEAD')),
    claim_token varchar(36),
    event_id varchar(36) not null,
    id varchar(36) not null,
    request_id varchar(36),
    last_error varchar(200),
    payload varchar(max) not null,
    primary key (id)
);

create index ix_outbox_due on notification_outbox (status, next_attempt_at);

create index ix_outbox_lease on notification_outbox (status, lease_until);

alter table notification_outbox add constraint ck_outbox_attempts check (attempts >= 0);
