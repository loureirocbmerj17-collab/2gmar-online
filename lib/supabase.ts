import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
export async function banco(){
 const jar=await cookies();
 return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll:()=>jar.getAll(),setAll:(lista)=>{try{lista.forEach(({name,value,options})=>jar.set(name,value,options));}catch{/* Renovação de sessão é feita pelo proxy. */}}}});
}
export async function contexto(opcoes:{permitirTroca?:boolean}={}){
 const db=await banco();const {data:{user}}=await db.auth.getUser();
 if(!user)return {db,user:null,perfil:null};
 const {data:perfil}=await db.from('perfis').select('*').eq('id',user.id).maybeSingle();
 if(perfil?.ativo&&!opcoes.permitirTroca){
  if(perfil.senha_pendente)redirect('/senha');
  const {data:liberada,error}=await db.rpc('sessao_liberada');
  if(error||!liberada)redirect('/entrar?erro=Sessão+expirada.+Entre+novamente.');
 }
 return {db,user,perfil};
}
