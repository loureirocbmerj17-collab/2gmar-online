'use server';
import {contexto} from '@/lib/supabase';
import {administrativo,senhaInicial} from '@/lib/admin';
import {normalizarRg} from '@/lib/acesso.mjs';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
async function autorizar(){
 const ctx=await contexto();if(!ctx.user||!ctx.perfil?.ativo)redirect('/entrar');
 const {data:autorizado,error}=await ctx.db.rpc('pode_gerir_efetivo');
 if(error||!autorizado)redirect('/');
 return {...ctx,admin:administrativo()};
}
export async function cadastrarMilitar(form:FormData){
 const {user,admin}=await autorizar();
 const rg=normalizarRg(form.get('rg'));const nome=String(form.get('nome_completo')||'').trim().toUpperCase();
 const guerra=String(form.get('nome_guerra')||'').trim().toUpperCase();const posto=String(form.get('posto_graduacao')||'').trim();
 const postos=['CEL','TEN CEL','MAJ','CAP','1º TEN','2º TEN','ASP OF','ST','1º SGT','2º SGT','3º SGT','CB','SD'];
 if(!rg||!nome||nome.length>200||!guerra||guerra.length>80||!postos.includes(posto)||form.get('pertence_efetivo')!=='sim')redirect('/efetivo?erro=Confira+os+campos+e+confirme+o+vínculo+ao+efetivo.');
 const {data:existente,error:busca}=await admin.from('perfis').select('id').eq('rg_login',rg).maybeSingle();
 if(busca)redirect('/efetivo?erro=Não+foi+possível+conferir+o+efetivo.');
 if(existente)redirect('/efetivo?erro=RG+já+cadastrado.+Use+a+redefinição+de+senha+se+necessário.');
 const {data,error}=await admin.auth.admin.createUser({email:rg+'@efetivo.2gmar.invalid',password:senhaInicial(rg),email_confirm:true});
 if(error||!data.user)redirect('/efetivo?erro=Não+foi+possível+criar+o+acesso.+Confira+se+o+RG+já+possui+conta.');
 const id=data.user.id;const {error:perfil}=await admin.from('perfis').insert({id,rg,nome_completo:nome,nome_guerra:guerra,posto_graduacao:posto,oficial:postos.indexOf(posto)<=6,papel:'militar',ativo:true,senha_pendente:true});
 if(perfil){await admin.auth.admin.deleteUser(id);redirect('/efetivo?erro=Cadastro+não+concluído.+Tente+novamente.');}
 await admin.from('auditoria').insert({autor_id:user!.id,acao:'cadastrar_militar',alvo_id:id});
 revalidatePath('/efetivo');redirect('/efetivo?ok=Militar+cadastrado.+Primeiro+acesso:+RG+e+RG.');
}
export async function redefinirSenha(form:FormData){
 const {user,admin}=await autorizar();const id=String(form.get('id')||'');
 if(!/^[a-f0-9-]{36}$/i.test(id)||form.get('confirmar')!=='sim'||id===user!.id)redirect('/efetivo?erro=Confirme+a+redefinição+do+militar+selecionado.');
 const {data:alvo}=await admin.from('perfis').select('rg_login,papel,ativo').eq('id',id).maybeSingle();
 if(!alvo?.ativo||alvo.papel!=='militar')redirect('/efetivo?erro=Essa+conta+não+pode+ser+redefinida+pela+SAD.');
 // Bloqueia o acesso anterior antes de mudar a senha; uma falha mantém a conta bloqueada para nova tentativa da SAD.
 const {error:preparo}=await admin.rpc('preparar_redefinicao',{p_perfil:id,p_autor:user!.id});
 if(preparo)redirect('/efetivo?erro=Não+foi+possível+preparar+a+redefinição.');
 const {error}=await admin.auth.admin.updateUserById(id,{password:senhaInicial(alvo.rg_login)});
 if(error)redirect('/efetivo?erro=Conta+bloqueada+para+troca,+mas+a+redefinição+falhou.+Tente+novamente.');
 await admin.from('tentativas_login').delete().in('chave',[alvo.rg_login,'senha:'+id]);
 revalidatePath('/efetivo');redirect('/efetivo?ok=Senha+redefinida+para+o+RG.+O+militar+deverá+escolher+uma+nova+senha+ao+entrar.');
}
