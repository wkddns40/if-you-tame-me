-- Migration 002: Vector similarity search function for RAG
-- Run this in Supabase SQL Editor after 001_init.sql

CREATE OR REPLACE FUNCTION match_chat_logs(
    query_embedding vector(1536),
    target_companion_id UUID,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    log_id BIGINT,
    companion_id UUID,
    sender VARCHAR(10),
    message TEXT,
    similarity FLOAT
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
        1 - (cl.embedding <=> query_embedding) AS similarity
    FROM public."Chat_Logs" cl
    WHERE cl.companion_id = target_companion_id
      AND cl.embedding IS NOT NULL
    ORDER BY cl.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
