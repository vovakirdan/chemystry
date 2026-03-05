use std::collections::BTreeMap;
use std::fmt::{Display, Formatter};

const MOLAR_MASS_PRECISION_SCALE: f64 = 100_000.0;
const CONFIDENCE_PRECISION_SCALE: f64 = 10_000.0;
const BOND_DISTANCE_FACTOR: f64 = 1.25;
const BOND_CONFIDENCE_WINDOW: f64 = 0.35;
const MIN_BOND_DISTANCE_ANGSTROM: f64 = 0.35;
const DEFAULT_COVALENT_RADIUS_ANGSTROM: f64 = 0.77;
const MAX_XYZ_ATOMS_PER_RECORD: usize = 2_000;

const ELEMENT_MOLAR_MASSES: &[(&str, f64)] = &[
    ("H", 1.00794),
    ("He", 4.002602),
    ("Li", 6.941),
    ("Be", 9.012182),
    ("B", 10.811),
    ("C", 12.0107),
    ("N", 14.0067),
    ("O", 15.9994),
    ("F", 18.9984032),
    ("Ne", 20.1797),
    ("Na", 22.98976928),
    ("Mg", 24.305),
    ("Al", 26.9815386),
    ("Si", 28.0855),
    ("P", 30.973762),
    ("S", 32.065),
    ("Cl", 35.453),
    ("Ar", 39.948),
    ("K", 39.0983),
    ("Ca", 40.078),
    ("Sc", 44.955912),
    ("Ti", 47.867),
    ("V", 50.9415),
    ("Cr", 51.9961),
    ("Mn", 54.938045),
    ("Fe", 55.845),
    ("Co", 58.933195),
    ("Ni", 58.6934),
    ("Cu", 63.546),
    ("Zn", 65.38),
    ("Ga", 69.723),
    ("Ge", 72.64),
    ("As", 74.9216),
    ("Se", 78.96),
    ("Br", 79.904),
    ("Kr", 83.798),
    ("Rb", 85.4678),
    ("Sr", 87.62),
    ("Y", 88.90585),
    ("Zr", 91.224),
    ("Nb", 92.90638),
    ("Mo", 95.96),
    ("Tc", 98.0),
    ("Ru", 101.07),
    ("Rh", 102.9055),
    ("Pd", 106.42),
    ("Ag", 107.8682),
    ("Cd", 112.411),
    ("In", 114.818),
    ("Sn", 118.71),
    ("Sb", 121.76),
    ("Te", 127.6),
    ("I", 126.90447),
    ("Xe", 131.293),
    ("Cs", 132.9054519),
    ("Ba", 137.327),
    ("La", 138.90547),
    ("Ce", 140.116),
    ("Pr", 140.90765),
    ("Nd", 144.242),
    ("Pm", 145.0),
    ("Sm", 150.36),
    ("Eu", 151.964),
    ("Gd", 157.25),
    ("Tb", 158.92535),
    ("Dy", 162.5),
    ("Ho", 164.93032),
    ("Er", 167.259),
    ("Tm", 168.93421),
    ("Yb", 173.054),
    ("Lu", 174.9668),
    ("Hf", 178.49),
    ("Ta", 180.94788),
    ("W", 183.84),
    ("Re", 186.207),
    ("Os", 190.23),
    ("Ir", 192.217),
    ("Pt", 195.084),
    ("Au", 196.966569),
    ("Hg", 200.59),
    ("Tl", 204.3833),
    ("Pb", 207.2),
    ("Bi", 208.9804),
    ("Po", 209.0),
    ("At", 210.0),
    ("Rn", 222.0),
    ("Fr", 223.0),
    ("Ra", 226.0),
    ("Ac", 227.0),
    ("Th", 232.03806),
    ("Pa", 231.03588),
    ("U", 238.02891),
    ("Np", 237.0),
    ("Pu", 244.0),
    ("Am", 243.0),
    ("Cm", 247.0),
    ("Bk", 247.0),
    ("Cf", 251.0),
    ("Es", 252.0),
    ("Fm", 257.0),
    ("Md", 258.0),
    ("No", 259.0),
    ("Lr", 262.0),
    ("Rf", 267.0),
    ("Db", 268.0),
    ("Sg", 271.0),
    ("Bh", 272.0),
    ("Hs", 270.0),
    ("Mt", 276.0),
    ("Ds", 281.0),
    ("Rg", 280.0),
    ("Cn", 285.0),
    ("Nh", 286.0),
    ("Fl", 289.0),
    ("Mc", 290.0),
    ("Lv", 293.0),
    ("Ts", 294.0),
    ("Og", 294.0),
];

