import {contexto} from '@/lib/supabase';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {Estrutura} from '@/componentes/estrutura';
import {Mar} from '@/componentes/mar';
export default async function Inicio(){const {db,user,perfil}=await contexto();if(!user)redirect('/entrar');if(!perfil?.ativo)return <main className="pendente"><h1>Acesso aguardando liberação</h1><p>Seu login está autenticado. A administração precisa vincular seu cadastro e suas permissões.</p><Link href="/entrar">Voltar</Link></main>;
 const {data:secoes,error}=await db.from('secoes').select('id,sigla,nome,pai_id,ordem').order('ordem');
 const hoje=new Intl.DateTimeFormat('pt-BR',{dateStyle:'full',timeZone:'America/Sao_Paulo'}).format(new Date());
 return <Estrutura nome={perfil.nome_guerra}><div className="titulo"><div><span className="etiqueta">{hoje}</span><h1>Visão geral</h1><p>Informações do litoral e acesso às suas seções.</p></div><span className="selo">VERSÃO DE TESTE</span></div><Mar/><section id="secoes"><div className="titulo"><div><span className="etiqueta">ÁREAS DE TRABALHO</span><h2>Suas seções</h2></div></div>{error?<p className="aviso">Não foi possível carregar suas seções. Procure a administração.</p>:<div className="grade">{secoes?.map(s=><Link className="cartao" href={'/secoes/'+s.id} key={s.id}><span className="icone">{s.sigla.slice(0,2)}</span><h3>{s.sigla}</h3><p>{s.nome}</p><span className="abrir">Acessar seção ↗</span></Link>)}</div>}{!error&&!secoes?.length&&<p>Nenhuma seção vinculada ao seu perfil.</p>}</section></Estrutura>}
