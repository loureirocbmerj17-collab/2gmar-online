'use client';
import {useEffect,useRef,useState} from 'react';
import {useFormStatus} from 'react-dom';
import {atualizarCadastro} from '@/app/acoes';
type Dados={telefone?:string;telefone_secundario?:string;email_contato?:string;endereco?:string;cep?:string;logradouro?:string;numero?:string;bairro?:string;cidade?:string;uf?:string;complemento?:string};
type Endereco={logradouro:string;bairro:string;cidade:string;uf:string};
const vazio:Endereco={logradouro:'',bairro:'',cidade:'',uf:''};
function formatarCep(v:string){const n=v.replace(/\D/g,'').slice(0,8);return n.length>5?n.slice(0,5)+'-'+n.slice(5):n;}
function BotaoSalvar({consultando}:{consultando:boolean}){const {pending}=useFormStatus();return <button className="primario" disabled={pending||consultando}>{pending?'Salvando…':'Salvar meus dados'}</button>;}
export function FormularioCadastro({dados,erro,salvo}:{dados:Dados|null;erro?:string;salvo?:boolean}){
 const inicial=dados?.cep||'';
 const [cep,setCep]=useState(formatarCep(inicial));
 const [endereco,setEndereco]=useState<Endereco>({logradouro:dados?.logradouro||'',bairro:dados?.bairro||'',cidade:dados?.cidade||'',uf:dados?.uf||''});
 const [numero,setNumero]=useState(dados?.numero||'');const [complemento,setComplemento]=useState(dados?.complemento||'');
 const [estado,setEstado]=useState<'aguardando'|'consultando'|'encontrado'|'manual'>(inicial?'manual':'aguardando');
 const [mensagem,setMensagem]=useState(inicial?'Confira os dados do endereço cadastrado.':'Informe o CEP para buscar rua, bairro, cidade e UF.');
 const [travados,setTravados]=useState<Partial<Record<keyof Endereco,boolean>>>({});
 const consultado=useRef(inicial.replace(/\D/g,''));const abortar=useRef<AbortController|null>(null);const versao=useRef(0);
 const [tentativa,setTentativa]=useState(0);
 useEffect(()=>{
  const digitos=cep.replace(/\D/g,'');const atual=++versao.current;abortar.current?.abort();
  if(digitos.length!==8||consultado.current===digitos)return;
  const controlador=new AbortController();abortar.current=controlador;
  setEstado('consultando');setMensagem('Buscando endereço pelo CEP…');
  const temporizador=setTimeout(async()=>{
   try{
    const resposta=await fetch('/api/cep/'+digitos,{signal:controlador.signal});
    if(!resposta.ok)throw Error();const d=await resposta.json();
    if(controlador.signal.aborted||versao.current!==atual)return;
    const novo:Endereco={logradouro:d.logradouro||'',bairro:d.bairro||'',cidade:d.cidade||'',uf:d.uf||''};
    setEndereco(novo);setTravados(Object.fromEntries(Object.entries(novo).map(([k,v])=>[k,Boolean(v)])));
    setEstado('encontrado');setMensagem(novo.logradouro&&novo.bairro?'Endereço encontrado. Informe o número e o complemento, se houver.':'CEP encontrado. Complete os campos que não vieram na consulta.');
   }catch{
    if(controlador.signal.aborted||versao.current!==atual)return;
    setEstado('manual');setTravados({});setMensagem('Não foi possível consultar esse CEP. Preencha o endereço manualmente.');
   }
  },400);
  return()=>{clearTimeout(temporizador);controlador.abort();};
 },[cep,tentativa]);
 function mudarCep(v:string){const proximo=formatarCep(v);if(proximo===cep)return;versao.current++;abortar.current?.abort();consultado.current='';setCep(proximo);setEndereco({...vazio});setTravados({});setEstado('aguardando');setMensagem('Informe os 8 dígitos do CEP para buscar o endereço.');}
 function liberar(){versao.current++;abortar.current?.abort();consultado.current=cep.replace(/\D/g,'');setEstado('manual');setTravados({});setMensagem('Preenchimento manual habilitado. Confira rua, bairro, cidade e UF.');}
 function buscar(){consultado.current='';setTentativa(n=>n+1);}
 function campo(nome:keyof Endereco,titulo:string,max:number){return <label>{titulo}<input name={nome} value={endereco[nome]} onChange={e=>setEndereco(a=>({...a,[nome]:nome==='uf'?e.target.value.toUpperCase():e.target.value}))} readOnly={estado==='aguardando'||estado==='consultando'||Boolean(travados[nome])} required maxLength={max} autoComplete={nome==='logradouro'?'address-line1':nome==='cidade'?'address-level2':nome==='uf'?'address-level1':'off'}/></label>;}
 return <form action={atualizarCadastro} className="cadastro-organizado"><fieldset><legend>Endereço</legend><p className="ajuda">Comece pelo CEP. Número e complemento são preenchidos por você.</p>{dados?.endereco&&!dados?.cep&&<p className="aviso">Endereço anterior: {dados.endereco}. Confira e preencha os campos abaixo para atualizar.</p>}<div className="campos-cadastro"><label className="cep-primeiro">CEP<input name="cep" value={cep} onChange={e=>mudarCep(e.target.value)} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" pattern="[0-9]{5}-?[0-9]{3}" required maxLength={9} aria-describedby="status-cep"/></label><div className="acoes-cep"><button type="button" className="secundario" onClick={buscar} disabled={cep.replace(/\D/g,'').length!==8||estado==='consultando'}>Consultar CEP</button><button type="button" className="link-botao" onClick={liberar}>Preencher manualmente</button></div><p id="status-cep" role="status" aria-live="polite" className="campo-inteiro status-cep">{mensagem}</p><div className="campo-inteiro">{campo('logradouro','Rua / logradouro',200)}</div><label>Número<input name="numero" value={numero} onChange={e=>setNumero(e.target.value)} placeholder="Ex.: 120 ou S/N" required maxLength={30} autoComplete="off"/></label><label>Complemento<input name="complemento" value={complemento} onChange={e=>setComplemento(e.target.value)} placeholder="Apartamento, bloco, casa…" maxLength={150} autoComplete="address-line2"/></label>{campo('bairro','Bairro',120)}{campo('cidade','Cidade',120)}{campo('uf','UF',2)}</div></fieldset><fieldset><legend>Telefones e contato</legend><div className="campos-cadastro"><label>Telefone principal<input name="telefone" defaultValue={dados?.telefone||''} type="tel" inputMode="tel" autoComplete="tel" placeholder="(21) 99999-9999" maxLength={40} pattern="[+0-9() .-]{8,40}"/></label><label>Telefone residencial / contato de segurança<input name="telefone_secundario" defaultValue={dados?.telefone_secundario||''} type="tel" inputMode="tel" placeholder="(21) 3333-3333 ou outro contato" maxLength={40} pattern="[+0-9() .-]{8,40}"/></label><label className="campo-inteiro">E-mail de contato<input name="email_contato" type="email" defaultValue={dados?.email_contato||''} autoComplete="email" maxLength={254}/></label></div><p className="ajuda">O e-mail de contato não altera seu e-mail de login.</p></fieldset>{erro&&<p role="alert" className="aviso">{erro}</p>}{salvo&&<p role="status" className="sucesso">Dados atualizados.</p>}<BotaoSalvar consultando={estado==='consultando'}/></form>;
}
