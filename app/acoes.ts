'use server';
import {banco,contexto} from '@/lib/supabase';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {administrativo,senhaInicial} from '@/lib/admin';
import {normalizarRg} from '@/lib/acesso.mjs';
export async function entrar(form:FormData){
 const rg=normalizarRg(form.get('rg'));const senha=String(form.get('senha')||'');
 const falha='/entrar?erro=Não+foi+possível+entrar.+Confira+RG+e+senha+ou+procure+a+SAD.';
 if(!rg||!senha||senha.length>128)redirect(falha);
 let destino='/';
 try{
  const admin=administrativo();
  const {data:permitido,error:limite}=await admin.rpc('reservar_tentativa_login',{p_chave:rg});
  if(limite||!permitido)redirect('/entrar?erro=Aguarde+15+minutos+antes+de+tentar+novamente.');
  const {data:p}=await admin.from('perfis').select('id,ativo,senha_pendente,redefinir_ao_entrar').eq('rg_login',rg).maybeSingle();
  if(!p?.ativo)redirect(falha);
  const {data:{user}}=await admin.auth.admin.getUserById(p.id);
  if(!user?.email)redirect(falha);
  if(p.redefinir_ao_entrar){
   if(!p.senha_pendente||normalizarRg(senha)!==rg)redirect(falha);
   const {error:restauracao}=await admin.auth.admin.updateUserById(p.id,{password:senhaInicial(rg)});
   if(restauracao)redirect('/entrar?erro=Não+foi+possível+restaurar+o+acesso.+Procure+a+administração.');
   const {error:registro}=await admin.from('perfis').update({redefinir_ao_entrar:false}).eq('id',p.id);
   if(registro)redirect('/entrar?erro=Restauração+pendente.+Tente+novamente.');
  }
  const password=p.senha_pendente&&normalizarRg(senha)===rg?senhaInicial(rg):senha;
  const db=await banco();const {error}=await db.auth.signInWithPassword({email:user.email,password});
  if(error)redirect(falha);
  await admin.from('tentativas_login').delete().eq('chave',rg);
  destino=p.senha_pendente?'/senha':'/';
 }catch(e){if(e&&typeof e==='object'&&'digest' in e)throw e;redirect('/entrar?erro=Acesso+indisponível.+Procure+a+SAD.');}
 redirect(destino);
}
export async function sair(){const db=await banco();await db.auth.signOut();redirect('/entrar');}
export async function atualizarCadastro(form:FormData){
 const {db,user,perfil}=await contexto();if(!user||!perfil?.ativo)redirect('/entrar');
 const limites={telefone:40,telefone_secundario:40,email_contato:254,cep:9,logradouro:200,numero:30,bairro:120,cidade:120,uf:2,complemento:150};
 const valores:Record<string,string>={};
 for(const [campo,max] of Object.entries(limites)){const v=String(form.get(campo)||'').trim();if(v.length>max)redirect('/cadastro?erro=Confira+o+tamanho+dos+campos');valores[campo]=v;}
 valores.cep=valores.cep.replace(/\D/g,'');valores.uf=valores.uf.toUpperCase();
 if(!/^\d{8}$/.test(valores.cep)||!valores.logradouro||!valores.numero||!valores.bairro||!valores.cidade||!/^([A-Z]{2})$/.test(valores.uf))redirect('/cadastro?erro=Confira+CEP,+rua,+número,+bairro,+cidade+e+UF');
 for(const chave of ['telefone','telefone_secundario']){if(valores[chave]&&!/^[+0-9() .-]{8,40}$/.test(valores[chave]))redirect('/cadastro?erro=Confira+os+telefones+informados');}
 if(valores.email_contato&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.email_contato))redirect('/cadastro?erro=Confira+o+e-mail+informado');
 const {error}=await db.rpc('atualizar_meu_cadastro_v2',{p_dados:valores});
 if(error)redirect('/cadastro?erro=Não+foi+possível+salvar.+Confira+os+campos+e+tente+novamente');
 revalidatePath('/cadastro');redirect('/cadastro?ok=1');
}
