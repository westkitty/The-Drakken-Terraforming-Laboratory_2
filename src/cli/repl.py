"""Interactive Starsilk Macro REPL."""
from __future__ import annotations

from core.starsilk.executor import MacroExecutor, MacroRuntime
from core.starsilk.parser import MacroParser
from core.stellar.models import StarCore
from .dashboard import console


def run_repl() -> None:
    runtime = MacroRuntime()
    runtime.star_registry.add(StarCore(core_id="REPL-STAR"))
    executor = MacroExecutor(runtime)
    parser = MacroParser()
    console.print("Enter one macro instruction at a time. Commands: :registers, :syrin, :quit")
    sequence = 0
    while True:
        try:
            line = input("starsilk> ").strip()
        except EOFError:
            console.print()
            return
        if not line:
            continue
        if line in {":quit", ":q", "quit", "exit"}:
            return
        if line == ":registers":
            console.print(runtime.registers.snapshot())
            continue
        if line == ":syrin":
            runtime.contact_syrin_blood(contact_fraction=1e-12, source="REPL Syrin contact")
            console.print("[bold red]Starsilk runtime inert: Syrin nullification active.[/bold red]")
            continue
        sequence += 1
        try:
            result = executor.execute(parser.parse(line, source_name="<repl>"), thread_id=f"repl-{sequence}")
            console.print(
                {
                    "status": result.status.value,
                    "steps": result.steps,
                    "registers": result.registers,
                    "emissions": len(result.emissions),
                    "heliocides": len(result.stellar_events),
                }
            )
        except Exception as exc:
            console.print(f"[red]{type(exc).__name__}: {exc}[/red]")
