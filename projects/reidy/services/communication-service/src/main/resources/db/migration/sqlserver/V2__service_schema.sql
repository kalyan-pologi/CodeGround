-- This service owns these tables; remote references deliberately have no cross-database foreign keys.

create table chat_message (
    conversation_id bigint not null,
    id bigint identity not null,
    sent_at datetimeoffset(6) not null,
    sequence_number bigint not null,
    client_message_id varchar(100) not null,
    sender_id varchar(100) not null,
    content varchar(4000) not null,
    primary key (id)
);

create table conversation (
    created_at datetimeoffset(6),
    id bigint identity not null,
    next_sequence bigint not null,
    property_id bigint,
    primary key (id)
);

create table conversation_participant (
    conversation_id bigint not null,
    user_id varchar(100) not null,
    primary key (conversation_id, user_id)
);

create table dead_letter_record (
    original_partition int not null,
    archived_at datetimeoffset(6) not null,
    id bigint identity not null,
    original_offset bigint not null,
    replayed_at datetimeoffset(6),
    original_topic varchar(120) not null,
    reason varchar(200) not null,
    payload varchar(max) not null,
    primary key (id)
);

create table notification (
    created_at datetimeoffset(6) not null,
    id bigint identity not null,
    event_id varchar(36) not null,
    event_type varchar(40) not null,
    recipient varchar(100) not null,
    body varchar(2000) not null,
    primary key (id)
);

create table notification_template (
    event_type varchar(40) not null,
    body varchar(1000) not null,
    primary key (event_type)
);

create table processed_event (
    processed_at datetimeoffset(6) not null,
    event_id varchar(36) not null,
    primary key (event_id)
);

alter table chat_message add constraint uq_chat_message_conversation_id_sender_id_client_message_id unique (conversation_id, sender_id, client_message_id);

alter table chat_message add constraint uq_chat_message_conversation_id_sequence_number unique (conversation_id, sequence_number);

alter table dead_letter_record add constraint uq_dead_letter_record_original_topic_original_partition_original_offset unique (original_topic, original_partition, original_offset);

alter table notification add constraint uq_notification_event_id_recipient unique (event_id, recipient);

alter table chat_message add constraint fk_chat_message_conversation_id foreign key (conversation_id) references conversation;

alter table conversation_participant add constraint fk_conversation_participant_conversation_id foreign key (conversation_id) references conversation;

insert into notification_template (event_type, body) values ('PROPERTY_CREATED', 'Property created: {subject}');
insert into notification_template (event_type, body) values ('APPRAISAL_COMPLETED', 'Appraisal completed: {subject}');
insert into notification_template (event_type, body) values ('NEW_CHAT_MESSAGE', 'New chat message in {subject}');
create index ix_notification_recipient on notification (recipient, id);
