package com.reidy.contracts.model;

// Sharing this small enum keeps HTTP contracts consistent without coupling services to property
// persistence classes.
//
// Lists supported property categories without embedding valuation algorithms in the enum.
public enum PropertyType {
    RESIDENTIAL,
    COMMERCIAL,
    LAND,
    DUPLEX,
    TRIPLEX,
    MULTIPLEX
}