const COVALENT_RADII_ANGSTROM: &[(&str, f64)] = &[
    ("H", 0.31),
    ("He", 0.28),
    ("Li", 1.28),
    ("Be", 0.96),
    ("B", 0.84),
    ("C", 0.76),
    ("N", 0.71),
    ("O", 0.66),
    ("F", 0.57),
    ("Ne", 0.58),
    ("Na", 1.66),
    ("Mg", 1.41),
    ("Al", 1.21),
    ("Si", 1.11),
    ("P", 1.07),
    ("S", 1.05),
    ("Cl", 1.02),
    ("Ar", 1.06),
    ("K", 2.03),
    ("Ca", 1.76),
    ("Sc", 1.70),
    ("Ti", 1.60),
    ("V", 1.53),
    ("Cr", 1.39),
    ("Mn", 1.39),
    ("Fe", 1.32),
    ("Co", 1.26),
    ("Ni", 1.24),
    ("Cu", 1.32),
    ("Zn", 1.22),
    ("Ga", 1.22),
    ("Ge", 1.20),
    ("As", 1.19),
    ("Se", 1.20),
    ("Br", 1.20),
    ("Kr", 1.16),
    ("Rb", 2.20),
    ("Sr", 1.95),
    ("Y", 1.90),
    ("Zr", 1.75),
    ("Nb", 1.64),
    ("Mo", 1.54),
    ("Tc", 1.47),
    ("Ru", 1.46),
    ("Rh", 1.42),
    ("Pd", 1.39),
    ("Ag", 1.45),
    ("Cd", 1.44),
    ("In", 1.42),
    ("Sn", 1.39),
    ("Sb", 1.39),
    ("Te", 1.38),
    ("I", 1.39),
    ("Xe", 1.40),
    ("Cs", 2.44),
    ("Ba", 2.15),
    ("La", 2.07),
    ("Ce", 2.04),
    ("Pr", 2.03),
    ("Nd", 2.01),
    ("Pm", 1.99),
    ("Sm", 1.98),
    ("Eu", 1.98),
    ("Gd", 1.96),
    ("Tb", 1.94),
    ("Dy", 1.92),
    ("Ho", 1.92),
    ("Er", 1.89),
    ("Tm", 1.90),
    ("Yb", 1.87),
    ("Lu", 1.87),
    ("Hf", 1.75),
    ("Ta", 1.70),
    ("W", 1.62),
    ("Re", 1.51),
    ("Os", 1.44),
    ("Ir", 1.41),
    ("Pt", 1.36),
    ("Au", 1.36),
    ("Hg", 1.32),
    ("Tl", 1.45),
    ("Pb", 1.46),
    ("Bi", 1.48),
    ("Po", 1.40),
    ("At", 1.50),
    ("Rn", 1.50),
];

#[derive(Debug, Clone, PartialEq)]
pub struct ParsedXyzAtom {
    pub atom_index: usize,
    pub symbol: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct InferredXyzBond {
    pub atom_index_a: usize,
    pub atom_index_b: usize,
    pub distance_angstrom: f64,
    pub confidence: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct XyzInferenceSummary {
    pub record_index: usize,
    pub inferred_bond_count: usize,
    pub avg_confidence: f64,
    pub min_confidence: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ParsedXyzSubstance {
    pub record_index: usize,
    pub name: String,
    pub formula: String,
    pub molar_mass_g_mol: f64,
    pub atoms: Vec<ParsedXyzAtom>,
    pub inferred_bonds: Vec<InferredXyzBond>,
    pub inference_summary: XyzInferenceSummary,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct XyzParseError {
    pub code: &'static str,
    pub file_name: String,
    pub record_index: Option<usize>,
    pub line_number: Option<usize>,
    pub message: String,
}

impl XyzParseError {
    fn new(
        code: &'static str,
        file_name: impl Into<String>,
        record_index: Option<usize>,
        line_number: Option<usize>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            code,
            file_name: file_name.into(),
            record_index,
            line_number,
            message: message.into(),
        }
    }

    pub fn with_context_message(&self) -> String {
        let mut context_parts = vec![format!("file={}", self.file_name)];
        if let Some(record_index) = self.record_index {
            context_parts.push(format!("record={record_index}"));
        }
        if let Some(line_number) = self.line_number {
            context_parts.push(format!("line={line_number}"));
        }

        format!("{} ({})", self.message, context_parts.join(", "))
    }
}

impl Display for XyzParseError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.with_context_message())
    }
}

