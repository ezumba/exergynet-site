use byteorder::{LittleEndian, ReadBytesExt};
use color_eyre::eyre::{bail, eyre, Result};
use std::fmt;
use std::io::Cursor;

const MAGIC: &[u8; 4] = b"r1cs";
const SUPPORTED_VERSION: u32 = 1;
const SECTION_HEADER: u32 = 1;

pub struct R1csHeader {
    pub version: u32,
    pub num_sections: u32,
    pub field_size_bytes: u32,
    pub prime: Vec<u8>,
    pub n_wires: u32,
    pub n_pub_out: u32,
    pub n_pub_in: u32,
    pub n_prv_in: u32,
    pub n_labels: u64,
    pub n_constraints: u32,
}

impl fmt::Display for R1csHeader {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let prime_hex: String = self.prime.iter().rev().map(|b| format!("{:02x}", b)).collect();
        writeln!(f, "┌─ X-Forge R1CS Header ──────────────────────────────┐")?;
        writeln!(f, "│  version          : {}", self.version)?;
        writeln!(f, "│  num_sections     : {}", self.num_sections)?;
        writeln!(f, "│  field_size_bytes : {} ({})", self.field_size_bytes,
            if self.field_size_bytes == 32 { "BN-254 ✓" } else { "non-standard" })?;
        writeln!(f, "│  prime            : 0x{}", prime_hex)?;
        writeln!(f, "│  n_wires          : {}", self.n_wires)?;
        writeln!(f, "│  n_pub_out        : {}", self.n_pub_out)?;
        writeln!(f, "│  n_pub_in         : {}", self.n_pub_in)?;
        writeln!(f, "│  n_prv_in         : {}", self.n_prv_in)?;
        writeln!(f, "│  n_labels         : {}", self.n_labels)?;
        writeln!(f, "│  nConstraints     : {}", self.n_constraints)?;
        write!(f,   "└────────────────────────────────────────────────────┘")
    }
}

pub fn parse_header(data: &[u8]) -> Result<R1csHeader> {
    if data.len() < 12 {
        bail!("file too small to be a valid R1CS (got {} bytes)", data.len());
    }

    if &data[0..4] != MAGIC {
        bail!(
            "invalid R1CS magic: expected {:?}, got {:?}",
            MAGIC,
            &data[0..4]
        );
    }

    let mut cur = Cursor::new(&data[4..]);
    let version = cur.read_u32::<LittleEndian>()?;
    if version != SUPPORTED_VERSION {
        bail!("unsupported R1CS version {} (expected {})", version, SUPPORTED_VERSION);
    }
    let num_sections = cur.read_u32::<LittleEndian>()?;

    // Walk section headers to find the header section (type 1).
    // Layout: magic[4] version[4] num_sections[4] then sections.
    // Each section: type[4] size[8] data[size].
    let mut pos: usize = 12;
    let mut header_data_pos: Option<usize> = None;

    for _ in 0..num_sections {
        if pos + 12 > data.len() {
            bail!("truncated section header at byte {}", pos);
        }
        let mut shdr = Cursor::new(&data[pos..pos + 12]);
        let section_type = shdr.read_u32::<LittleEndian>()?;
        let section_size = shdr.read_u64::<LittleEndian>()?;
        pos += 12;

        if section_type == SECTION_HEADER && header_data_pos.is_none() {
            header_data_pos = Some(pos);
        }

        pos = pos
            .checked_add(section_size as usize)
            .ok_or_else(|| eyre!("section size overflow at section type {}", section_type))?;

        if pos > data.len() {
            bail!(
                "section type {} claims size {} but file ends at {}",
                section_type,
                section_size,
                data.len()
            );
        }
    }

    let hpos = header_data_pos.ok_or_else(|| eyre!("no header section (type 1) found in R1CS"))?;
    let mut hcur = Cursor::new(&data[hpos..]);

    let field_size_bytes = hcur.read_u32::<LittleEndian>()?;
    let mut prime = vec![0u8; field_size_bytes as usize];
    for b in prime.iter_mut() {
        *b = hcur.read_u8()?;
    }
    let n_wires = hcur.read_u32::<LittleEndian>()?;
    let n_pub_out = hcur.read_u32::<LittleEndian>()?;
    let n_pub_in = hcur.read_u32::<LittleEndian>()?;
    let n_prv_in = hcur.read_u32::<LittleEndian>()?;
    let n_labels = hcur.read_u64::<LittleEndian>()?;
    let n_constraints = hcur.read_u32::<LittleEndian>()?;

    Ok(R1csHeader {
        version,
        num_sections,
        field_size_bytes,
        prime,
        n_wires,
        n_pub_out,
        n_pub_in,
        n_prv_in,
        n_labels,
        n_constraints,
    })
}
