-- cheMystry schema dump for E04-T03
-- Source of truth: src-tauri/src/adapters/storage/mod.rs (migrations 0001-0003)

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

CREATE TABLE IF NOT EXISTS scenario_run (
    id TEXT PRIMARY KEY CHECK (length(id) > 0),
    reaction_template_id TEXT,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    temperature_k REAL NOT NULL CHECK (temperature_k > 0),
    pressure_pa REAL NOT NULL CHECK (pressure_pa > 0),
    gas_medium TEXT NOT NULL CHECK (length(trim(gas_medium)) > 0),
    precision_profile TEXT NOT NULL CHECK (precision_profile IN ('balanced', 'high_precision', 'custom')),
    fps_limit INTEGER NOT NULL CHECK (fps_limit > 0),
    particle_limit INTEGER NOT NULL CHECK (particle_limit > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reaction_template_id) REFERENCES reaction_template(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS scenario_amount (
    id TEXT PRIMARY KEY CHECK (length(id) > 0),
    scenario_run_id TEXT NOT NULL,
    substance_id TEXT NOT NULL,
    amount_mol REAL CHECK (amount_mol IS NULL OR amount_mol > 0),
    mass_g REAL CHECK (mass_g IS NULL OR mass_g > 0),
    volume_l REAL CHECK (volume_l IS NULL OR volume_l > 0),
    concentration_mol_l REAL CHECK (concentration_mol_l IS NULL OR concentration_mol_l > 0),
    CHECK (
        amount_mol IS NOT NULL
        OR mass_g IS NOT NULL
        OR volume_l IS NOT NULL
        OR concentration_mol_l IS NOT NULL
    ),
    FOREIGN KEY (scenario_run_id) REFERENCES scenario_run(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (substance_id) REFERENCES substance(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    UNIQUE(scenario_run_id, substance_id)
);

CREATE TABLE IF NOT EXISTS simulation_frame_summary (
    id TEXT PRIMARY KEY CHECK (length(id) > 0),
    scenario_run_id TEXT NOT NULL,
    t_sim_s REAL NOT NULL CHECK (t_sim_s >= 0),
    key_metrics_json TEXT NOT NULL CHECK (length(trim(key_metrics_json)) > 0),
    FOREIGN KEY (scenario_run_id) REFERENCES scenario_run(id) ON UPDATE CASCADE ON DELETE CASCADE,
    UNIQUE(scenario_run_id, t_sim_s)
);

CREATE TABLE IF NOT EXISTS calculation_result (
    id TEXT PRIMARY KEY CHECK (length(id) > 0),
    scenario_run_id TEXT NOT NULL,
    result_type TEXT NOT NULL CHECK (
        result_type IN ('stoichiometry', 'limiting_reagent', 'yield', 'conversion', 'concentration')
    ),
    payload_json TEXT NOT NULL CHECK (length(trim(payload_json)) > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scenario_run_id) REFERENCES scenario_run(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS import_job (
    id TEXT PRIMARY KEY CHECK (length(id) > 0),
    format TEXT NOT NULL CHECK (format IN ('sdf_mol', 'smiles', 'xyz')),
    file_path TEXT NOT NULL CHECK (length(trim(file_path)) > 0),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
    warnings_json TEXT NOT NULL CHECK (length(trim(warnings_json)) > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reaction_species_substance_id
    ON reaction_species(substance_id);

CREATE INDEX IF NOT EXISTS idx_scenario_run_created_at
    ON scenario_run(created_at);

CREATE INDEX IF NOT EXISTS idx_scenario_amount_scenario_run_id
    ON scenario_amount(scenario_run_id);

CREATE INDEX IF NOT EXISTS idx_simulation_frame_summary_scenario_run_id
    ON simulation_frame_summary(scenario_run_id);

CREATE INDEX IF NOT EXISTS idx_calculation_result_scenario_run_id
    ON calculation_result(scenario_run_id);

CREATE INDEX IF NOT EXISTS idx_calculation_result_created_at
    ON calculation_result(created_at);

CREATE INDEX IF NOT EXISTS idx_import_job_created_at
    ON import_job(created_at);
