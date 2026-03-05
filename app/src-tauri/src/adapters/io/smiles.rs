use std::collections::BTreeMap;
use std::fmt::{Display, Formatter};

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
pub struct ParsedSmilesSubstance {
    pub record_index: usize,
    pub line_number: usize,
    pub name: String,
    pub smiles: String,
    pub formula: String,
    pub molar_mass_g_mol: f64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SmilesParseError {
    pub code: &'static str,
    pub file_name: String,
    pub record_index: Option<usize>,
    pub line_number: Option<usize>,
    pub message: String,
}

impl SmilesParseError {
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

impl Display for SmilesParseError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.with_context_message())
    }
}

pub fn parse_smiles(
    file_name: &str,
    contents: &str,
) -> Result<Vec<ParsedSmilesSubstance>, SmilesParseError> {
    let normalized_file_name = file_name.trim();

    if normalized_file_name.is_empty() {
        return Err(SmilesParseError::new(
            "IMPORT_FILE_NAME_REQUIRED",
            "<unknown>",
            None,
            None,
            "File name is required for SMILES import.",
        ));
    }

    if contents.trim().is_empty() {
        return Err(SmilesParseError::new(
            "IMPORT_FILE_EMPTY",
            normalized_file_name,
            None,
            Some(1),
            "Import file is empty.",
        ));
    }

    let mut parsed_substances = Vec::new();
    let mut record_index = 0usize;

    for (line_offset, line) in contents.lines().enumerate() {
        let line_number = line_offset.saturating_add(1);
        let trimmed = line.trim();

        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        record_index = record_index.saturating_add(1);
        parsed_substances.push(parse_smiles_record(
            normalized_file_name,
            record_index,
            line_number,
            trimmed,
        )?);
    }

    if parsed_substances.is_empty() {
        return Err(SmilesParseError::new(
            "IMPORT_RECORDS_NOT_FOUND",
            normalized_file_name,
            None,
            Some(1),
            "No SMILES records were found in the import file.",
        ));
    }

    Ok(parsed_substances)
}

fn parse_smiles_record(
    file_name: &str,
    record_index: usize,
    line_number: usize,
    trimmed_line: &str,
) -> Result<ParsedSmilesSubstance, SmilesParseError> {
    let (smiles, name_raw) = split_smiles_and_name(trimmed_line);

    if smiles.is_empty() {
        return Err(record_error(
            file_name,
            record_index,
            line_number,
            "IMPORT_SMILES_REQUIRED",
            "SMILES token is required at the start of each record line.",
        ));
    }

    validate_smiles_characters(file_name, record_index, line_number, smiles)?;
    validate_smiles_balancing(file_name, record_index, line_number, smiles)?;

    let (atom_counts, molar_mass_g_mol) =
        collect_explicit_atoms(file_name, record_index, line_number, smiles)?;

    if atom_counts.is_empty() {
        return Err(record_error(
            file_name,
            record_index,
            line_number,
            "IMPORT_SMILES_NO_ATOMS",
            "SMILES record does not contain recognizable atom symbols.",
        ));
    }

    let name = if name_raw.is_empty() {
        format!("Imported SMILES {record_index}")
    } else {
        name_raw.to_string()
    };

    Ok(ParsedSmilesSubstance {
        record_index,
        line_number,
        name,
        smiles: smiles.to_string(),
        formula: format_formula(&atom_counts),
        molar_mass_g_mol: round_molar_mass(molar_mass_g_mol),
    })
}

fn split_smiles_and_name(line: &str) -> (&str, &str) {
    for (index, ch) in line.char_indices() {
        if ch.is_whitespace() {
            return (&line[..index], line[index..].trim());
        }
    }

    (line, "")
}

