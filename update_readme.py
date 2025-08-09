import os
import subprocess
import html
from datetime import datetime, timezone

REC_SEP = "\x1e"
FIELD_SEP = "\x1f"

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout

def get_commit_log(limit=15):
    fmt = f"%h{FIELD_SEP}%s{FIELD_SEP}%an{FIELD_SEP}%ad{REC_SEP}"
    out = run(["git", "log", f"--max-count={limit}", f"--pretty=format:{fmt}", "--date=short", "--no-merges"])
    records = [r for r in out.split(REC_SEP) if r.strip()]
    commits = []
    for rec in records:
        parts = rec.split(FIELD_SEP)
        if len(parts) != 4:
            continue
        h, s, a, d = parts
        commits.append({"hash": h, "subject": s, "author": a, "date": d})
    return commits

def esc_md_cell(text):
    t = html.escape(text, quote=False)
    t = t.replace("|", r"\|").replace("`", r"\`")
    return t

def build_table(commits):
    repo = os.getenv("GITHUB_REPOSITORY", "")
    lines = []
    lines.append("## 📝 Recent Commits")
    lines.append("")
    lines.append("<!-- COMMITS:START -->")
    lines.append("")
    lines.append("| Hash | Message | Author | Date |")
    lines.append("|------|---------|--------|------|")
    for c in commits:
        link = f"https://github.com/{repo}/commit/{c['hash']}" if repo else ""
        hash_cell = f"[`{c['hash']}`]({link})" if link else f"`{c['hash']}`"
        subj = esc_md_cell(c["subject"])
        author = esc_md_cell(c["author"])
        lines.append(f"| {hash_cell} | {subj} | {author} | {c['date']} |")
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    lines.append("")
    lines.append(f"*Last updated: {ts}*")
    lines.append("")
    lines.append("<!-- COMMITS:END -->")
    return "\n".join(lines)

def replace_section(readme, new_block):
    start = readme.find("<!-- COMMITS:START -->")
    end = readme.find("<!-- COMMITS:END -->")
    if start != -1 and end != -1 and end > start:
        prefix = readme[:start]
        suffix = readme[end + len("<!-- COMMITS:END -->"):]
        return prefix + new_block + suffix
    if "## 📝 Recent Commits" in readme:
        return readme.rstrip() + "\n\n" + new_block + "\n"
    return readme.rstrip() + "\n\n" + new_block + "\n"

def update_readme():
    with open("README.md", "r", encoding="utf-8") as f:
        content = f.read()
    commits = get_commit_log(15)
    new_block = build_table(commits)
    updated = replace_section(content, new_block)
    if updated != content:
        with open("README.md", "w", encoding="utf-8") as f:
            f.write(updated)

if __name__ == "__main__":
    update_readme()
