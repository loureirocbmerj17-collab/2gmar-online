import {contexto} from '@/lib/supabase';
import {redirect} from 'next/navigation';
import {Estrutura} from '@/componentes/estrutura';
import {FormularioCadastro} from '@/componentes/formulario-cadastro';
export default async function Cadastro({searchParams}:{searchParams:Promise<{erro?:string,ok?:string}>}){
 const {db,user,perfil}=await contexto();if(!user||!perfil?.ativo)redirect('/entrar');
 const {data:d,error}=await db.from('dados_cadastrais').select('telefone,telefone_secundario,email_contato,endereco,cep,logradouro,numero,bairro,cidade,uf,complemento').eq('perfil_id',user.id).maybeSingle();
 const q=await searchParams;
 return <Estrutura nome={perfil.nome_guerra}><h1>Meus dados</h1><p>Atualize seu endereço e seus contatos. Alterações funcionais devem ser solicitadas à SAD.</p><section className="painel"><div className="grade"><p><small>POSTO / GRADUAÇÃO</small><br/>{perfil.posto_graduacao||'A cadastrar'}</p><p><small>NOME DE GUERRA</small><br/>{perfil.nome_guerra}</p><p><small>RG</small><br/>{perfil.rg||'A cadastrar'}</p></div>{error?<p className="aviso">Não foi possível carregar os dados. Tente novamente antes de editar.</p>:<FormularioCadastro key={d?.endereco||'novo'} dados={d} erro={q.erro} salvo={q.ok==='1'}/>}</section></Estrutura>;
}