fn validate_smiles_characters(
    file_name: &str,
    record_index: usize,
    line_number: usize,
    smiles: &str,
) -> Result<(), SmilesParseError> {
    for ch in smiles.chars() {
        if ch.is_ascii_alphanumeric()
            || matches!(
                ch,
                '#' | '%' | '(' | ')' | '[' | ']' | '+' | '-' | '.' | ':' | '=' | '@' | '\\'
                    | '/' | '*'
            )
        {
            continue;
        }

        return Err(record_error(
            file_name,
            record_index,
            line_number,
            "IMPORT_SMILES_INVALID_CHAR",
            format!("SMILES contains unsupported character `{ch}`."),
        ));
    }

    Ok(())
}

fn validate_smiles_balancing(
    file_name: &str,
    record_index: usize,
    line_number: usize,
    smiles: &str,
) -> Result<(), SmilesParseError> {
    let mut parentheses_balance = 0isize;
    let mut bracket_balance = 0isize;

    for ch in smiles.chars() {
        match ch {
            '(' => parentheses_balance += 1,
            ')' => {
                if parentheses_balance == 0 {
                    return Err(record_error(
                        file_name,
                        record_index,
                        line_number,
                        "IMPORT_SMILES_UNBALANCED_PARENTHESES",
                        "SMILES contains a closing `)` without matching `(`.",
                    ));
                }
                parentheses_balance -= 1;
            }
            '[' => bracket_balance += 1,
            ']' => {
                if bracket_balance == 0 {
                    return Err(record_error(
                        file_name,
                        record_index,
                        line_number,
                        "IMPORT_SMILES_UNBALANCED_BRACKETS",
                        "SMILES contains a closing `]` without matching `[`.",
                    ));
                }
                bracket_balance -= 1;
            }
            _ => {}
        }
    }

    if parentheses_balance != 0 {
        return Err(record_error(
            file_name,
            record_index,
            line_number,
            "IMPORT_SMILES_UNBALANCED_PARENTHESES",
            "SMILES contains unbalanced parentheses.",
        ));
    }

    if bracket_balance != 0 {
        return Err(record_error(
            file_name,
            record_index,
            line_number,
            "IMPORT_SMILES_UNBALANCED_BRACKETS",
            "SMILES contains unbalanced brackets.",
        ));
    }

    Ok(())
}

fn collect_explicit_atoms(
    file_name: &str,
    record_index: usize,
    line_number: usize,
    smiles: &str,
) -> Result<(BTreeMap<String, usize>, f64), SmilesParseError> {
    let chars: Vec<char> = smiles.chars().collect();
    let mut atom_counts: BTreeMap<String, usize> = BTreeMap::new();
    let mut molar_mass_g_mol = 0.0;
    let mut index = 0usize;

    while index < chars.len() {
        let ch = chars[index];

        if ch == '[' {
            let mut end_index = index + 1;
            while end_index < chars.len() && chars[end_index] != ']' {
                end_index += 1;
            }

            if end_index >= chars.len() {
                return Err(record_error(
                    file_name,
                    record_index,
                    line_number,
                    "IMPORT_SMILES_UNBALANCED_BRACKETS",
                    "SMILES contains unbalanced brackets.",
                ));
            }

            let bracket_content: String = chars[index + 1..end_index].iter().collect();
            let bracket_counts = parse_bracket_atom_counts(&bracket_content).map_err(|error| {
                record_error(file_name, record_index, line_number, error.code, error.message)
            })?;

            for (symbol, count) in bracket_counts {
                append_atom_count(
                    file_name,
                    record_index,
                    line_number,
                    &symbol,
                    count,
                    &mut atom_counts,
                    &mut molar_mass_g_mol,
                )?;
            }

            index = end_index + 1;
            continue;
        }

        if ch == '*' {
            return Err(record_error(
                file_name,
                record_index,
                line_number,
                "IMPORT_SMILES_UNSUPPORTED_TOKEN",
                "Wildcard `*` token is not supported in SMILES import MVP.",
            ));
        }

        if ch.is_ascii_uppercase() {
            let Some((symbol, consumed)) = parse_atom_symbol_at(&chars, index) else {
                return Err(record_error(
                    file_name,
                    record_index,
                    line_number,
                    "IMPORT_UNKNOWN_ELEMENT",
                    format!("Unknown element symbol starting at `{ch}`."),
                ));
            };

            append_atom_count(
                file_name,
                record_index,
                line_number,
                &symbol,
                1,
                &mut atom_counts,
                &mut molar_mass_g_mol,
            )?;
            index += consumed;
            continue;
        }

        if ch.is_ascii_lowercase() {
            if let Some((aromatic_symbol, consumed)) = parse_aromatic_symbol(&chars, index) {
                append_atom_count(
                    file_name,
                    record_index,
                    line_number,
                    &aromatic_symbol,
                    1,
                    &mut atom_counts,
                    &mut molar_mass_g_mol,
                )?;
                index += consumed;
                continue;
            }

            return Err(record_error(
                file_name,
                record_index,
                line_number,
                "IMPORT_SMILES_UNSUPPORTED_TOKEN",
                format!("Unsupported lowercase token starting at `{ch}`."),
            ));
        }

        if ch.is_ascii_alphabetic() {
            return Err(record_error(
                file_name,
                record_index,
                line_number,
                "IMPORT_SMILES_UNSUPPORTED_TOKEN",
                format!("Unsupported token `{ch}` in SMILES record."),
            ));
        }

        if ch == '#'
            || ch == '%'
            || ch == '('
            || ch == ')'
            || ch.is_ascii_digit()
            || matches!(ch, '=' | '+' | '-' | '.' | ':' | '@' | '\\' | '/')
        {
            index += 1;
            continue;
        }

        index += 1;
    }

    Ok((atom_counts, molar_mass_g_mol))
}

