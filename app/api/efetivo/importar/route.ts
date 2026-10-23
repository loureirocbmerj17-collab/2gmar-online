import {NextResponse} from 'next/server';
import {contexto} from '@/lib/supabase';
import {administrativo,senhaInicial} from '@/lib/admin';
import {normalizarRg} from '@/lib/acesso.mjs';
export const maxDuration=60;
type Linha={rg:string;nome_completo:string;posto_graduacao:string;quadro?:string;id_funcional?:string;nascimento?:string;ordem_chamada:number;endereco?:string;telefone?:string;telefone_secundario?:string;email_contato?:string};
const resposta=(dados:unknown,status=200)=>NextResponse.json(dados,{status,headers:{'Cache-Control':'no-store'}});
function texto(v:unknown,max:number){return typeof v==='string'?v.trim().slice(0,max):'';}
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return resposta({erro:'Origem inválida'},403);
 const {db,user,perfil}=await contexto();if(!user||!perfil?.ativo)return resposta({erro:'Entre novamente'},401);
 const {data:pode}=await db.rpc('pode_gerir_efetivo');if(!pode)return resposta({erro:'Acesso exclusivo da SAD'},403);
 if(Number(req.headers.get('content-length')||0)>1000000)return resposta({erro:'Arquivo muito grande'},413);
 let corpo;try{corpo=await req.json();}catch{return resposta({erro:'Dados inválidos'},400);}
 const linhas=corpo.linhas as Linha[];const simular=corpo.simular===true;
 if(!Array.isArray(linhas)||!linhas.length||linhas.length>(simular?500:5))return resposta({erro:'Lote inválido'},400);
 const registros=linhas.map(l=>({...l,rg:normalizarRg(l.rg)}));
 if(registros.some(l=>!l.rg||!texto(l.nome_completo,200)||!texto(l.posto_graduacao,40)||!Number.isInteger(l.ordem_chamada)||l.ordem_chamada<1||l.ordem_chamada>10000))return resposta({erro:'Confira RG, nome, posto e ordem de chamada'},400);
 if(new Set(registros.map(l=>l.rg)).size!==registros.length)return resposta({erro:'RG duplicado no arquivo'},400);
 const admin=administrativo();
 const {data:existentes,error:consulta}=await admin.from('perfis').select('id,rg_login').in('rg_login',registros.map(l=>l.rg));
 if(consulta)return resposta({erro:'Não foi possível consultar o efetivo'},503);
 if(simular)return resposta({total:registros.length,existentes:existentes?.length||0,novos:registros.length-(existentes?.length||0)});
 const resultados=[];
 for(const l of registros){
  let id=existentes?.find(p=>p.rg_login===l.rg)?.id;let criado=false;
  try{
   if(!id){
    const {data,error}=await admin.auth.admin.createUser({email:l.rg+'@efetivo.2gmar.invalid',password:senhaInicial(l.rg!),email_confirm:true});
    if(error||!data.user)throw Error('Não foi possível criar o acesso');id=data.user.id;
    const {error:falha}=await admin.from('perfis').insert({id,rg:l.rg,nome_completo:texto(l.nome_completo,200).toUpperCase(),nome_guerra:texto(l.nome_completo,200).toUpperCase(),posto_graduacao:texto(l.posto_graduacao,40),oficial:['CEL','TEN CEL','MAJ','CAP','1º TEN','2º TEN','ASP OF'].includes(l.posto_graduacao),papel:'militar',senha_pendente:true});
    if(falha){await admin.auth.admin.deleteUser(id);throw Error('Não foi possível vincular o perfil');}criado=true;
   }
   const {data:f}=await admin.from('dados_funcionais').select('*').eq('perfil_id',id).maybeSingle();
   const campos={quadro:f?.quadro||texto(l.quadro,60),id_funcional:f?.id_funcional||texto(l.id_funcional,30),nascimento:f?.nascimento||l.nascimento||null,ordem_chamada:f?.ordem_chamada||l.ordem_chamada};
   const {error:funcional}=await admin.from('dados_funcionais').upsert({perfil_id:id,...campos},{onConflict:'perfil_id'});if(funcional)throw Error('Dados funcionais pendentes: confira a ordem de chamada');
   const {data:c}=await admin.from('dados_cadastrais').select('*').eq('perfil_id',id).maybeSingle();
   const telefone=(v:unknown)=>{const s=texto(v,40);return /^[+0-9() .-]{8,40}$/.test(s)?s:'';};
   const contato={telefone:c?.telefone||telefone(l.telefone),telefone_secundario:c?.telefone_secundario||telefone(l.telefone_secundario),endereco:c?.endereco||texto(l.endereco,800),email_contato:c?.email_contato||texto(l.email_contato,254)};
   const {error:cadastro}=await admin.from('dados_cadastrais').upsert({perfil_id:id,...contato},{onConflict:'perfil_id'});if(cadastro)throw Error('Contatos pendentes de importação');
   await admin.from('auditoria').insert({autor_id:user.id,acao:criado?'importar_militar':'completar_militar_importado',alvo_id:id});
   resultados.push({rg:l.rg,status:criado?'criado':'preservado'});
  }catch(e){resultados.push({rg:l.rg,status:'erro',erro:e instanceof Error?e.message:'Falha no registro'});}
 }
 return resposta({resultados});
}
