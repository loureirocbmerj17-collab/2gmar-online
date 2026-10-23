import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
export async function proxy(req:NextRequest){
 let resposta=NextResponse.next({request:req});
 const db=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll:()=>req.cookies.getAll(),setAll:(lista)=>{lista.forEach(({name,value})=>req.cookies.set(name,value));resposta=NextResponse.next({request:req});lista.forEach(({name,value,options})=>resposta.cookies.set(name,value,options));}}});
 await db.auth.getUser();return resposta;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|brasao.svg).*)']};