#[derive(Debug, Clone)]
struct BracketParseError {
    code: &'static str,
    message: String,
}

fn parse_bracket_atom_counts(content: &str) -> Result<BTreeMap<String, usize>, BracketParseError> {
    let chars: Vec<char> = content.chars().collect();
    let mut index = 0usize;
    let mut atom_counts = BTreeMap::new();

    while index < chars.len() && chars[index].is_ascii_digit() {
        index += 1;
    }

    let Some((primary_symbol, consumed)) = parse_atom_symbol_at(&chars, index) else {
        return Err(BracketParseError {
            code: "IMPORT_SMILES_ATOM_SYMBOL_INVALID",
            message: format!("Failed to extract atom symbol from bracket atom `[{content}]`."),
        });
    };
    increment_atom_count(&mut atom_counts, &primary_symbol, 1)?;
    index += consumed;

    while index < chars.len() {
        let ch = chars[index];

        if ch == 'H' {
            let (count, consumed_digits) = parse_count_digits(&chars, index + 1)?;
            increment_atom_count(&mut atom_counts, "H", count)?;
            index = index.saturating_add(1).saturating_add(consumed_digits);
            continue;
        }

        if ch == '*' {
            return Err(BracketParseError {
                code: "IMPORT_SMILES_UNSUPPORTED_TOKEN",
                message: "Wildcard `*` token is not supported in SMILES import MVP.".to_string(),
            });
        }

        if ch.is_ascii_alphabetic() {
            return Err(BracketParseError {
                code: "IMPORT_SMILES_UNSUPPORTED_TOKEN",
                message: format!("Unsupported token `{ch}` in bracket atom `[{content}]`."),
            });
        }

        index += 1;
    }

    Ok(atom_counts)
}

fn parse_atom_symbol_at(chars: &[char], index: usize) -> Option<(String, usize)> {
    let first = *chars.get(index)?;

    if first.is_ascii_uppercase() {
        if let Some(second) = chars.get(index + 1) {
            if second.is_ascii_lowercase() {
                let mut two_letter_symbol = String::new();
                two_letter_symbol.push(first);
                two_letter_symbol.push(*second);
                if element_molar_mass(&two_letter_symbol).is_some() {
                    return Some((two_letter_symbol, 2));
                }
            }
        }

        let single_letter_symbol = first.to_string();
        if element_molar_mass(&single_letter_symbol).is_some() {
            return Some((single_letter_symbol, 1));
        }
    }

    if first.is_ascii_lowercase() {
        return parse_aromatic_symbol(chars, index);
    }

    None
}

