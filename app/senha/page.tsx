import {contexto} from '@/lib/supabase';
import {redirect} from 'next/navigation';
import {Estrutura} from '@/componentes/estrutura';
import {alterarSenha} from './acoes';
export default async function Senha({searchParams}:{searchParams:Promise<{erro?:string}>}){
 const {user,perfil}=await contexto({permitirTroca:true});if(!user||!perfil?.ativo)redirect('/entrar');
 const {erro}=await searchParams;
 return <Estrutura nome={perfil.nome_guerra}><h1>{perfil.senha_pendente?'Defina sua senha pessoal':'Alterar minha senha'}</h1><p>{perfil.senha_pendente?'Antes de acessar o portal, substitua a senha inicial por uma senha pessoal.':'Informe sua senha atual e escolha a nova senha.'}</p><section className="painel"><form action={alterarSenha}><label>{perfil.senha_pendente?'Senha atual (RG no primeiro acesso)':'Senha atual'}<input name="atual" type="password" required maxLength={128} autoComplete="current-password"/></label><label>Nova senha<input name="nova" type="password" required minLength={8} maxLength={128} autoComplete="new-password"/></label><label>Confirme a nova senha<input name="confirmacao" type="password" required minLength={8} maxLength={128} autoComplete="new-password"/></label><p className="ajuda">Use pelo menos 8 caracteres. A nova senha deve ser diferente do RG.</p>{erro&&<p role="alert" className="aviso">{erro}</p>}<button className="primario">Salvar nova senha</button></form></section></Estrutura>;
}
