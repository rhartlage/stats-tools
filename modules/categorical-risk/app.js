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
const ids=["a","b","c","d"],defaults=[18,102,32,88];const get=()=>ids.map(id=>Number(document.querySelector("#"+id).value));
function run(){const [a,b,c,d]=get(),alpha=Number(document.querySelector("#alpha").value);if([a,b,c,d].some(x=>!Number.isFinite(x)||x<0)||a+b===0||c+d===0||a+c===0||b+d===0||!(alpha>0&&alpha<1)){document.querySelector("#result").innerHTML='<h3>Check the table</h3><p>Counts must be nonnegative, margins positive, and alpha between 0 and 1.</p>';return;}const obs=[[a,b],[c,d]],rows=[a+b,c+d],cols=[a+c,b+d],n=rows[0]+rows[1],exp=rows.map(r=>cols.map(c=>r*c/n));let chi=0;const cont=obs.map((row,i)=>row.map((o,j)=>{const q=(o-exp[i][j])**2/exp[i][j];chi+=q;return q;}));const p=1-chiCdf(chi,1),r1=a/rows[0],r2=c/rows[1],rr=r2===0?Infinity:r1/r2,minExp=Math.min(...exp.flat());document.querySelector("#chi").textContent=fmt(chi);document.querySelector("#p").textContent=pFmt(p);document.querySelector("#rr").textContent=Number.isFinite(rr)?fmt(rr,2):"∞";document.querySelector("#expected").innerHTML=`<h3>${minExp>=5?"Approximation supported":"Use caution"}</h3><p>Smallest expected count = ${fmt(minExp,2)}. ${minExp>=5?"All expected counts meet the common threshold of 5.":"At least one expected count is below 5; combine defensible categories or use an exact method."}</p>`;document.querySelector("#result").innerHTML=`<h3>${p<alpha?"Evidence of association":"Insufficient evidence of association"}</h3><p>Observed failure risk is ${(100*r1).toFixed(1)}% for the new process and ${(100*r2).toFixed(1)}% for the current process. Relative risk (new/current) = ${Number.isFinite(rr)?fmt(rr,2):"∞"}.</p><p>At α = ${alpha}, ${p<alpha?"reject":"do not reject"} independence. The table alone does not establish causation.</p>`;document.querySelector("#cells").innerHTML=`<table><thead><tr><th>Cell</th><th>Observed</th><th>Expected</th><th>χ² contribution</th></tr></thead><tbody>${["New–failure","New–no failure","Current–failure","Current–no failure"].map((name,k)=>{const i=Math.floor(k/2),j=k%2;return `<tr><td>${name}</td><td>${obs[i][j]}</td><td>${fmt(exp[i][j],2)}</td><td>${fmt(cont[i][j],3)}</td></tr>`}).join("")}</tbody></table>`;}
document.querySelector("#run").onclick=run;document.querySelector("#reset").onclick=()=>{ids.forEach((id,i)=>document.querySelector("#"+id).value=defaults[i]);document.querySelector("#alpha").value=.05;run();};run();