fn parse_count_digits(chars: &[char], start_index: usize) -> Result<(usize, usize), BracketParseError> {
    let mut value = 0usize;
    let mut consumed = 0usize;

    for ch in chars.iter().skip(start_index) {
        if !ch.is_ascii_digit() {
            break;
        }
        let digit = (*ch as u8 - b'0') as usize;
        value = value
            .checked_mul(10)
            .and_then(|current| current.checked_add(digit))
            .ok_or_else(|| BracketParseError {
                code: "IMPORT_SMILES_COUNT_TOO_LARGE",
                message: "Explicit atom count is too large to process safely.".to_string(),
            })?;
        consumed += 1;
    }

    if consumed == 0 {
        return Ok((1, 0));
    }

    if value == 0 {
        return Err(BracketParseError {
            code: "IMPORT_SMILES_COUNT_INVALID",
            message: "Explicit atom count must be at least 1.".to_string(),
        });
    }

    Ok((value, consumed))
}

fn increment_atom_count(
    atom_counts: &mut BTreeMap<String, usize>,
    symbol: &str,
    count: usize,
) -> Result<(), BracketParseError> {
    let entry = atom_counts.entry(symbol.to_string()).or_insert(0);
    *entry = entry
        .checked_add(count)
        .ok_or_else(|| BracketParseError {
            code: "IMPORT_SMILES_COUNT_TOO_LARGE",
            message: "Explicit atom count is too large to process safely.".to_string(),
        })?;
    Ok(())
}

fn parse_aromatic_symbol(chars: &[char], index: usize) -> Option<(String, usize)> {
    let first = *chars.get(index)?;
    if !first.is_ascii_lowercase() {
        return None;
    }

    if first == 's' && chars.get(index + 1) == Some(&'e') {
        return Some(("Se".to_string(), 2));
    }
    if first == 'a' && chars.get(index + 1) == Some(&'s') {
        return Some(("As".to_string(), 2));
    }

    let symbol = match first {
        'b' => "B",
        'c' => "C",
        'n' => "N",
        'o' => "O",
        'p' => "P",
        's' => "S",
        _ => return None,
    };

    Some((symbol.to_string(), 1))
}

