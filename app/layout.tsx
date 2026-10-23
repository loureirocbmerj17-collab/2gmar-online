import './estilo.css';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'2ºGMAR ONLINE',description:'Portal administrativo do 2º Grupamento Marítimo — Barra da Tijuca'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
