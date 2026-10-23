import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {createHmac} from 'node:crypto';
export function administrativo(){
 const chave=process.env.SUPABASE_SECRET_KEY;
 if(!chave)throw new Error('A administração de acessos ainda não foi configurada.');
 return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,chave,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
// O militar digita RG; a senha interna evita o limite mínimo do provedor para RG curto.
export function senhaInicial(rg:string){
 const chave=process.env.SUPABASE_SECRET_KEY;
 if(!chave)throw new Error('Administração indisponível');
 return createHmac('sha256',chave).update('primeiro-acesso:'+rg).digest('base64url');
}
