import collections
import datetime
import json
import pathlib
import re
import sys
import unicodedata
import pdfplumber

origem=pathlib.Path(sys.argv[1]);efetivo=json.loads(pathlib.Path(sys.argv[2]).read_text());destino=pathlib.Path(sys.argv[3])
rgs={p['rg'] for p in efetivo};nomes=collections.defaultdict(collections.Counter);votos=collections.defaultdict(collections.Counter);fontes=collections.defaultdict(set)
def pares(texto):
    texto=re.sub(r'\s+',' ',texto or '').strip()
    saida=[]
    for m in re.finditer(r'(?<!\d)(\d{5,7})\s+([A-ZÀ-ÖØ-Ý .]+)',texto):
        rg=m[1].lstrip('0');nome=re.sub(r'\s+(?:CAP|MAJ|TEN|SUBTEN|ST|SGT|CB|SD)$','',m[2].strip()).strip()
        if rg in rgs and nome:
            nomes[rg][nome]+=1;saida.append((rg,nome))
    return saida
for arquivo in sorted(origem.glob('*.pdf')):
    if not re.match(r'^\d{2} DE OUTUBRO',arquivo.name):continue
    dia=int(arquivo.name[:2]);data=datetime.date(2026,10,dia);ala24=((data-datetime.date(2026,10,23)).days+2)%4+1
    with pdfplumber.open(arquivo) as pdf:
        trocas={};extras=set()
        for pagina in pdf.pages[1:]:
            for tabela in pagina.extract_tables():
                if 'PERMUTAS' not in ' '.join(str(x or '') for x in tabela[0]):continue
                for linha in tabela[2:]:
                    if len(linha)<4:continue
                    saem=pares(linha[0]);entram=pares(linha[1])
                    if len(saem)==1 and len(entram)==1:trocas[entram[0][0]]=saem[0][0]
                    for celula in linha[2:]:extras.update(rg for rg,_ in pares(celula))
        for tabela in pdf.pages[0].extract_tables():
            cabecalho=' '.join(str(x or '') for x in tabela[0]);tem24=any('SERVIÇO DE PRONTIDÃO' in str(x or '') for linha in tabela for x in linha)
            if tem24:
                ativo=False
                for linha in tabela:
                    if len(linha)<3:continue
                    titulo=linha[0] or ''
                    if titulo=='FUNÇÃO':ativo=True;continue
                    if titulo in ('SOCORRO NOTURNO','GRDMAR'):ativo=False
                    if not ativo:continue
                    # Sobreaviso fornece apenas nome, nunca fixa ala.
                    pares(linha[2])
                    for rg,_ in pares(linha[1]):
                        original=trocas.get(rg,rg)
                        if original in extras:continue
                        votos[original][('prontidao',ala24,titulo)]+=1;fontes[original].add(arquivo.name)
            m=re.search(r'PRAIA ALA\s*0?([123])',cabecalho)
            if not m:continue
            ala=int(m[1]);n=len(tabela[0]);meio=n//2
            for linha in tabela[2:]:
                for grupo in (linha[:meio],linha[meio:]):
                    if not grupo:continue
                    posto=grupo[0] or ''
                    for celula in grupo[1:]:
                        for rg,_ in pares(celula):
                            original=trocas.get(rg,rg)
                            if rg in extras and rg not in trocas:continue
                            if original in extras:continue
                            votos[original][('praia',ala,posto)]+=1;fontes[original].add(arquivo.name)
registros=[];ambiguos=0
for rg in sorted(rgs,key=int):
    sugestao={}
    if nomes[rg]:sugestao['nome_guerra']=nomes[rg].most_common(1)[0][0]
    if votos[rg]:
        grupos=collections.Counter()
        for (regime,ala,posto),q in votos[rg].items():grupos[(regime,ala)]+=q
        melhores=grupos.most_common();principal=melhores[0]
        if len(melhores)==1 or principal[1]>melhores[1][1]:
            regime,ala=principal[0];preferencias=collections.Counter({posto:q for (r,a,posto),q in votos[rg].items() if (r,a)==(regime,ala)})
            sugestao.update(regime=regime,ala=ala,posto=preferencias.most_common(1)[0][0],ocorrencias=principal[1])
        else:ambiguos+=1;sugestao['conferir_conflito']=True
        sugestao['fontes']=sorted(fontes[rg])
    if sugestao:registros.append({'rg':rg,'sugestao':sugestao})
destino.parent.mkdir(parents=True,exist_ok=True);destino.write_text(json.dumps(registros,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'sugestoes':len(registros),'com_ala':sum('ala' in x['sugestao'] for x in registros),'com_conflito':ambiguos,'sem_ala_inferida':269-sum('ala' in x['sugestao'] for x in registros)},ensure_ascii=False))
