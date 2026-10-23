import {NextResponse} from 'next/server';
import {contexto} from '@/lib/supabase';
export async function GET(_req:Request,{params}:{params:Promise<{cep:string}>}){
 const {user,perfil}=await contexto();if(!user||!perfil?.ativo)return NextResponse.json({erro:'Acesso negado'},{status:401});
 const {cep}=await params;if(!/^\d{8}$/.test(cep))return NextResponse.json({erro:'CEP inválido'},{status:400});
 try{
  const r=await fetch('https://viacep.com.br/ws/'+cep+'/json/',{signal:AbortSignal.timeout(7000),next:{revalidate:86400}});
  if(!r.ok)throw Error();const d=await r.json();
  if(d.erro||!d.localidade||!d.uf)return NextResponse.json({erro:'CEP não encontrado'},{status:404});
  return NextResponse.json({cep,logradouro:String(d.logradouro||''),bairro:String(d.bairro||''),cidade:String(d.localidade),uf:String(d.uf)});
 }catch{return NextResponse.json({erro:'Consulta indisponível'},{status:503});}
}