fn append_atom_count(
    file_name: &str,
    record_index: usize,
    line_number: usize,
    symbol: &str,
    count: usize,
    atom_counts: &mut BTreeMap<String, usize>,
    molar_mass_g_mol: &mut f64,
) -> Result<(), SmilesParseError> {
    let Some(atomic_mass) = element_molar_mass(symbol) else {
        return Err(record_error(
            file_name,
            record_index,
            line_number,
            "IMPORT_UNKNOWN_ELEMENT",
            format!("Unknown element symbol `{symbol}`."),
        ));
    };

    let entry = atom_counts.entry(symbol.to_string()).or_insert(0);
    *entry = entry.checked_add(count).ok_or_else(|| {
        record_error(
            file_name,
            record_index,
            line_number,
            "IMPORT_SMILES_COUNT_TOO_LARGE",
            "Explicit atom count is too large to process safely.",
        )
    })?;
    *molar_mass_g_mol += atomic_mass * count as f64;

    Ok(())
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
    line_number: usize,
    code: &'static str,
    message: impl Into<String>,
) -> SmilesParseError {
    SmilesParseError::new(
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
    fn parses_valid_smiles_file() {
        let contents = "# comment\n\nCC Ethane\nO\n[Na+] Sodium ion\n";

        let parsed = parse_smiles("valid.smi", contents).expect("SMILES file should parse");
        assert_eq!(parsed.len(), 3);

        assert_eq!(parsed[0].record_index, 1);
        assert_eq!(parsed[0].line_number, 3);
        assert_eq!(parsed[0].name, "Ethane");
        assert_eq!(parsed[0].smiles, "CC");
        assert_eq!(parsed[0].formula, "C2");
        assert!((parsed[0].molar_mass_g_mol - 24.0214).abs() < 0.0001);

        assert_eq!(parsed[1].record_index, 2);
        assert_eq!(parsed[1].name, "Imported SMILES 2");
        assert_eq!(parsed[1].formula, "O");

        assert_eq!(parsed[2].record_index, 3);
        assert_eq!(parsed[2].name, "Sodium ion");
        assert_eq!(parsed[2].formula, "Na");
    }

    #[test]
    fn returns_contextual_error_for_invalid_smiles_syntax() {
        let error = parse_smiles("broken.smi", "C(C Broken\n")
            .expect_err("unbalanced parentheses should fail");

        assert_eq!(error.code, "IMPORT_SMILES_UNBALANCED_PARENTHESES");
        assert_eq!(error.file_name, "broken.smi");
        assert_eq!(error.record_index, Some(1));
        assert_eq!(error.line_number, Some(1));
        assert!(error.with_context_message().contains("file=broken.smi"));
        assert!(error.with_context_message().contains("record=1"));
        assert!(error.with_context_message().contains("line=1"));
    }

    #[test]
    fn returns_contextual_error_for_unknown_element() {
        let error =
            parse_smiles("unknown.smi", "Qq Unknownium\n").expect_err("unknown symbol should fail");

        assert_eq!(error.code, "IMPORT_UNKNOWN_ELEMENT");
        assert_eq!(error.file_name, "unknown.smi");
        assert_eq!(error.record_index, Some(1));
        assert_eq!(error.line_number, Some(1));
    }

    #[test]
    fn rejects_unsupported_lowercase_token_for_cq() {
        let error =
            parse_smiles("unsupported.smi", "Cq Broken\n").expect_err("unsupported lowercase token");

        assert_eq!(error.code, "IMPORT_SMILES_UNSUPPORTED_TOKEN");
        assert_eq!(error.file_name, "unsupported.smi");
        assert_eq!(error.record_index, Some(1));
        assert_eq!(error.line_number, Some(1));
    }

    #[test]
    fn rejects_wildcard_token_for_c_star() {
        let error = parse_smiles("wildcard.smi", "C* Wildcard\n")
            .expect_err("wildcard token should be rejected");

        assert_eq!(error.code, "IMPORT_SMILES_UNSUPPORTED_TOKEN");
        assert_eq!(error.file_name, "wildcard.smi");
        assert_eq!(error.record_index, Some(1));
        assert_eq!(error.line_number, Some(1));
    }

    #[test]
    fn parses_bracket_atoms_with_explicit_hydrogen_counts() {
        let contents = "[NH4+] Ammonium\n[CH3][OH] Methanol\n[nH] Pyrrolic\n";

        let parsed = parse_smiles("bracket.smi", contents).expect("bracket atoms should parse");
        assert_eq!(parsed.len(), 3);

        assert_eq!(parsed[0].name, "Ammonium");
        assert_eq!(parsed[0].formula, "H4N");
        assert!((parsed[0].molar_mass_g_mol - 18.03846).abs() < 0.0001);

        assert_eq!(parsed[1].name, "Methanol");
        assert_eq!(parsed[1].formula, "CH4O");
        assert!((parsed[1].molar_mass_g_mol - 32.04186).abs() < 0.0001);

        assert_eq!(parsed[2].name, "Pyrrolic");
        assert_eq!(parsed[2].formula, "HN");
        assert!((parsed[2].molar_mass_g_mol - 15.01464).abs() < 0.0001);
    }

    #[test]
    fn rejects_records_without_atoms() {
        let error = parse_smiles("no-atoms.smi", "12345 Label\n")
            .expect_err("records without atoms should fail");

        assert_eq!(error.code, "IMPORT_SMILES_NO_ATOMS");
        assert_eq!(error.file_name, "no-atoms.smi");
        assert_eq!(error.record_index, Some(1));
        assert_eq!(error.line_number, Some(1));
    }
}