pub fn parse_xyz(
    file_name: &str,
    contents: &str,
) -> Result<Vec<ParsedXyzSubstance>, XyzParseError> {
    let normalized_file_name = file_name.trim();

    if normalized_file_name.is_empty() {
        return Err(XyzParseError::new(
            "IMPORT_FILE_NAME_REQUIRED",
            "<unknown>",
            None,
            None,
            "File name is required for XYZ import.",
        ));
    }

    if contents.trim().is_empty() {
        return Err(XyzParseError::new(
            "IMPORT_FILE_EMPTY",
            normalized_file_name,
            None,
            Some(1),
            "Import file is empty.",
        ));
    }

    let lines: Vec<&str> = contents.lines().collect();
    if lines.is_empty() {
        return Err(XyzParseError::new(
            "IMPORT_FILE_EMPTY",
            normalized_file_name,
            None,
            Some(1),
            "Import file is empty.",
        ));
    }

    let mut cursor = 0usize;
    let mut record_index = 0usize;
    let mut parsed_records = Vec::new();

    while cursor < lines.len() {
        while cursor < lines.len() && lines[cursor].trim().is_empty() {
            cursor += 1;
        }
        if cursor >= lines.len() {
            break;
        }

        record_index += 1;
        let header_line_number = cursor.saturating_add(1);
        let atom_count_line = lines[cursor].trim();

        let atom_count = parse_atom_count(atom_count_line).ok_or_else(|| {
            record_error(
                normalized_file_name,
                record_index,
                header_line_number,
                "IMPORT_XYZ_ATOM_COUNT_INVALID",
                "XYZ atom count line must contain a positive integer.",
            )
        })?;

        if atom_count == 0 {
            return Err(record_error(
                normalized_file_name,
                record_index,
                header_line_number,
                "IMPORT_XYZ_ATOM_COUNT_INVALID",
                "XYZ atom count must be greater than 0.",
            ));
        }

        if atom_count > MAX_XYZ_ATOMS_PER_RECORD {
            return Err(record_error(
                normalized_file_name,
                record_index,
                header_line_number,
                "IMPORT_XYZ_ATOM_COUNT_TOO_LARGE",
                format!(
                    "XYZ atom count exceeds the maximum supported atoms per record ({MAX_XYZ_ATOMS_PER_RECORD})."
                ),
            ));
        }

        let Some(title_line) = lines.get(cursor + 1) else {
            return Err(record_error(
                normalized_file_name,
                record_index,
                header_line_number.saturating_add(1),
                "IMPORT_XYZ_TITLE_MISSING",
                "XYZ record is missing the mandatory title/comment line.",
            ));
        };

        let atom_block_start = cursor.saturating_add(2);
        let Some(atom_block_end) = atom_block_start.checked_add(atom_count) else {
            return Err(record_error(
                normalized_file_name,
                record_index,
                header_line_number,
                "IMPORT_XYZ_ATOM_COUNT_TOO_LARGE",
                "XYZ atom count is too large to process safely.",
            ));
        };

        let Some(atom_lines) = lines.get(atom_block_start..atom_block_end) else {
            return Err(record_error(
                normalized_file_name,
                record_index,
                atom_block_start.saturating_add(1),
                "IMPORT_XYZ_RECORD_TRUNCATED",
                "XYZ atom block is truncated and does not match the declared atom count.",
            ));
        };

        let mut atoms = Vec::with_capacity(atom_count);
        let mut atom_counts: BTreeMap<String, usize> = BTreeMap::new();
        let mut molar_mass_g_mol = 0.0;

        for (atom_offset, atom_line) in atom_lines.iter().enumerate() {
            let line_number = atom_block_start
                .saturating_add(atom_offset)
                .saturating_add(1);
            let parsed_atom = parse_atom_line(
                normalized_file_name,
                record_index,
                line_number,
                atom_offset + 1,
                atom_line,
            )?;

            let entry = atom_counts
                .entry(parsed_atom.symbol.clone())
                .or_insert(0usize);
            *entry = entry.checked_add(1).ok_or_else(|| {
                record_error(
                    normalized_file_name,
                    record_index,
                    line_number,
                    "IMPORT_XYZ_ATOM_COUNT_TOO_LARGE",
                    "XYZ atom count is too large to process safely.",
                )
            })?;

            let atomic_mass = element_molar_mass(&parsed_atom.symbol).ok_or_else(|| {
                record_error(
                    normalized_file_name,
                    record_index,
                    line_number,
                    "IMPORT_UNKNOWN_ELEMENT",
                    format!("Unknown element symbol `{}`.", parsed_atom.symbol),
                )
            })?;
            molar_mass_g_mol += atomic_mass;

            atoms.push(parsed_atom);
        }

        let inferred_bonds = infer_bonds(&atoms);
        let inference_summary = summarize_inference(record_index, &inferred_bonds);
        let raw_title = title_line.trim();
        let name = if raw_title.is_empty() {
            format!("Imported XYZ record {record_index}")
        } else {
            raw_title.to_string()
        };

        parsed_records.push(ParsedXyzSubstance {
            record_index,
            name,
            formula: format_formula(&atom_counts),
            molar_mass_g_mol: round_molar_mass(molar_mass_g_mol),
            atoms,
            inferred_bonds,
            inference_summary,
        });

        cursor = atom_block_end;
    }

    if parsed_records.is_empty() {
        return Err(XyzParseError::new(
            "IMPORT_RECORDS_NOT_FOUND",
            normalized_file_name,
            None,
            Some(1),
            "No XYZ records were found in the import file.",
        ));
    }

    Ok(parsed_records)
}

