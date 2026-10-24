import {enviarSad} from '@/app/sad/acoes';
export function FormularioSad({acao,voltar='/sad',children,classe}:{acao:string;voltar?:string;children:React.ReactNode;classe?:string}){return <form action={enviarSad} className={classe}><input type="hidden" name="acao" value={acao}/><input type="hidden" name="voltar" value={voltar}/>{children}</form>;}
export function Oculto({nome,valor}:{nome:string;valor:string}){return <input type="hidden" name={nome} value={valor}/>;}
