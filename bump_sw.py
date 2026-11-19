"""Run before every commit: stamps sw.js with a fingerprint of the app files it stores for offline use,
so any change to them is offered to users as a new version ("Update" bar).
Usage: python bump_sw.py   (from the repository folder)"""
import hashlib, re, pathlib

root = pathlib.Path(__file__).parent
sw = (root / 'sw.js').read_text(encoding='utf-8')
files = re.search(r"const SHELL_FILES = \[(.*?)\];", sw, re.S).group(1)
names = [n for n in re.findall(r"'([^']+)'", files) if n != './']
h = hashlib.sha1()
for n in names:
    h.update(n.encode()); h.update((root / n).read_bytes())
version = h.hexdigest()[:12]
new = re.sub(r"const VERSION = '[^']*';", f"const VERSION = '{version}';", sw)
import datetime
built = datetime.datetime.now().strftime('%d %b %Y, %I:%M %p').lstrip('0').replace(' 0', ' ')
new = re.sub(r"const BUILT = '[^']*';", f"const BUILT = '{built}';", new)
# the release number shown in the app = number of commits so far + 1 (this one); the code = R + yy + month letter + dd
import subprocess
try:
    n = int(subprocess.run(['git', 'rev-list', '--count', 'HEAD'], cwd=root, capture_output=True, text=True).stdout.strip() or 0) + 1
except Exception:
    n = 0
now = datetime.datetime.now()
new = re.sub(r"const RELEASE = '[^']*';", f"const RELEASE = '1.0.{n}';", new)
new = re.sub(r"const CODE = '[^']*';", f"const CODE = 'R{now:%y}{'ABCDEFGHIJKL'[now.month - 1]}{now:%d}';", new)
(root / 'sw.js').write_bytes(new.replace('\r\n', '\n').replace('\n', '\r\n').encode('utf-8'))
print('sw.js version', version)
