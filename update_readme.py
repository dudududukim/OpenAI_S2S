import subprocess
import re
from datetime import datetime, timezone

def get_commit_log(limit=10):
    cmd = [
        'git', 'log', f'--max-count={limit}', 
        '--pretty=format:%h|%s|%an|%ad', 
        '--date=short', 
        '--no-merges'
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        commits = []
        
        for line in result.stdout.strip().split('\n'):
            if line:
                parts = line.split('|', 3)
                if len(parts) == 4:
                    hash_short, subject, author, date = parts
                    commits.append({
                        'hash': hash_short.strip(),
                        'subject': subject.strip(),
                        'author': author.strip(),
                        'date': date.strip()
                    })
        return commits
    except subprocess.CalledProcessError:
        return []

def escape_table_cell(text):
    return text.replace('|', '\\|').replace('\n', ' ').replace('\r', '')

def generate_commit_table():
    commits = get_commit_log(10)
    if not commits:
        return ""
    
    lines = []
    lines.append("## 📝 Recent Commits")
    lines.append("")
    lines.append("| Hash | Message | Author | Date |")
    lines.append("|------|---------|--------|------|")
    
    for commit in commits:
        hash_cell = f"`{commit['hash']}`"
        subject_cell = escape_table_cell(commit['subject'])
        author_cell = escape_table_cell(commit['author'])
        date_cell = commit['date']
        
        lines.append(f"| {hash_cell} | {subject_cell} | {author_cell} | {date_cell} |")
    
    timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
    lines.append("")
    lines.append(f"*Last updated: {timestamp}*")
    lines.append("")
    
    return '\n'.join(lines)

def update_readme():
    try:
        with open('README.md', 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print("README.md not found")
        return
    
    commit_section = generate_commit_table()
    if not commit_section:
        print("No commits found")
        return
    
    pattern = r'## 📝 Recent Commits.*?(?=\n## |\n# |$)'
    
    if re.search(pattern, content, re.DOTALL):
        new_content = re.sub(pattern, commit_section.rstrip(), content, flags=re.DOTALL)
    else:
        new_content = content.rstrip() + '\n\n' + commit_section
    
    with open('README.md', 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("README.md updated successfully")

if __name__ == "__main__":
    update_readme()
