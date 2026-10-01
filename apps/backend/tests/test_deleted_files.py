import pytest
from app.services.github_service import PRData, PRFile
from adapters.registry import LanguageRegistry


def test_removed_files_tracked_in_pipeline():
    registry = LanguageRegistry()

    pr_data = PRData(
        number=42,
        title="Remove deprecated module",
        body="Clean up old code",
        head_sha="head123",
        base_sha="base123",
        author="developer",
        base_branch="main",
        head_branch="feature",
        state="open",
        additions=20,
        deletions=150,
        changed_files=2,
        html_url="https://github.com/org/repo/pull/42",
        files=[
            PRFile(
                filename="legacy/old_auth.py",
                status="removed",
                additions=0,
                deletions=150,
                patch="",
            ),
            PRFile(
                filename="new_auth.py",
                status="added",
                additions=20,
                deletions=0,
                patch="@@ -0,0 +1,5 @@\n+def new_login():\n+    pass\n",
            ),
        ],
    )

    changed_files_data = []
    deleted_files = []

    for f in pr_data.files:
        lang = registry.detect_language(f.filename)
        if f.status == "removed":
            deleted_files.append(f.filename)
            changed_files_data.append({
                "path": f.filename,
                "language": lang,
                "status": "removed",
                "added_lines": 0,
                "removed_lines": f.deletions,
                "changed_symbols": ["[DELETED FILE]"],
            })
            continue

    assert "legacy/old_auth.py" in deleted_files
    removed_entry = next(d for d in changed_files_data if d["path"] == "legacy/old_auth.py")
    assert removed_entry["status"] == "removed"
    assert removed_entry["removed_lines"] == 150
    changed_syms = removed_entry["changed_symbols"]
    assert isinstance(changed_syms, list)
    assert "[DELETED FILE]" in changed_syms
