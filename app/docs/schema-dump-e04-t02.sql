-- cheMystry schema dump for E04-T02
-- Source of truth: src-tauri/src/adapters/storage/mod.rs (migrations 0001-0002)

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS substance (
    id TEXT PRIMARY KEY CHECK (length(id) > 0),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    formula TEXT NOT NULL CHECK (length(trim(formula)) > 0),
    smiles TEXT CHECK (smiles IS NULL OR length(trim(smiles)) > 0),
    molar_mass_g_mol REAL NOT NULL CHECK (molar_mass_g_mol > 0),
    phase_default TEXT NOT NULL CHECK (phase_default IN ('solid', 'liquid', 'gas', 'aqueous')),
    source_type TEXT NOT NULL CHECK (source_type IN ('builtin', 'imported', 'user_defined')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, formula)
);

CREATE TABLE IF NOT EXISTS reaction_template (
    id TEXT PRIMARY KEY CHECK (length(id) > 0),
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    reaction_class TEXT NOT NULL CHECK (
        reaction_class IN ('inorganic', 'acid_base', 'redox', 'organic_basic', 'equilibrium')
    ),
    equation_balanced TEXT NOT NULL CHECK (length(trim(equation_balanced)) > 0),
    description TEXT NOT NULL CHECK (length(trim(description)) > 0),
    is_preset INTEGER NOT NULL CHECK (is_preset IN (0, 1)),
    version INTEGER NOT NULL CHECK (version > 0),
    UNIQUE(title, version)
);

CREATE TABLE IF NOT EXISTS reaction_species (
    id TEXT PRIMARY KEY CHECK (length(id) > 0),
    reaction_template_id TEXT NOT NULL,
    substance_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('reactant', 'product', 'catalyst', 'inert')),
    stoich_coeff REAL NOT NULL CHECK (stoich_coeff > 0),
    FOREIGN KEY (reaction_template_id) REFERENCES reaction_template(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (substance_id) REFERENCES substance(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    UNIQUE(reaction_template_id, substance_id, role)
);

CREATE INDEX IF NOT EXISTS idx_reaction_species_substance_id
    ON reaction_species(substance_id);
