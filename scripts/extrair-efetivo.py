import argparse
import datetime
import json
import pathlib
import re
import pdfplumber

parser = argparse.ArgumentParser()
parser.add_argument('pdf')
parser.add_argument('saida')
args = parser.parse_args()
postos = {'TENENTE CORONEL': 'TEN CEL', 'MAJOR': 'MAJ', 'CAPITÃO': 'CAP', 'CAPITAO': 'CAP', '1º TENENTE': '1º TEN', '2º TENENTE': '2º TEN', 'ASPIRANTE': 'ASP OF', 'SUBTENENTE': 'ST', '1º SARGENTO': '1º SGT', '2º SARGENTO': '2º SGT', '3º SARGENTO': '3º SGT', 'CABO': 'CB', 'SOLDADO': 'SD'}
def limpar(v):
    return re.sub(r'\s+', ' ', v or '').strip()
registros = []
with pdfplumber.open(args.pdf) as documento:
    for pagina in documento.pages:
        for tabela in pagina.extract_tables():
            for linha in tabela:
                if len(linha) < 12:
                    continue
                c = [limpar(v) for v in linha[-12:]]
                if not c[0].isdigit() or not re.fullmatch(r'\d{5,8}', c[4]):
                    continue
                posto = postos.get(c[1], c[1])
                nascimento = datetime.datetime.strptime(c[6], '%d/%m/%Y').date().isoformat() if c[6] else None
                registros.append(dict(ordem_chamada=int(c[0]),posto_graduacao=posto,posto_fonte=c[1],quadro=c[2],nome_completo=c[3],rg=c[4].lstrip('0'),id_funcional=c[5],nascimento=nascimento,endereco=c[7],cidade=c[8],telefone=c[9],telefone_secundario=c[10],email_contato=c[11]))
assert len(registros) == 269, f'Esperados 269, encontrados {len(registros)}'
assert sorted(r['ordem_chamada'] for r in registros) == list(range(1,270)), 'Ordem de chamada incompleta'
assert len({r['rg'] for r in registros}) == 269, 'RG duplicado'
assert all(r['nome_completo'] and r['quadro'] and r['nascimento'] for r in registros), 'Cadastro incompleto'
destino = pathlib.Path(args.saida)
destino.parent.mkdir(parents=True,exist_ok=True)
destino.write_text(json.dumps(registros,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'registros':len(registros),'rgs_unicos':len({r['rg'] for r in registros}),'postos':sorted({r['posto_graduacao'] for r in registros}),'saida':str(destino)},ensure_ascii=False))
