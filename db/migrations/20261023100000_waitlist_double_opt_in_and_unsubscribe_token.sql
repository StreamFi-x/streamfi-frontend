-- #1727, #1728: waitlist double opt-in confirmation and token-verified unsubscribe.
CREATE TABLE IF NOT EXISTS subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    confirmation_token VARCHAR(128),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    unsubscribe_token VARCHAR(128),
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS confirmation_token VARCHAR(128);
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(128);

CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    confirmation_token VARCHAR(128),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    unsubscribe_token VARCHAR(128),
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS confirmation_token VARCHAR(128);
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(128);
