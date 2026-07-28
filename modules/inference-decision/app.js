const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + .3275911 * x);
  const y = 1 - (((((1.061405429*t - 1.453152027)*t + 1.421413741)*t - .284496736)*t + .254829592)*t)*Math.exp(-x*x);
  return sign*y;
}
const normalCdf = z => .5 * (1 + erf(z / Math.SQRT2));
function logGamma(z) {
  const c = [676.5203681218851,-1259.1392167224028,771.3234287776531,-176.6150291621406,12.507343278686905,-.13857109526572012,9.984369578019571e-6,1.5056327351493116e-7];
  if (z < .5) return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
  z -= 1; let x=.9999999999998099;
  for (let i=0;i<c.length;i++) x += c[i]/(z+i+1);
  const t=z+c.length-.5;
  return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(x);
}
function betaCf(a,b,x) {
  const max=160, eps=3e-12, fp=1e-30; let qab=a+b,qap=a+1,qam=a-1,c=1,d=1-qab*x/qap;
  if(Math.abs(d)<fp)d=fp; d=1/d; let h=d;
  for(let m=1;m<=max;m++){let m2=2*m,aa=m*(b-m)*x/((qam+m2)*(a+m2));d=1+aa*d;if(Math.abs(d)<fp)d=fp;c=1+aa/c;if(Math.abs(c)<fp)c=fp;d=1/d;h*=d*c;aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));d=1+aa*d;if(Math.abs(d)<fp)d=fp;c=1+aa/c;if(Math.abs(c)<fp)c=fp;d=1/d;const del=d*c;h*=del;if(Math.abs(del-1)<eps)break;} return h;
}
function regBeta(x,a,b) {
  if(x<=0)return 0;if(x>=1)return 1;
  const bt=Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log(1-x));
  return x<(a+1)/(a+b+2)?bt*betaCf(a,b,x)/a:1-bt*betaCf(b,a,1-x)/b;
}
function tCdf(t,df) { const x=df/(df+t*t), ib=regBeta(x,df/2,.5); return t>=0?1-.5*ib:.5*ib; }
function gammaP(a,x) {
  if(x<=0)return 0;
  if(x<a+1){let sum=1/a,del=sum,ap=a;for(let n=1;n<180;n++){ap++;del*=x/ap;sum+=del;if(Math.abs(del)<Math.abs(sum)*3e-12)break;}return sum*Math.exp(-x+a*Math.log(x)-logGamma(a));}
  let b=x+1-a,c=1/1e-30,d=1/b,h=d;for(let i=1;i<180;i++){let an=-i*(i-a);b+=2;d=an*d+b;if(Math.abs(d)<1e-30)d=1e-30;c=b+an/c;if(Math.abs(c)<1e-30)c=1e-30;d=1/d;const del=d*c;h*=del;if(Math.abs(del-1)<3e-12)break;}return 1-Math.exp(-x+a*Math.log(x)-logGamma(a))*h;
}
const chiCdf=(x,df)=>gammaP(df/2,x/2);
const fCdf=(x,d1,d2)=>regBeta((d1*x)/(d1*x+d2),d1/2,d2/2);
const p2 = c => clamp(2*Math.min(c,1-c),0,1);
function positiveQuantile(cdf,q) { let lo=0,hi=1; while(cdf(hi)<q&&hi<1e6)hi*=2; for(let i=0;i<90;i++){const mid=(lo+hi)/2;if(cdf(mid)<q)lo=mid;else hi=mid;}return (lo+hi)/2; }
const normalInv=q=>q<.5?-positiveQuantile(normalCdf,1-q):positiveQuantile(normalCdf,q);
const tInv=(q,df)=>q<.5?-positiveQuantile(x=>tCdf(x,df),1-q):positiveQuantile(x=>tCdf(x,df),q);
const chiInv=(q,df)=>positiveQuantile(x=>chiCdf(x,df),q);
const fmt = (x,d=3) => Number.isFinite(x) ? x.toFixed(d) : "—";
const pFmt = p => p < .001 ? "< .001" : p.toFixed(3);
const inputs=document.querySelector("#inputs"), mode=document.querySelector("#mode");
const defs={
prop:[["Successes","x","number","74"],["Sample size","n","number","120"],["Null proportion","null","number",".55"]],
mean:[["Sample mean","xbar","number","52.4"],["Sample SD","s","number","8.1"],["Sample size","n","number","36"],["Null mean","null","number","50"]],
variance:[["Sample SD","s","number","4.8"],["Sample size","n","number","25"],["Null SD","nullsd","number","4"]]
};
function fields(){inputs.innerHTML=defs[mode.value].map(([label,id,type,value])=>`<label>${label}<input id="${id}" type="${type}" step="any" value="${value}"></label>`).join("");document.querySelector("#practical").value=mode.value==="prop"?".05":mode.value==="variance"?"2":"2";analyze();}
function tail(cdf,dir){return dir==="two"?p2(cdf):dir==="greater"?1-cdf:cdf;}
function analyze(){const alpha=Number(document.querySelector("#alpha").value),dir=document.querySelector("#direction").value,pr=Number(document.querySelector("#practical").value)||0;let est,st,p,lo,hi,effect,label,df=null;
if(!(alpha>0&&alpha<1)){document.querySelector("#interval").innerHTML="<h3>Check alpha</h3><p>Use a significance level between 0 and 1.</p>";return;}
if(mode.value==="prop"){const x=Number(document.querySelector("#x").value),n=Number(document.querySelector("#n").value),p0=Number(document.querySelector("#null").value);if(!(n>0&&x>=0&&x<=n&&p0>0&&p0<1))return invalid();est=x/n;st=(est-p0)/Math.sqrt(p0*(1-p0)/n);p=tail(normalCdf(st),dir);const se=Math.sqrt(est*(1-est)/n),crit=normalInv(1-(dir==="two"?alpha/2:alpha));lo=dir==="less"?0:est-crit*se;hi=dir==="greater"?1:est+crit*se;effect=Math.abs(est-p0);label="proportion";}
else if(mode.value==="mean"){const xb=Number(document.querySelector("#xbar").value),s=Number(document.querySelector("#s").value),n=Number(document.querySelector("#n").value),mu=Number(document.querySelector("#null").value);if(!(n>=2&&s>0))return invalid();df=n-1;est=xb;st=(xb-mu)/(s/Math.sqrt(n));p=tail(tCdf(st,df),dir);const crit=tInv(1-(dir==="two"?alpha/2:alpha),df);lo=dir==="less"?-Infinity:xb-crit*s/Math.sqrt(n);hi=dir==="greater"?Infinity:xb+crit*s/Math.sqrt(n);effect=Math.abs(xb-mu);label="mean";}
else{const s=Number(document.querySelector("#s").value),n=Number(document.querySelector("#n").value),sd0=Number(document.querySelector("#nullsd").value);if(!(n>=2&&s>0&&sd0>0))return invalid();df=n-1;est=s*s;st=df*s*s/(sd0*sd0);p=tail(chiCdf(st,df),dir);if(dir==="two"){lo=df*est/chiInv(1-alpha/2,df);hi=df*est/chiInv(alpha/2,df);}else if(dir==="greater"){lo=df*est/chiInv(1-alpha,df);hi=Infinity;}else{lo=0;hi=df*est/chiInv(alpha,df);}effect=Math.abs(est-sd0*sd0);label="variance";}
document.querySelector("#estimate").textContent=fmt(est);document.querySelector("#stat").textContent=fmt(st);document.querySelector("#pvalue").textContent=pFmt(p);
const confidence=((1-alpha)*100).toFixed(alpha>=.01?0:1),range=dir==="greater"?`lower bound ${fmt(lo)}`:dir==="less"?`upper bound ${fmt(hi)}`:`${fmt(lo)} to ${fmt(hi)}`;
document.querySelector("#interval").innerHTML=`<h3>${confidence}% confidence ${dir==="two"?"interval":"bound"}</h3><p>${range} for the population ${label}${df===null?".":` (df = ${df}).`} The test and confidence result use the same sample but answer differently worded questions.</p>`;
const sig=p<alpha,meaningful=effect>=pr;let headline=sig?(meaningful?"Statistically and practically important":"Statistical signal; practical effect is small"):(meaningful?"Operationally important estimate; evidence is still uncertain":"No strong signal at this sample size");
document.querySelector("#decision").innerHTML=`<h3>${headline}</h3><p>At α = ${alpha}, ${sig?"reject":"do not reject"} the null hypothesis. The estimated distance from the null is ${fmt(effect)}, ${meaningful?"meeting":"not meeting"} the practical threshold of ${fmt(pr)}.</p><p>This is evidence for a decision—not an automatic decision rule. Review assumptions, design quality, costs, and affected stakeholders.</p>`;}
function invalid(){document.querySelector("#interval").innerHTML='<h3>Check the inputs</h3><p>Use a valid sample size, positive spread, and an estimate permitted by the selected procedure.</p>';document.querySelector("#decision").innerHTML='<h3>Waiting for valid evidence</h3><p>Correct the input values to continue.</p>';}
mode.onchange=fields;document.querySelector("#analyze").onclick=analyze;document.querySelector("#reset").onclick=fields;fields();