fn parse_atom_count(line: &str) -> Option<usize> {
    let mut tokens = line.split_whitespace();
    let atom_count = tokens.next()?.parse::<usize>().ok()?;
    if tokens.next().is_some() {
        return None;
    }

    Some(atom_count)
}

fn parse_atom_line(
    file_name: &str,
    record_index: usize,
    line_number: usize,
    atom_index: usize,
    line: &str,
) -> Result<ParsedXyzAtom, XyzParseError> {
    let mut tokens = line.split_whitespace();

    let Some(raw_symbol) = tokens.next() else {
        return Err(record_error(
            file_name,
            record_index,
            line_number,
            "IMPORT_XYZ_ATOM_LINE_INVALID",
            "XYZ atom line must contain `<symbol> <x> <y> <z>`.",
        ));
    };

    let Some(raw_x) = tokens.next() else {
        return Err(record_error(
            file_name,
            record_index,
            line_number,
            "IMPORT_XYZ_ATOM_LINE_INVALID",
            "XYZ atom line must contain `<symbol> <x> <y> <z>`.",
        ));
    };
    let Some(raw_y) = tokens.next() else {
        return Err(record_error(
            file_name,
            record_index,
            line_number,
            "IMPORT_XYZ_ATOM_LINE_INVALID",
            "XYZ atom line must contain `<symbol> <x> <y> <z>`.",
        ));
    };
    let Some(raw_z) = tokens.next() else {
        return Err(record_error(
            file_name,
            record_index,
            line_number,
            "IMPORT_XYZ_ATOM_LINE_INVALID",
            "XYZ atom line must contain `<symbol> <x> <y> <z>`.",
        ));
    };

    let symbol = normalize_element_symbol(raw_symbol).ok_or_else(|| {
        record_error(
            file_name,
            record_index,
            line_number,
            "IMPORT_XYZ_ATOM_SYMBOL_INVALID",
            format!("Failed to parse atom symbol `{raw_symbol}` in XYZ atom line."),
        )
    })?;

    if element_molar_mass(&symbol).is_none() {
        return Err(record_error(
            file_name,
            record_index,
            line_number,
            "IMPORT_UNKNOWN_ELEMENT",
            format!("Unknown element symbol `{symbol}`."),
        ));
    }

    let x = parse_coordinate(file_name, record_index, line_number, raw_x, "x")?;
    let y = parse_coordinate(file_name, record_index, line_number, raw_y, "y")?;
    let z = parse_coordinate(file_name, record_index, line_number, raw_z, "z")?;

    Ok(ParsedXyzAtom {
        atom_index,
        symbol,
        x,
        y,
        z,
    })
}

