-- phase10_interactive_artifacts.sql
-- Adds support for interactive diagram hotspots as per Interactive Artifacts Spec

CREATE TABLE IF NOT EXISTS diagram_hotspots (
    id BIGSERIAL PRIMARY KEY,
    diagram_id BIGINT NOT NULL, -- references the Phase 3 diagram record, which we assume will be created as 'diagrams'
    part_label TEXT NOT NULL,
    x_pct FLOAT NOT NULL,
    y_pct FLOAT NOT NULL,
    explanation TEXT NOT NULL,
    confidence TEXT NOT NULL CHECK (confidence IN ('high', 'low')),
    reviewed BOOLEAN NOT NULL DEFAULT false
);

-- We don't enforce a hard foreign key on diagram_id to 'diagrams' table yet 
-- just in case the diagrams table definition from Phase 3 is slightly different, 
-- but ideally it should refer to diagrams(id).
-- ALTER TABLE diagram_hotspots ADD CONSTRAINT fk_diagram FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE;
