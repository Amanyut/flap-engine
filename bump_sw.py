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
(root / 'sw.js').write_bytes(new.replace('\r\n', '\n').replace('\n', '\r\n').encode('utf-8'))
print('sw.js version', version)