fn parse_coordinate(
    file_name: &str,
    record_index: usize,
    line_number: usize,
    raw: &str,
    axis: &str,
) -> Result<f64, XyzParseError> {
    let parsed = raw.parse::<f64>().map_err(|_| {
        record_error(
            file_name,
            record_index,
            line_number,
            "IMPORT_XYZ_COORDINATE_INVALID",
            format!("Failed to parse `{axis}` coordinate value `{raw}` in XYZ atom line."),
        )
    })?;

    if !parsed.is_finite() {
        return Err(record_error(
            file_name,
            record_index,
            line_number,
            "IMPORT_XYZ_COORDINATE_INVALID",
            format!("Coordinate `{axis}` must be a finite number."),
        ));
    }

    Ok(parsed)
}

fn infer_bonds(atoms: &[ParsedXyzAtom]) -> Vec<InferredXyzBond> {
    let mut inferred = Vec::new();

    for (left_index, left_atom) in atoms.iter().enumerate() {
        for (right_index, right_atom) in atoms.iter().enumerate().skip(left_index + 1) {
            let radius_left = element_covalent_radius(&left_atom.symbol);
            let radius_right = element_covalent_radius(&right_atom.symbol);
            let radius_sum = radius_left + radius_right;
            if radius_sum <= 0.0 {
                continue;
            }

            let distance = distance_angstrom(left_atom, right_atom);
            if distance < MIN_BOND_DISTANCE_ANGSTROM {
                continue;
            }

            let threshold = radius_sum * BOND_DISTANCE_FACTOR;
            if distance > threshold {
                continue;
            }

            let normalized_distance = distance / radius_sum;
            let confidence =
                clamp01(1.0 - ((normalized_distance - 1.0).abs() / BOND_CONFIDENCE_WINDOW));

            inferred.push(InferredXyzBond {
                atom_index_a: left_index + 1,
                atom_index_b: right_index + 1,
                distance_angstrom: distance,
                confidence: round_confidence(confidence),
            });
        }
    }

    inferred
}

fn summarize_inference(
    record_index: usize,
    inferred_bonds: &[InferredXyzBond],
) -> XyzInferenceSummary {
    if inferred_bonds.is_empty() {
        return XyzInferenceSummary {
            record_index,
            inferred_bond_count: 0,
            avg_confidence: 0.0,
            min_confidence: 0.0,
        };
    }

    let mut sum_confidence = 0.0;
    let mut min_confidence = 1.0;
    for bond in inferred_bonds {
        sum_confidence += bond.confidence;
        if bond.confidence < min_confidence {
            min_confidence = bond.confidence;
        }
    }

    XyzInferenceSummary {
        record_index,
        inferred_bond_count: inferred_bonds.len(),
        avg_confidence: round_confidence(sum_confidence / inferred_bonds.len() as f64),
        min_confidence: round_confidence(min_confidence),
    }
}

fn distance_angstrom(left: &ParsedXyzAtom, right: &ParsedXyzAtom) -> f64 {
    let dx = left.x - right.x;
    let dy = left.y - right.y;
    let dz = left.z - right.z;
    (dx * dx + dy * dy + dz * dz).sqrt()
}

fn normalize_element_symbol(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    let mut chars = trimmed.chars();
    let first = chars.next()?;
    if !first.is_ascii_alphabetic() {
        return None;
    }

    let mut normalized = String::new();
    normalized.push(first.to_ascii_uppercase());

    for ch in chars {
        if !ch.is_ascii_alphabetic() {
            return None;
        }
        normalized.push(ch.to_ascii_lowercase());
    }

    Some(normalized)
}

fn element_molar_mass(symbol: &str) -> Option<f64> {
    ELEMENT_MOLAR_MASSES
        .iter()
        .find(|(candidate, _)| *candidate == symbol)
        .map(|(_, mass)| *mass)
}

fn element_covalent_radius(symbol: &str) -> f64 {
    COVALENT_RADII_ANGSTROM
        .iter()
        .find(|(candidate, _)| *candidate == symbol)
        .map(|(_, radius)| *radius)
        .unwrap_or(DEFAULT_COVALENT_RADIUS_ANGSTROM)
}

fn format_formula(atom_counts: &BTreeMap<String, usize>) -> String {
    let mut parts = Vec::new();

    if let Some(&count) = atom_counts.get("C") {
        parts.push(formula_part("C", count));
    }

    if atom_counts.contains_key("C") {
        if let Some(&count) = atom_counts.get("H") {
            parts.push(formula_part("H", count));
        }
    }

    for (symbol, count) in atom_counts {
        if symbol == "C" || (symbol == "H" && atom_counts.contains_key("C")) {
            continue;
        }

        parts.push(formula_part(symbol, *count));
    }

    parts.join("")
}

