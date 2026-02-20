-- Broker Bot — PostgreSQL Schema

-- Per-guild configuration (channels, roles, dashboard message ID)
CREATE TABLE IF NOT EXISTS bot_config (
    guild_id              VARCHAR(20) PRIMARY KEY,
    dashboard_channel_id  VARCHAR(20),
    audit_channel_id      VARCHAR(20),
    admin_role_id         VARCHAR(20),
    agent_role_id         VARCHAR(20),
    dashboard_message_id  VARCHAR(20),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Current canonical state of each property
CREATE TABLE IF NOT EXISTS properties (
    property_id    VARCHAR(50)  NOT NULL,
    guild_id       VARCHAR(20)  NOT NULL,
    address        TEXT         NOT NULL,
    address_type   VARCHAR(50)  NOT NULL,
    price          BIGINT       NOT NULL DEFAULT 0,
    owner_name     VARCHAR(255),
    owner_cid      VARCHAR(100),
    owner_license  VARCHAR(255),
    notes          TEXT,
    status         VARCHAR(20)  NOT NULL DEFAULT 'owned',
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (property_id, guild_id)
);

CREATE INDEX IF NOT EXISTS idx_properties_guild_id ON properties(guild_id);
CREATE INDEX IF NOT EXISTS idx_properties_status   ON properties(guild_id, status);

-- Append-only audit trail for every action taken on a property
CREATE TABLE IF NOT EXISTS property_history (
    id               BIGSERIAL    PRIMARY KEY,
    guild_id         VARCHAR(20)  NOT NULL,
    property_id      VARCHAR(50)  NOT NULL,
    action           VARCHAR(30)  NOT NULL,   -- 'add' | 'transfer' | 'repo' | 'notes_update' | 'remove'
    performed_by_id  VARCHAR(20)  NOT NULL,   -- Discord user snowflake
    performed_by_tag VARCHAR(100) NOT NULL,   -- Discord username at time of action
    old_data         JSONB,                   -- full property snapshot before change (null on add)
    new_data         JSONB,                   -- full property snapshot after change (null on remove)
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_history_property ON property_history(guild_id, property_id);
CREATE INDEX IF NOT EXISTS idx_history_created  ON property_history(created_at DESC);

-- Migrations (safe to run repeatedly)
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS dashboard_password VARCHAR(255);

ALTER TABLE properties ALTER COLUMN address     DROP NOT NULL;
ALTER TABLE properties ALTER COLUMN address_type DROP NOT NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS postal        VARCHAR(20);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_tier VARCHAR(50);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS interior_type VARCHAR(100);
UPDATE properties SET status = 'repossessed' WHERE status = 'available';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS sold_by VARCHAR(255);
