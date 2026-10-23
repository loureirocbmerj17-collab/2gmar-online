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
 const campos=['telefone','endereco','email_contato'] as const;
 const valores=Object.fromEntries(campos.map(k=>[k,String(form.get(k)||'').trim()]));
 if(valores.telefone.length>40||valores.endereco.length>500||valores.email_contato.length>254)redirect('/cadastro?erro=Campos+muito+longos');
 const {error}=await db.rpc('atualizar_meu_cadastro',{p_telefone:valores.telefone,p_endereco:valores.endereco,p_email:valores.email_contato});
 if(error)redirect('/cadastro?erro=Não+foi+possível+salvar');
 revalidatePath('/cadastro');redirect('/cadastro?ok=1');
}
