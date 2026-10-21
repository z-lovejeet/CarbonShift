"""Offline M00 evidence check before scaffolding; not an application test suite."""

import argparse
from datetime import datetime, timedelta
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import unquote


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--require-passed", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    evidence = Path(__file__).resolve().parent
    core_docs = [root / "AGENTS.md", *sorted((root / "docs").glob("*.md"))]
    assert len(core_docs) == 17, "Expected fourteen specs and three guidance files"
    numbered = [p.name[:2] for p in core_docs if re.match(r"\d{2}-", p.name)]
    assert sorted(numbered) == [f"{i:02d}" for i in range(1, 15)]
    markdown = core_docs + sorted(evidence.glob("*.md"))
    links = 0
    for path in markdown:
        content = path.read_text()
        assert len(re.findall(r"^# ", content, re.M)) == 1, path
        assert not re.search(r"\b(?:TODO|TBD|FIXME)\b", content), path
        fenced = False
        columns = None
        for line in content.splitlines():
            if line.startswith("```"):
                fenced = not fenced
                columns = None
            elif not fenced and line.startswith("|"):
                current = len(re.split(r"(?<!\\)\|", line))
                assert columns is None or columns == current, (path, line)
                columns = current
            else:
                columns = None
        assert not fenced, path
        for target in re.findall(r"\[[^\]\n]*\]\(([^)\n]+)\)", content):
            target = target.strip("<>")
            if re.match(r"\w+://", target) or target.startswith("#"):
                continue
            local = unquote(target.split("#")[0])
            assert (path.parent / local).exists(), (path, target)
            links += 1
    print(f"PASS: {len(markdown)} Markdown files; {links} local links; titles/fences/tables; documents 01–14 only.")

    roadmap = (root / "docs/13-development-roadmap-and-codex-tasks.md").read_text()
    phases = re.findall(r"^### (M\d{2}) — Phase (\d{2}):", roadmap, re.M)
    assert phases == [(f"M{i:02d}", f"{i:02d}") for i in range(12)]
    tasks = re.findall(r"^\| (M\d{2}\.\d{2}) \|", roadmap, re.M)
    assert tasks == [f"M{i:02d}.{j:02d}" for i in range(12) for j in range(1, 6)]
    edges = re.findall(r"^  (M\d{2}) --> (M\d{2})$", roadmap, re.M)
    graph = {phase: [] for phase, _ in phases}
    for start, end in edges:
        graph[start].append(end)
    seen, active = set(), set()

    def visit(node):
        assert node not in active, "Dependency cycle"
        if node in seen:
            return
        active.add(node)
        for child in graph[node]:
            visit(child)
        active.remove(node)
        seen.add(node)

    for node in graph:
        visit(node)
    print(f"PASS: {len(phases)} phases, {len(tasks)} stable tasks, {len(edges)} acyclic dependency edges.")

    meta = json.loads((evidence / "2026-10-21-grid-observation.json").read_text())
    raw = (evidence / "2026-10-21-grid-response.json").read_bytes()
    assert hashlib.sha256(raw).hexdigest() == meta["rawResponseSha256"]
    rows = json.loads(raw)["data"]
    parse = lambda value: datetime.fromisoformat(value.replace("Z", "+00:00"))
    last_end = None
    nulls = {"forecast": 0, "actual": 0}
    for row in rows:
        start, end = parse(row["from"]), parse(row["to"])
        assert end - start == timedelta(minutes=30)
        assert last_end is None or start == last_end
        last_end = end
        for field in nulls:
            value = row["intensity"][field]
            if value is None:
                nulls[field] += 1
            else:
                assert type(value) is int and value >= 0
    requested = parse(meta["requestFromUtc"])
    assert parse(rows[0]["from"]) <= requested
    assert last_end >= requested + timedelta(hours=48)
    assert len(rows) == meta["rowCount"]
    assert nulls["forecast"] == meta["forecastNullCount"] == 0
    assert nulls["actual"] == meta["actualNullCount"]
    assert meta["httpStatus"] == 200 and meta["intervalValidationIssues"] == []
    assert meta["providerIssuedAtUtc"] is None
    print(f"PASS: retained grid bytes/hash; {len(rows)} contiguous half-hours; requested coverage; {nulls['actual']} null actuals preserved.")

    inventory = json.loads((evidence / "2026-10-21-workspace-readiness.json").read_text())
    assert all(type(value) is bool for value in inventory["environmentPresenceOnly"].values())
    assert inventory["gitRoot"]["exitCode"] == 128
    assert inventory["runtimes"]["node"]["exitCode"] == 0
    assert inventory["runtimes"]["pnpm"]["exitCode"] == 0
    markers = ["package.json", "pnpm-lock.yaml", "src", "contracts", "supabase", "node_modules", ".git"]
    assert not any((root / marker).exists() for marker in markers), "M00 must not scaffold M01"
    allowed_changes = {
        "AGENTS.md", "docs/README.md", "docs/decisions-and-status.md",
        "docs/01-prd-and-blueprint.md", "docs/03-ui-ux-and-design-system.md",
        "docs/04-architecture-and-system-design.md", "docs/07-api-and-integrations.md",
        "docs/09-ai-agents-models-and-workflow.md", "docs/13-development-roadmap-and-codex-tasks.md",
        "docs/14-manual-setup-guide.md",
    }
    changed, preserved = [], 0
    for prior in inventory["existingFiles"]:
        path = root / prior["path"]
        assert path.is_file(), path
        if hashlib.sha256(path.read_bytes()).hexdigest() != prior["sha256"]:
            assert prior["path"] in allowed_changes, prior["path"]
            changed.append(prior["path"])
        elif prior["path"].startswith("research/"):
            preserved += 1
    print(f"PASS: runtime/presence evidence; no app scaffolding; {len(changed)} focused existing-file changes; {preserved} earlier research files unchanged.")

    status = (root / "docs/decisions-and-status.md").read_text()
    for task in [f"M00.{i:02d}" for i in range(1, 6)]:
        assert re.search(r"^\| " + re.escape(task) + r" \|", status, re.M), task
    for gate in ["G-DB", "G-AI", "G-CHAIN", "G-HOST"]:
        assert gate in status
    assert "Next ready task: M01.01" in status
    assert "Exact command/action to resume:" in status
    if args.require_passed:
        assert "**G00:** passed" in status
        for task in [f"M00.{i:02d}" for i in range(1, 6)]:
            assert f"| {task} | passed |" in status
    print("PASS: five task records, external gates, and M01.01 handoff" + ("; G00 recorded passed." if args.require_passed else "."))
    print("No product tests, authenticated provider checks, deployment, or testnet checks were performed by this verifier.")


if __name__ == "__main__":
    main()
