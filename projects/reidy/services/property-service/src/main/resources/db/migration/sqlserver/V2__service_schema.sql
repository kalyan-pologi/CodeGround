-- This service owns these tables; remote references deliberately have no cross-database foreign keys.

create table property (
    asking_price numeric(38,2),
    bathrooms numeric(38,2),
    bedrooms int,
    square_footage int,
    year_built int,
    created_at datetimeoffset(6),
    id bigint identity not null,
    updated_at datetimeoffset(6),
    version bigint,
    address varchar(255) not null,
    city varchar(255),
    property_type varchar(255) check (property_type in ('RESIDENTIAL','COMMERCIAL','LAND','DUPLEX','TRIPLEX','MULTIPLEX')),
    state varchar(255),
    zip_code varchar(255),
    primary key (id)
);
