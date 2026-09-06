use clap::{Parser, Subcommand};
use color_eyre::eyre::{Context, Result};
use memmap2::MmapOptions;
use std::fs::File;
use std::path::PathBuf;
use std::time::Instant;

mod r1cs;

#[derive(Parser)]
#[command(
    name = "x-forge",
    about = "X-Forge — Exergenic Native ZK Prover (LNES-90 Phase 5)",
    version
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Parse and validate an R1CS file header
    Setup {
        /// Path to the .r1cs file
        #[arg(long)]
        r1cs: PathBuf,
    },
}

fn main() -> Result<()> {
    color_eyre::install()?;
    let cli = Cli::parse();

    match cli.command {
        Commands::Setup { r1cs } => {
            let t0 = Instant::now();
            let path_str = r1cs.display().to_string();

            let file = File::open(&r1cs)
                .with_context(|| format!("failed to open R1CS file: {}", path_str))?;

            let file_len = file.metadata()?.len();
            eprintln!(
                "[x-forge] mapping {} ({:.1} MB) ...",
                path_str,
                file_len as f64 / 1e6
            );

            // Safety: file is read-only; no other process will mutate it during this run.
            let mmap = unsafe { MmapOptions::new().map(&file) }
                .with_context(|| "failed to mmap R1CS file")?;

            eprintln!("[x-forge] parsing header ...");
            let header = r1cs::parse_header(&mmap)
                .with_context(|| "R1CS header parse failed")?;

            let elapsed = t0.elapsed();

            println!();
            println!("{}", header);
            println!();
            println!(
                "[x-forge] P1 COMPLETE  nConstraints = {}  ({:.3}s)",
                header.n_constraints,
                elapsed.as_secs_f64()
            );

            if header.n_constraints == 7_668_964 {
                println!("[x-forge] ASSERT PASS  nConstraints == 7668964 ✓");
            } else {
                eprintln!(
                    "[x-forge] WARNING: expected 7668964 constraints, got {}",
                    header.n_constraints
                );
            }

            Ok(())
        }
    }
}
