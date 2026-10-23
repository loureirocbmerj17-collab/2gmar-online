export function normalizarRg(valor){
 const texto=String(valor??'').trim();
 if(!/^[0-9.\s-]{1,24}$/.test(texto))return null;
 const rg=texto.replace(/\D/g,'').replace(/^0+/,'');
 return /^[0-9]{1,12}$/.test(rg)?rg:null;
}
export function senhaValida(senha,rg){return typeof senha==='string'&&senha.length>=8&&senha.length<=128&&normalizarRg(senha)!==rg;}
