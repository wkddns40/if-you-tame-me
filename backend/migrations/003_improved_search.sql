-- Migration 003: Improved search functions for RAG long-term memory
-- Run this in Supabase SQL Editor after 002_match_chat_logs.sql

-- Recency-weighted semantic search
-- Formula: final_score = similarity * (0.7 + 0.3 * exp(-age_days / 30))
-- Old messages keep 70% of similarity score; recent messages get up to 30% boost
CREATE OR REPLACE FUNCTION match_chat_logs_v2(
    query_embedding vector(1536),
    target_companion_id UUID,
    match_count INT DEFAULT 8
)
RETURNS TABLE (
    log_id BIGINT,
    companion_id UUID,
    sender VARCHAR(10),
    message TEXT,
    similarity FLOAT,
    created_at TIMESTAMPTZ,
    final_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cl.log_id,
        cl.companion_id,
        cl.sender,
        cl.message,
        (1 - (cl.embedding <=> query_embedding))::FLOAT AS similarity,
        cl.timestamp AS created_at,
        (
            (1 - (cl.embedding <=> query_embedding))
            * (0.7 + 0.3 * exp(-EXTRACT(EPOCH FROM (now() - cl.timestamp)) / 86400.0 / 30.0))
        )::FLOAT AS final_score
    FROM public."Chat_Logs" cl
    WHERE cl.companion_id = target_companion_id
      AND cl.embedding IS NOT NULL
    ORDER BY final_score DESC
    LIMIT match_count;
END;
$$;

-- Fetch most recent N messages by timestamp (no embedding needed)
-- For conversational continuity
CREATE OR REPLACE FUNCTION get_recent_chat_logs(
    target_companion_id UUID,
    msg_count INT DEFAULT 6
)
RETURNS TABLE (
    log_id BIGINT,
    companion_id UUID,
    sender VARCHAR(10),
    message TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cl.log_id,
        cl.companion_id,
        cl.sender,
        cl.message,
        cl.timestamp AS created_at
    FROM public."Chat_Logs" cl
    WHERE cl.companion_id = target_companion_id
    ORDER BY cl.timestamp DESC
    LIMIT msg_count;
END;
$$;
