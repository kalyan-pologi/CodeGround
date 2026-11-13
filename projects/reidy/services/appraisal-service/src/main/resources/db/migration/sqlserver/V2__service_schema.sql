-- This service owns these tables; remote references deliberately have no cross-database foreign keys.

create table appraisal_cache (
    property_id bigint not null,
    updated_at datetimeoffset(6),
    version bigint,
    result_json varchar(max) not null,
    primary key (property_id)
);

create table appraisal_history (
    created_at datetimeoffset(6) not null,
    id bigint identity not null,
    property_id bigint not null,
    idempotency_key varchar(100) not null,
    property_snapshot_json varchar(max) not null,
    result_json varchar(max) not null,
    primary key (id)
);

create table credit_account (
    balance int not null,
    id bigint not null,
    primary key (id)
);

create table credit_transaction (
    amount int not null,
    account_id bigint not null,
    created_at datetimeoffset(6),
    id bigint identity not null,
    report_id bigint not null,
    primary key (id)
);

create table rental_cache_entry (
    expires_at datetimeoffset(6) not null,
    id bigint identity not null,
    property_id bigint not null,
    refresh_until datetimeoffset(6),
    version bigint,
    refresh_token varchar(36),
    endpoint varchar(40) not null check (endpoint in ('RENTAL_ESTIMATE','NEIGHBORHOOD_STATISTICS','RENTAL_COMPARABLES')),
    payload varchar(max) not null,
    primary key (id)
);

create table rental_cache_lock (
    id int not null,
    primary key (id)
);

alter table appraisal_history add constraint uq_appraisal_history_idempotency_key unique (idempotency_key);

alter table credit_transaction add constraint uq_credit_transaction_report_id unique (report_id);

alter table rental_cache_entry add constraint uq_rental_cache_entry_property_id_endpoint unique (property_id, endpoint);

alter table credit_transaction add constraint fk_credit_transaction_account_id foreign key (account_id) references credit_account;

alter table credit_transaction add constraint fk_credit_transaction_report_id foreign key (report_id) references appraisal_history;

-- The sample has one account; real customer accounts require a separate domain change.
insert into credit_account (id, balance) values (1, 100);
alter table credit_account add constraint ck_credit_balance check (balance >= 0);
alter table credit_transaction add constraint ck_credit_debit check (amount < 0);
insert into rental_cache_lock (id) values (0);
insert into rental_cache_lock (id) values (1);
insert into rental_cache_lock (id) values (2);
insert into rental_cache_lock (id) values (3);
insert into rental_cache_lock (id) values (4);
insert into rental_cache_lock (id) values (5);
insert into rental_cache_lock (id) values (6);
insert into rental_cache_lock (id) values (7);
insert into rental_cache_lock (id) values (8);
insert into rental_cache_lock (id) values (9);
insert into rental_cache_lock (id) values (10);
insert into rental_cache_lock (id) values (11);
insert into rental_cache_lock (id) values (12);
insert into rental_cache_lock (id) values (13);
insert into rental_cache_lock (id) values (14);
insert into rental_cache_lock (id) values (15);
GO

-- Protect append-only audit rows even when SQL bypasses Hibernate.
CREATE TRIGGER prevent_appraisal_history_mutation
ON appraisal_history INSTEAD OF UPDATE, DELETE
AS
BEGIN
    THROW 51001, 'Appraisal history is append-only.', 1;
END;
GO

CREATE TRIGGER prevent_credit_transaction_mutation
ON credit_transaction INSTEAD OF UPDATE, DELETE
AS
BEGIN
    THROW 51002, 'Credit transactions are append-only.', 1;
END;
GO
