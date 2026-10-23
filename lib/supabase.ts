import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
export async function banco(){
 const jar=await cookies();
 return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll:()=>jar.getAll(),setAll:(lista)=>{try{lista.forEach(({name,value,options})=>jar.set(name,value,options));}catch{/* Renovação de sessão é feita pelo proxy. */}}}});
}
export async function contexto(){
 const db=await banco();const {data:{user}}=await db.auth.getUser();
 if(!user)return {db,user:null,perfil:null};
 const {data:perfil}=await db.from('perfis').select('*').eq('id',user.id).maybeSingle();
 return {db,user,perfil};
}
