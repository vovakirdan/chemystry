use std::collections::BTreeMap;
use std::fmt::{Display, Formatter};

const MOL_HEADER_LINE_COUNT: usize = 4;
const MOL_ATOM_BLOCK_START_LINE: usize = 4;
const MOL_ATOM_SYMBOL_COLUMN_START: usize = 31;
const MOL_ATOM_SYMBOL_COLUMN_END: usize = 34;
const MOLAR_MASS_PRECISION_SCALE: f64 = 100_000.0;

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

#[derive(Debug, Clone, PartialEq)]
pub struct ParsedSdfMolSubstance {
    pub record_index: usize,
    pub name: String,
    pub formula: String,
    pub molar_mass_g_mol: f64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SdfMolParseError {
    pub code: &'static str,
    pub file_name: String,
    pub record_index: Option<usize>,
    pub line_number: Option<usize>,
    pub message: String,
}

impl SdfMolParseError {
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

impl Display for SdfMolParseError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.with_context_message())
    }
}

pub fn parse_sdf_mol(
    file_name: &str,
    contents: &str,
) -> Result<Vec<ParsedSdfMolSubstance>, SdfMolParseError> {
    let normalized_file_name = file_name.trim();

    if normalized_file_name.is_empty() {
        return Err(SdfMolParseError::new(
            "IMPORT_FILE_NAME_REQUIRED",
            "<unknown>",
            None,
            None,
            "File name is required for SDF/MOL import.",
        ));
    }

    if contents.trim().is_empty() {
        return Err(SdfMolParseError::new(
            "IMPORT_FILE_EMPTY",
            normalized_file_name,
            None,
            Some(1),
            "Import file is empty.",
        ));
    }

    let lines: Vec<&str> = contents.lines().collect();
    if lines.is_empty() {
        return Err(SdfMolParseError::new(
            "IMPORT_FILE_EMPTY",
            normalized_file_name,
            None,
            Some(1),
            "Import file is empty.",
        ));
    }

    let mut ranges = Vec::new();
    let mut range_start = 0usize;
    for (line_index, line) in lines.iter().enumerate() {
        if line.trim() == "$$$$" {
            ranges.push((range_start, line_index));
            range_start = line_index + 1;
        }
    }
    if range_start < lines.len() {
        ranges.push((range_start, lines.len()));
    }
    if ranges.is_empty() {
        ranges.push((0, lines.len()));
    }

    let mut parsed_substances = Vec::new();

    for (record_offset, (start, end)) in ranges.into_iter().enumerate() {
        let record_lines = &lines[start..end];
        if record_lines.iter().all(|line| line.trim().is_empty()) {
            continue;
        }

        parsed_substances.push(parse_mol_record(
            normalized_file_name,
            record_offset + 1,
            start,
            record_lines,
        )?);
    }

    if parsed_substances.is_empty() {
        return Err(SdfMolParseError::new(
            "IMPORT_RECORDS_NOT_FOUND",
            normalized_file_name,
            None,
            Some(1),
            "No MOL records were found in the import file.",
        ));
    }

    Ok(parsed_substances)
}

fn parse_mol_record(
    file_name: &str,
    record_index: usize,
    record_start_line: usize,
    record_lines: &[&str],
) -> Result<ParsedSdfMolSubstance, SdfMolParseError> {
    if record_lines.len() < MOL_HEADER_LINE_COUNT {
        return Err(record_error(
            file_name,
            record_index,
            record_start_line,
            "IMPORT_MOL_HEADER_INCOMPLETE",
            "MOL header is incomplete: at least 4 lines are required.",
        ));
    }

    let atom_count = parse_atom_count(record_lines[3]).ok_or_else(|| {
        record_error(
            file_name,
            record_index,
            record_start_line.saturating_add(3),
            "IMPORT_MOL_COUNTS_INVALID",
            "Failed to parse atom count from MOL counts line.",
        )
    })?;

    if atom_count == 0 {
        return Err(record_error(
            file_name,
            record_index,
            record_start_line.saturating_add(3),
            "IMPORT_MOL_ATOM_BLOCK_EMPTY",
            "MOL atom block must contain at least one atom.",
        ));
    }

    let Some(atom_block_end) = MOL_ATOM_BLOCK_START_LINE.checked_add(atom_count) else {
        return Err(record_error(
            file_name,
            record_index,
            record_start_line.saturating_add(3),
            "IMPORT_MOL_ATOM_COUNT_TOO_LARGE",
            "MOL atom count is too large to process safely.",
        ));
    };

    let Some(atom_block_lines) = record_lines.get(MOL_ATOM_BLOCK_START_LINE..atom_block_end) else {
        return Err(record_error(
            file_name,
            record_index,
            record_start_line.saturating_add(record_lines.len().saturating_sub(1)),
            "IMPORT_MOL_ATOM_BLOCK_TRUNCATED",
            "MOL atom block is truncated and does not match the declared atom count.",
        ));
    };

    let mut atom_counts: BTreeMap<String, usize> = BTreeMap::new();
    let mut molar_mass_g_mol = 0.0;

    for (atom_index, atom_line) in atom_block_lines.iter().enumerate() {
        let line_index = MOL_ATOM_BLOCK_START_LINE.saturating_add(atom_index);
        let line_number = record_start_line.saturating_add(line_index);

        let symbol = parse_atom_symbol(atom_line).ok_or_else(|| {
            record_error(
                file_name,
                record_index,
                line_number,
                "IMPORT_MOL_ATOM_SYMBOL_INVALID",
                "Failed to parse atom symbol from MOL atom block line.",
            )
        })?;

        let Some(atomic_mass) = element_molar_mass(&symbol) else {
            return Err(record_error(
                file_name,
                record_index,
                line_number,
                "IMPORT_UNKNOWN_ELEMENT",
                format!("Unknown element symbol `{symbol}`."),
            ));
        };

        *atom_counts.entry(symbol).or_insert(0) += 1;
        molar_mass_g_mol += atomic_mass;
    }

    let has_m_end = record_lines
        .get(atom_block_end..)
        .is_some_and(|trailer_lines| trailer_lines.iter().any(|line| line.trim() == "M  END"));
    if !has_m_end {
        return Err(record_error(
            file_name,
            record_index,
            record_start_line.saturating_add(record_lines.len().saturating_sub(1)),
            "IMPORT_MOL_M_END_MISSING",
            "MOL record is missing mandatory `M  END` terminator.",
        ));
    }

    let name = record_lines[0].trim();
    let substance_name = if name.is_empty() {
        format!("Imported record {record_index}")
    } else {
        name.to_string()
    };

    Ok(ParsedSdfMolSubstance {
        record_index,
        name: substance_name,
        formula: format_formula(&atom_counts),
        molar_mass_g_mol: round_molar_mass(molar_mass_g_mol),
    })
}

