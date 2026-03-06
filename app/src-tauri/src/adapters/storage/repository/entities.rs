#[derive(Debug, Clone, PartialEq)]
pub struct Substance {
    pub id: String,
    pub name: String,
    pub formula: String,
    pub smiles: Option<String>,
    pub molar_mass_g_mol: f64,
    pub phase_default: String,
    pub source_type: String,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct NewSubstance {
    pub id: String,
    pub name: String,
    pub formula: String,
    pub smiles: Option<String>,
    pub molar_mass_g_mol: f64,
    pub phase_default: String,
    pub source_type: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct UpdateSubstance {
    pub name: String,
    pub formula: String,
    pub smiles: Option<String>,
    pub molar_mass_g_mol: f64,
    pub phase_default: String,
    pub source_type: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ReactionTemplate {
    pub id: String,
    pub title: String,
    pub reaction_class: String,
    pub equation_balanced: String,
    pub description: String,
    pub is_preset: bool,
    pub version: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct NewReactionTemplate {
    pub id: String,
    pub title: String,
    pub reaction_class: String,
    pub equation_balanced: String,
    pub description: String,
    pub is_preset: bool,
    pub version: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct UpdateReactionTemplate {
    pub title: String,
    pub reaction_class: String,
    pub equation_balanced: String,
    pub description: String,
    pub is_preset: bool,
    pub version: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ScenarioRun {
    pub id: String,
    pub reaction_template_id: Option<String>,
    pub name: String,
    pub temperature_k: f64,
    pub pressure_pa: f64,
    pub gas_medium: String,
    pub precision_profile: String,
    pub fps_limit: i64,
    pub particle_limit: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct NewScenarioRun {
    pub id: String,
    pub reaction_template_id: Option<String>,
    pub name: String,
    pub temperature_k: f64,
    pub pressure_pa: f64,
    pub gas_medium: String,
    pub precision_profile: String,
    pub fps_limit: i64,
    pub particle_limit: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct UpdateScenarioRun {
    pub reaction_template_id: Option<String>,
    pub name: String,
    pub temperature_k: f64,
    pub pressure_pa: f64,
    pub gas_medium: String,
    pub precision_profile: String,
    pub fps_limit: i64,
    pub particle_limit: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct ScenarioAmountRecord {
    pub(super) substance_id: String,
    pub(super) amount_mol: Option<f64>,
    pub(super) mass_g: Option<f64>,
    pub(super) volume_l: Option<f64>,
    pub(super) concentration_mol_l: Option<f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct CalculationResultRecord {
    pub(super) result_type: String,
    pub(super) payload_json: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SeedReport {
    pub substances_processed: usize,
    pub reaction_templates_processed: usize,
    pub reaction_species_processed: usize,
}
