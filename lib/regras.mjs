export function diaDaAla(data,referencia,ciclo){
 const ler=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Data inválida');const t=Date.parse(s+'T12:00:00Z');if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==s)throw Error('Data inválida');return t;};
 if(!Number.isInteger(ciclo)||ciclo<1)throw Error('Ciclo inválido');return ((ler(data)-ler(referencia))/86400000)%ciclo===0;
}
export function horasRasNoMes(servicos,mes){return servicos.filter(s=>s.data.slice(0,7)===mes&&['aprovado','realizado'].includes(s.status)).reduce((n,s)=>n+s.horas,0);}
export function cabeRas(servicos,mes,horas){if(![12,24].includes(horas))return false;return horasRasNoMes(servicos,mes)+horas<=120;}
export function ordemRas(a,b){return a.horasMes-b.horasMes||a.ordemChamada-b.ordemChamada;}
export function ordemComplementacao(a,b){return a.solicitadoEm-b.solicitadoEm||a.ordemChamada-b.ordemChamada;}
