-- GitHub Activity Stream Analyzer - Database Initialization
-- This script creates the necessary tables for storing GitHub event data

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Repository metrics table (time-series data)
CREATE TABLE IF NOT EXISTS repo_metrics (
    id SERIAL PRIMARY KEY,
    repo_id BIGINT NOT NULL,
    repo_name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    stars_delta INT DEFAULT 0,
    velocity_score FLOAT DEFAULT 0.0
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_repo_metrics_timestamp ON repo_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_repo_metrics_repo_id ON repo_metrics(repo_id);
CREATE INDEX IF NOT EXISTS idx_repo_metrics_event_type ON repo_metrics(event_type);
CREATE INDEX IF NOT EXISTS idx_repo_metrics_velocity ON repo_metrics(velocity_score DESC);

-- Composite index for trending queries
CREATE INDEX IF NOT EXISTS idx_repo_metrics_trending
ON repo_metrics(timestamp DESC, velocity_score DESC);

-- Repositories master table (slowly changing dimension)
CREATE TABLE IF NOT EXISTS repositories (
    repo_id BIGINT PRIMARY KEY,
    full_name TEXT NOT NULL,
    language TEXT,
    description TEXT,
    total_stars INT DEFAULT 0,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for repository queries
CREATE INDEX IF NOT EXISTS idx_repositories_language ON repositories(language);
CREATE INDEX IF NOT EXISTS idx_repositories_full_name ON repositories(full_name);
CREATE INDEX IF NOT EXISTS idx_repositories_stars ON repositories(total_stars DESC);

-- Language metrics table (aggregated by language)
CREATE TABLE IF NOT EXISTS language_metrics (
    id SERIAL PRIMARY KEY,
    language TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    active_repos INT DEFAULT 0,
    total_commits INT DEFAULT 0,
    total_stars_gained INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_language_metrics_language ON language_metrics(language);
CREATE INDEX IF NOT EXISTS idx_language_metrics_timestamp ON language_metrics(timestamp DESC);

-- User activity table (for tracking contributor patterns)
CREATE TABLE IF NOT EXISTS user_activity (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    username TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    event_type TEXT NOT NULL,
    repo_id BIGINT NOT NULL,
    contribution_count INT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_timestamp ON user_activity(timestamp DESC);

-- Alerts table (for user-defined notifications)
CREATE TABLE IF NOT EXISTS alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_email TEXT NOT NULL,
    webhook_url TEXT,
    criteria JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_triggered_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(is_active) WHERE is_active = TRUE;

-- Create a function to update last_updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for repositories table
DROP TRIGGER IF EXISTS update_repositories_updated_at ON repositories;
CREATE TRIGGER update_repositories_updated_at
    BEFORE UPDATE ON repositories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for testing (optional)
-- This helps verify the setup works correctly

-- Sample repositories
INSERT INTO repositories (repo_id, full_name, language, description, total_stars)
VALUES
    (1, 'facebook/react', 'JavaScript', 'A declarative, efficient, and flexible JavaScript library for building user interfaces.', 220000),
    (2, 'microsoft/vscode', 'TypeScript', 'Visual Studio Code', 156000),
    (3, 'torvalds/linux', 'C', 'Linux kernel source tree', 165000)
ON CONFLICT (repo_id) DO NOTHING;

-- Sample metrics
INSERT INTO repo_metrics (repo_id, repo_name, event_type, stars_delta, velocity_score)
VALUES
    (1, 'facebook/react', 'WatchEvent', 5, 1.2),
    (1, 'facebook/react', 'PushEvent', 0, 0.8),
    (2, 'microsoft/vscode', 'WatchEvent', 3, 0.9),
    (3, 'torvalds/linux', 'PushEvent', 0, 2.1)
ON CONFLICT DO NOTHING;

-- Grant permissions (adjust as needed for production)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Confirm setup
DO $$
BEGIN
    RAISE NOTICE 'Database initialization complete!';
    RAISE NOTICE 'Tables created: repo_metrics, repositories, language_metrics, user_activity, alerts';
END $$;