fn formula_part(symbol: &str, count: usize) -> String {
    if count == 1 {
        symbol.to_string()
    } else {
        format!("{symbol}{count}")
    }
}

fn round_molar_mass(value: f64) -> f64 {
    (value * MOLAR_MASS_PRECISION_SCALE).round() / MOLAR_MASS_PRECISION_SCALE
}

fn round_confidence(value: f64) -> f64 {
    (value * CONFIDENCE_PRECISION_SCALE).round() / CONFIDENCE_PRECISION_SCALE
}

fn clamp01(value: f64) -> f64 {
    value.clamp(0.0, 1.0)
}

fn record_error(
    file_name: &str,
    record_index: usize,
    line_number: usize,
    code: &'static str,
    message: impl Into<String>,
) -> XyzParseError {
    XyzParseError::new(
        code,
        file_name,
        Some(record_index),
        Some(line_number),
        message,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_valid_xyz_with_inference_summary_in_range() {
        let contents = "3
Water
O 0.0000 0.0000 0.0000
H 0.7570 0.5860 0.0000
H -0.7570 0.5860 0.0000
";

        let parsed = parse_xyz("water.xyz", contents).expect("valid XYZ must parse");
        assert_eq!(parsed.len(), 1);

        let record = &parsed[0];
        assert_eq!(record.record_index, 1);
        assert_eq!(record.name, "Water");
        assert_eq!(record.formula, "H2O");
        assert!((record.molar_mass_g_mol - 18.01528).abs() < 0.0001);
        assert_eq!(record.atoms.len(), 3);
        assert_eq!(record.inference_summary.inferred_bond_count, 2);
        assert!(record.inference_summary.avg_confidence >= 0.0);
        assert!(record.inference_summary.avg_confidence <= 1.0);
        assert!(record.inference_summary.min_confidence >= 0.0);
        assert!(record.inference_summary.min_confidence <= 1.0);
        assert!(record
            .inferred_bonds
            .iter()
            .all(|bond| bond.confidence >= 0.0 && bond.confidence <= 1.0));
    }

    #[test]
    fn returns_contextual_error_for_invalid_xyz_structure() {
        let contents = "2
Broken
C 0.0 0.0
H 0.0 0.0 1.0
";

        let error = parse_xyz("broken.xyz", contents).expect_err("invalid atom line should fail");
        assert_eq!(error.code, "IMPORT_XYZ_ATOM_LINE_INVALID");
        assert_eq!(error.file_name, "broken.xyz");
        assert_eq!(error.record_index, Some(1));
        assert_eq!(error.line_number, Some(3));
        assert!(error.with_context_message().contains("file=broken.xyz"));
        assert!(error.with_context_message().contains("record=1"));
        assert!(error.with_context_message().contains("line=3"));
    }

    #[test]
    fn returns_contextual_error_when_atom_count_exceeds_limit() {
        let contents = format!(
            "{}
Too many atoms
",
            MAX_XYZ_ATOMS_PER_RECORD + 1
        );

        let error = parse_xyz("oversized.xyz", &contents).expect_err("oversized record must fail");
        assert_eq!(error.code, "IMPORT_XYZ_ATOM_COUNT_TOO_LARGE");
        assert_eq!(error.file_name, "oversized.xyz");
        assert_eq!(error.record_index, Some(1));
        assert_eq!(error.line_number, Some(1));
        assert!(error.with_context_message().contains("file=oversized.xyz"));
        assert!(error.with_context_message().contains("record=1"));
        assert!(error.with_context_message().contains("line=1"));
    }

    #[test]
    fn parses_multiple_xyz_records_from_single_file() {
        let contents = "3
Water
O 0.0000 0.0000 0.0000
H 0.7570 0.5860 0.0000
H -0.7570 0.5860 0.0000

5
Methane
C 0.0000 0.0000 0.0000
H 0.6291 0.6291 0.6291
H -0.6291 -0.6291 0.6291
H -0.6291 0.6291 -0.6291
H 0.6291 -0.6291 -0.6291
";

        let parsed = parse_xyz("bundle.xyz", contents).expect("multi-record XYZ should parse");

        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].record_index, 1);
        assert_eq!(parsed[0].name, "Water");
        assert_eq!(parsed[0].formula, "H2O");
        assert_eq!(parsed[1].record_index, 2);
        assert_eq!(parsed[1].name, "Methane");
        assert_eq!(parsed[1].formula, "CH4");
    }
}