fn parse_atom_count(counts_line: &str) -> Option<usize> {
    let fixed_width = counts_line.get(0..3).map(str::trim).unwrap_or_default();
    if !fixed_width.is_empty() {
        if let Ok(parsed) = fixed_width.parse::<usize>() {
            return Some(parsed);
        }
    }

    counts_line
        .split_whitespace()
        .next()
        .and_then(|value| value.parse::<usize>().ok())
}

fn parse_atom_symbol(atom_line: &str) -> Option<String> {
    let from_columns = atom_line
        .get(MOL_ATOM_SYMBOL_COLUMN_START..MOL_ATOM_SYMBOL_COLUMN_END)
        .map(str::trim)
        .filter(|candidate| !candidate.is_empty());

    let candidate = match from_columns {
        Some(value) => value,
        None => atom_line.split_whitespace().nth(3)?,
    };

    normalize_element_symbol(candidate)
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

fn record_error(
    file_name: &str,
    record_index: usize,
    zero_based_line_number: usize,
    code: &'static str,
    message: impl Into<String>,
) -> SdfMolParseError {
    SdfMolParseError::new(
        code,
        file_name,
        Some(record_index),
        Some(zero_based_line_number.saturating_add(1)),
        message,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_water_mol() -> &'static str {
        "Water\n  ChemYstry\n\n  3  2  0  0  0  0            999 V2000\n    0.0000    0.0000    0.0000 O   0  0  0  0  0  0\n    0.7570    0.5860    0.0000 H   0  0  0  0  0  0\n   -0.7570    0.5860    0.0000 H   0  0  0  0  0  0\n  1  2  1  0  0  0  0\n  1  3  1  0  0  0  0\nM  END\n"
    }

    fn sample_methane_mol() -> &'static str {
        "Methane\n  ChemYstry\n\n  5  4  0  0  0  0            999 V2000\n    0.0000    0.0000    0.0000 C   0  0  0  0  0  0\n    0.6291    0.6291    0.6291 H   0  0  0  0  0  0\n   -0.6291   -0.6291    0.6291 H   0  0  0  0  0  0\n   -0.6291    0.6291   -0.6291 H   0  0  0  0  0  0\n    0.6291   -0.6291   -0.6291 H   0  0  0  0  0  0\n  1  2  1  0  0  0  0\n  1  3  1  0  0  0  0\n  1  4  1  0  0  0  0\n  1  5  1  0  0  0  0\nM  END\n"
    }

    #[test]
    fn parses_single_mol_record() {
        let parsed = parse_sdf_mol("water.mol", sample_water_mol()).expect("MOL should parse");

        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].name, "Water");
        assert_eq!(parsed[0].formula, "H2O");
        assert!((parsed[0].molar_mass_g_mol - 18.01528).abs() < 0.0001);
    }

    #[test]
    fn parses_sdf_with_multiple_records() {
        let sdf = format!("{}$$$$\n{}$$$$\n", sample_water_mol(), sample_methane_mol());
        let parsed = parse_sdf_mol("mix.sdf", &sdf).expect("SDF should parse");

        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].name, "Water");
        assert_eq!(parsed[0].formula, "H2O");
        assert_eq!(parsed[1].name, "Methane");
        assert_eq!(parsed[1].formula, "CH4");
    }

    #[test]
    fn returns_parse_error_with_file_and_line_context() {
        let broken = "Broken\n  ChemYstry\n\n  1  0  0  0  0  0            999 V2000\n    0.0000    0.0000    0.0000 Qx  0  0  0  0  0  0\nM  END\n";
        let error = parse_sdf_mol("broken.mol", broken).expect_err("unknown element must fail");

        assert_eq!(error.code, "IMPORT_UNKNOWN_ELEMENT");
        assert_eq!(error.file_name, "broken.mol");
        assert_eq!(error.record_index, Some(1));
        assert_eq!(error.line_number, Some(5));
        assert!(error.with_context_message().contains("file=broken.mol"));
        assert!(error.with_context_message().contains("line=5"));
    }

    #[test]
    fn rejects_malicious_atom_count_without_panicking() {
        let malicious = "Malicious\n  ChemYstry\n\n   18446744073709551615  0  0  0  0  0            999 V2000\nM  END\n";
        let error =
            parse_sdf_mol("malicious.mol", malicious).expect_err("malicious atom count must fail");

        assert_eq!(error.code, "IMPORT_MOL_ATOM_COUNT_TOO_LARGE");
        assert_eq!(error.file_name, "malicious.mol");
    }
}
