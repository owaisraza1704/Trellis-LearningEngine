import argparse
import json
from pathlib import Path

from .dataset import load_dataset


def positive(value):
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("Use a positive integer")
    return number


def main():
    parser = argparse.ArgumentParser(
        description="Offline, fixture-based Trellis evaluation; model APIs still require configured access."
    )
    subcommands = parser.add_subparsers(dest="command", required=True)
    default_dataset = Path(__file__).resolve().parents[2] / "evaluation" / "datasets" / "v1"
    validate = subcommands.add_parser(
        "validate", help="Check dataset structure and split integrity without model calls"
    )
    validate.add_argument("--dataset", type=Path, default=default_dataset)
    run = subcommands.add_parser(
        "run", help="Run real models and pgvector in a disposable PostgreSQL schema"
    )
    run.add_argument("--dataset", type=Path, default=default_dataset)
    run.add_argument("--split", choices=("dev", "test", "all"), default="test")
    run.add_argument("--category")
    run.add_argument("--limit", type=positive)
    run.add_argument("--repetitions", type=positive, default=1)
    run.add_argument("--workers", type=positive, default=1)
    run.add_argument("--seed", type=int, default=17)
    run.add_argument(
        "--variants", nargs="+", choices=("baseline", "trellis"), default=["baseline", "trellis"]
    )
    run.add_argument("--provider", choices=("azure", "openai", "openrouter", "ollama"))
    run.add_argument("--model")
    run.add_argument("--judge-provider", choices=("azure", "openai", "openrouter", "ollama"))
    run.add_argument("--judge-model")
    run.add_argument(
        "--output", type=Path, help="New output directory; defaults to .data/evaluations/<run-id>"
    )
    report = subcommands.add_parser(
        "report", help="Rebuild reports from an existing run without model calls"
    )
    report.add_argument("directory", type=Path)
    args = parser.parse_args()
    if args.command == "validate":
        manifest, cases, sources = load_dataset(args.dataset)
        print(
            json.dumps(
                {
                    "version": manifest["dataset_version"],
                    "cases": len(cases),
                    "sources": len(sources),
                    "splits": manifest["split_counts"],
                    "review_status": manifest["review_status"],
                    "dataset_sha256": manifest["dataset_sha256"],
                    "source_sha256": manifest["source_sha256"],
                },
                indent=2,
            )
        )
    elif args.command == "run":
        from .runner import run_benchmark

        if len(args.variants) != len(set(args.variants)):
            parser.error("Choose each variant only once")
        run_benchmark(args)
    else:
        from .report import write_report

        metadata = json.loads((args.directory / "run.json").read_text())
        rows = [
            json.loads(line)
            for line in (args.directory / "rows.jsonl").read_text().splitlines()
            if line
        ]
        write_report(rows, metadata, args.directory)
        print(args.directory / "report.md")


if __name__ == "__main__":
    main()
