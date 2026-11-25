"""Extract the pinned source branch locally; never copy course PDFs into main."""
from pathlib import Path
from hashlib import sha256
import json
import subprocess
import sys
import pypdf

SHA = '8dfee73781e39d6946d76c07866f2a0534a3d988'
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.crew' / 'lecture-sources'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = json.loads((Path(__file__).parent / 'fixtures' / 'references.json').read_text(encoding='utf8'))['values']
    manifest = {'source_commit': SHA, 'pypdf_version': pypdf.__version__, 'lectures': []}
    for n in range(1,13):
        name=f'L{n:02}'
        data=subprocess.check_output(['git','show',f'{SHA}:lectures/{name}.pdf'],cwd=ROOT)
        pdf=OUT/f'{name}.pdf'
        pdf.write_bytes(data)
        reader=pypdf.PdfReader(pdf)
        text=[]
        pages=[]
        for page_no,page in enumerate(reader.pages,1):
            lines=(page.extract_text() or '').splitlines()
            pages.append(lines)
            text.append(f'=== {name} PDF PAGE {page_no} ===')
            text.extend(f'p{page_no:02}:l{line_no:03} {line}' for line_no,line in enumerate(lines,1))
        for row in [r for r in rows if r['lecture']==name]:
            for anchor in [row['source'], *row['source'].get('related',[])]:
                start,end=map(lambda s:int(s.removeprefix('l')),anchor['lines'].split('-'))
                if not 1<=start<=end<=len(pages[anchor['page']-1]):
                    raise ValueError(f"Invalid page/line range: {row['id']} p{anchor['page']} {anchor['lines']}")
        (OUT/f'{name}.txt').write_text('\n'.join(text),encoding='utf8')
        manifest['lectures'].append({'lecture':name,'pages':len(reader.pages),'sha256':sha256(data).hexdigest()})
    target=Path(__file__).parent/'fixtures'/'source-manifest.json'
    output=json.dumps(manifest,indent=2)+'\n'
    if '--check' in sys.argv:
        if target.read_text(encoding='utf8')!=output:
            raise SystemExit('Source hash/page/extractor manifest differs; investigate before updating.')
        print('All 12 source hashes and all fixture page/line ranges verified')
    else:
        target.write_text(output,encoding='utf8')
        print('Wrote source manifest and numbered local text; PDF sources stay ignored')


if __name__=='__main__':
    main()
