'use server';
import {banco,contexto} from '@/lib/supabase';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
export async function entrar(form:FormData){
 const email=String(form.get('email')||'').trim();const password=String(form.get('senha')||'');
 if(!email||!password)redirect('/entrar?erro=Preencha+e-mail+e+senha');
 const db=await banco();const {error}=await db.auth.signInWithPassword({email,password});
 if(error)redirect('/entrar?erro=Não+foi+possível+entrar.+Confira+seus+dados.');
 redirect('/');
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
