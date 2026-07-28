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
const mode=document.querySelector("#mode"),inputs=document.querySelector("#inputs");
const schemas={
prop:[["Group A successes","a1",62],["Group A n","n1",100],["Group B successes","a2",48],["Group B n","n2",100]],
means:[["A mean","m1",74],["A SD","s1",10],["A n","n1",36],["B mean","m2",68],["B SD","s2",12],["B n","n2",32]],
paired:[["Mean difference","md",3.2],["SD of differences","sd",6.5],["Number of pairs","n",30]],
variance:[["A variance","v1",144],["A n","n1",25],["B variance","v2",81],["B n","n2",22]],
anova:[["Group A values","g1","12, 15, 14, 16, 13"],["Group B values","g2","18, 17, 20, 19, 16"],["Group C values","g3","14, 13, 12, 15, 11"]]
};
function build(){inputs.className=mode.value==="anova"?"fields three":"fields";inputs.innerHTML=schemas[mode.value].map(([l,id,v])=>`<label>${l}<input id="${id}" type="${mode.value==="anova"?"text":"number"}" step="any" value="${v}"></label>`).join("");run();}
const nums=id=>document.querySelector("#"+id).value.split(/[ ,;]+/).map(Number).filter(Number.isFinite);
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;const variance=a=>a.reduce((s,x)=>s+(x-mean(a))**2,0)/(a.length-1);
function run(){const a=Number(document.querySelector("#alpha").value);let diff,st,p,assume,explain,follow="";
if(!(a>0&&a<1))return bad();
if(mode.value==="prop"){const x1=+val("a1"),n1=+val("n1"),x2=+val("a2"),n2=+val("n2");if(!(n1>0&&n2>0&&x1>=0&&x1<=n1&&x2>=0&&x2<=n2))return bad();const p1=x1/n1,p2v=x2/n2,po=(x1+x2)/(n1+n2);diff=p1-p2v;st=diff/Math.sqrt(po*(1-po)*(1/n1+1/n2));p=p2(normalCdf(st));assume=Math.min(x1,n1-x1,x2,n2-x2)>=5?"Success/failure counts support the normal approximation. Independence still comes from the study design.":"At least one success/failure count is small; use an exact method or a larger sample.";explain="Difference is A proportion minus B proportion.";}
else if(mode.value==="means"){const m1=+val("m1"),s1=+val("s1"),n1=+val("n1"),m2=+val("m2"),s2=+val("s2"),n2=+val("n2");if(!(s1>0&&s2>0&&n1>=2&&n2>=2))return bad();diff=m1-m2;const se=Math.sqrt(s1*s1/n1+s2*s2/n2);st=diff/se;const df=(s1*s1/n1+s2*s2/n2)**2/((s1*s1/n1)**2/(n1-1)+(s2*s2/n2)**2/(n2-1));p=p2(tCdf(st,df));assume="Welch's t procedure does not assume equal variances. Check independent sampling and serious skew/outliers, especially for small groups.";explain=`Welch df ≈ ${fmt(df,1)}. Difference is A mean minus B mean.`;}
else if(mode.value==="paired"){const md=+val("md"),sd=+val("sd"),n=+val("n");if(!(sd>0&&n>=2))return bad();diff=md;st=md/(sd/Math.sqrt(n));p=p2(tCdf(st,n-1));assume="The analysis is on within-pair differences. Check that pairing is genuine and that difference scores are independent and not severely nonnormal.";explain=`df = ${n-1}. Positive values mean the defined A-minus-B difference is positive.`;}
else if(mode.value==="variance"){const v1=+val("v1"),v2=+val("v2"),n1=+val("n1"),n2=+val("n2");if(!(v1>0&&v2>0&&n1>=2&&n2>=2))return bad();diff=v1-v2;st=v1/v2;p=p2(fCdf(st,n1-1,n2-1));assume="The F procedure is sensitive to nonnormality and outliers. Verify independent samples and approximately normal populations.";explain=`F uses A variance / B variance with df ${n1-1}, ${n2-1}.`;}
else{const groups=["g1","g2","g3"].map(nums);if(groups.some(g=>g.length<2))return bad();const all=groups.flat(),gm=mean(all),ssb=groups.reduce((s,g)=>s+g.length*(mean(g)-gm)**2,0),ssw=groups.reduce((s,g)=>s+g.reduce((q,x)=>q+(x-mean(g))**2,0),0),dfb=groups.length-1,dfw=all.length-groups.length;st=(ssb/dfb)/(ssw/dfw);p=1-fCdf(st,dfb,dfw);diff=Math.max(...groups.map(mean))-Math.min(...groups.map(mean));assume="Check independent observations, roughly normal group distributions, and comparable spreads. ANOVA identifies whether at least one mean differs—not which one.";explain=`F(${dfb}, ${dfw}) compares between-group to within-group variation.`;const mse=ssw/dfw;let rows=[];for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){const d=mean(groups[i])-mean(groups[j]),se=Math.sqrt(mse*(1/groups[i].length+1/groups[j].length)),t=Math.abs(d/se),raw=p2(tCdf(t,dfw)),adj=Math.min(1,raw*3);rows.push(`<tr><td>${String.fromCharCode(65+i)} – ${String.fromCharCode(65+j)}</td><td>${fmt(d)}</td><td>${pFmt(adj)}</td></tr>`);}follow=`<table><caption class="sr-only">Bonferroni follow-up comparisons</caption><thead><tr><th>Pair</th><th>Mean difference</th><th>Adjusted p</th></tr></thead><tbody>${rows.join("")}</tbody></table><p class="hint">Bonferroni-adjusted exploratory follow-ups. Interpret only after the overall ANOVA and with the study context.</p>`;}
document.querySelector("#difference").textContent=fmt(diff);document.querySelector("#stat").textContent=fmt(st);document.querySelector("#pvalue").textContent=pFmt(p);document.querySelector("#assumptions").innerHTML=`<h3>Before trusting the number</h3><p>${assume}</p>`;document.querySelector("#result").innerHTML=`<h3>${p<a?"Evidence of a difference":"Insufficient evidence of a difference"}</h3><p>At α = ${a}, ${p<a?"reject":"do not reject"} equality for the selected comparison. ${explain}</p><p>Statistical evidence does not establish practical importance or causation.</p>`;document.querySelector("#followup").innerHTML=follow;}
function val(id){return document.querySelector("#"+id).value}function bad(){document.querySelector("#result").innerHTML='<h3>Check inputs</h3><p>Each sample needs valid values and enough observations for its procedure.</p>';}
const q=new URLSearchParams(location.search);if(q.get("lab")==="anova")mode.value="anova";mode.onchange=build;document.querySelector("#run").onclick=run;document.querySelector("#reset").onclick=build;build();