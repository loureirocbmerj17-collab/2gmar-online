'use server';
import {contexto} from '@/lib/supabase';
import {administrativo,senhaInicial} from '@/lib/admin';
import {normalizarRg,senhaValida} from '@/lib/acesso.mjs';
import {createClient} from '@supabase/supabase-js';
import {redirect} from 'next/navigation';
export async function alterarSenha(form:FormData){
 const {db,user,perfil}=await contexto({permitirTroca:true});
 if(!user||!perfil?.ativo)redirect('/entrar');
 const rg=normalizarRg(perfil.rg)!;const atual=String(form.get('atual')||'');const nova=String(form.get('nova')||'');
 if(!senhaValida(nova,rg)||nova!==String(form.get('confirmacao')||''))redirect('/senha?erro=Use+ao+menos+8+caracteres,+diferentes+do+RG,+e+confirme+a+nova+senha.');
 const admin=administrativo();
 const {data:limite,error:erroLimite}=await admin.rpc('reservar_tentativa_login',{p_chave:'senha:'+user.id});
 if(erroLimite||!limite)redirect('/senha?erro=Aguarde+15+minutos+antes+de+tentar+novamente.');
 const verificador=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const password=perfil.senha_pendente&&normalizarRg(atual)===rg?senhaInicial(rg):atual;
 const {data:validacao,error}=await verificador.auth.signInWithPassword({email:user.email!,password});
 if(error||validacao.user?.id!==user.id)redirect('/senha?erro=Senha+atual+incorreta.');
 await verificador.auth.signOut({scope:'local'});
 const {error:troca}=await admin.auth.admin.updateUserById(user.id,{password:nova});
 if(troca)redirect('/senha?erro=Não+foi+possível+alterar+a+senha.+Tente+novamente.');
 const {error:registro}=await admin.from('perfis').update({senha_pendente:false}).eq('id',user.id);
 if(registro)redirect('/senha?erro=Senha+alterada,+mas+a+liberação+ficou+pendente.+Entre+com+a+nova+senha+e+tente+novamente.');
 await admin.from('tentativas_login').delete().eq('chave','senha:'+user.id);
 await admin.from('auditoria').insert({autor_id:user.id,acao:'alterar_senha',alvo_id:user.id});
 await db.auth.signOut();
 redirect('/entrar?ok=Senha+alterada.+Entre+com+seu+RG+e+a+nova+senha.');
}
