"""Rich terminal dashboard rendering."""
from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import Any

from rich.console import Console
from rich.panel import Panel
from rich.table import Table


console = Console()


def render_report(title: str, report: Any) -> None:
    data = asdict(report) if is_dataclass(report) else dict(report)
    table = Table(show_header=True, header_style="bold")
    table.add_column("Metric")
    table.add_column("Value")
    for key, value in data.items():
        table.add_row(str(key), str(value))
    console.print(Panel(table, title=title, subtitle="deterministic state"))


def render_banner() -> None:
    console.print(
        Panel.fit(
            "[bold]The Drakken Terraforming Laboratory[/bold]\n"
            "Starsilk macro runtime · stellar collapse monitor · planetary grids · Siege Wall lattice",
            title="Laboratory",
        )
    )
