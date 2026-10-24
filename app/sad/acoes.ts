'use server';
import {contexto} from '@/lib/supabase';import {redirect} from 'next/navigation';import {revalidatePath} from 'next/cache';
export async function enviarSad(form:FormData){
 const {db,user,perfil}=await contexto();if(!user||!perfil?.ativo)redirect('/entrar');
 const retorno=String(form.get('voltar')||'/sad');const voltar=/^\/(sad|efetivo)(\?|$)/.test(retorno)?retorno:'/sad';
 const acao=String(form.get('acao')||'');const dados=Object.fromEntries(Array.from(form.entries()).filter(([k])=>!['acao','voltar'].includes(k)&&!k.startsWith('$ACTION_')).map(([k,v])=>[k,String(v)]));
 const envio:Record<string,unknown>={...dados,habilitacoes:form.getAll('habilitacoes').map(String)};
 const {error}=await db.rpc('operacao_sad',{acao,dados:envio});
 revalidatePath('/sad');revalidatePath('/efetivo');revalidatePath('/');
 if(error)redirect(voltar+(voltar.includes('?')?'&':'?')+'erro='+encodeURIComponent(error.code==='P0001'?error.message:'Não foi possível concluir. Confira os dados e tente novamente.'));
 redirect(voltar+(voltar.includes('?')?'&':'?')+'ok=Operação+concluída.');
}
