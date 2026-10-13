/* Student t numerics: regularized incomplete beta, direct survival tails,
   and bracketed inversion. No runtime dependencies. */
(function (root) {
  'use strict';
  function checkDf(df) {
    if (!Number.isInteger(df) || df < 1 || df > 1000000) throw new RangeError('Degrees of freedom must be a whole number from 1 to 1,000,000.');
  }
  function logGamma(z) {
    const c = [676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
    if (z < .5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI*z)) - logGamma(1-z);
    z--; let x=.99999999999980993;
    for (let i=0;i<c.length;i++) x+=c[i]/(z+i+1);
    const t=z+7.5;
    return .9189385332046727+(z+.5)*Math.log(t)-t+Math.log(x);
  }
  function logBetaHalf(a) {
    if (a < 16) return logGamma(a)+logGamma(.5)-logGamma(a+.5);
    const r=1/a;
    return .5*Math.log(Math.PI)-.5*Math.log(a)+r/8-r**3/192+r**5/640-17*r**7/14336;
  }
  function fraction(a,b,x) {
    const tiny=1e-300, eps=4e-15;
    const nonzero=v=>Math.abs(v)<tiny?tiny:v;
    let c=1,d=1/nonzero(1-(a+b)*x/(a+1)),h=d;
    for(let m=1;m<=10000;m++) {
      let aa=m*(b-m)*x/((a+2*m-1)*(a+2*m));
      d=1/nonzero(1+aa*d); c=nonzero(1+aa/c); h*=d*c;
      aa=-(a+m)*(a+b+m)*x/((a+2*m)*(a+2*m+1));
      d=1/nonzero(1+aa*d); c=nonzero(1+aa/c); const delta=d*c; h*=delta;
      if(Math.abs(delta-1)<eps) return h;
    }
    throw new RangeError('The numerical calculation did not converge. Try less extreme inputs.');
  }
  function beta(x,a,b,logB,logX=Math.log(x)) {
    if(x>=1)return 1;
    if(x<=0 && !Number.isFinite(logX))return 0;
    if(x>(a+1)/(a+b+2))return 1-beta(1-x,b,a,logB);
    return Math.exp(a*logX+b*Math.log1p(-x)-logB)*fraction(a,b,x)/a;
  }
  function logRatio(t,df) {
    const r=Math.abs(t)/Math.sqrt(df);
    return r>1e150 ? 2*Math.log(r) : Math.log1p(r*r);
  }
  function pdf(t,df) {
    checkDf(df); if(Number.isNaN(t))throw new RangeError('Invalid cutoff.');
    return Math.exp(-.5*Math.log(df)-logBetaHalf(df/2)-(df+1)/2*logRatio(t,df));
  }
  // Area between zero and |t|, computed directly near the center.
  function halfCentral(t,df) {
    const r=Math.abs(t)/Math.sqrt(df), y=r*r/(1+r*r);
    if(!Number.isFinite(y)||y>=1)return .5;
    return .5*beta(y,.5,df/2,logBetaHalf(df/2));
  }
  function sf(t,df) {
    checkDf(df); if(Number.isNaN(t))throw new RangeError('Invalid cutoff.');
    if(t<0)return 1-sf(-t,df);
    if(t===0)return .5;
    if(t<.5)return .5-halfCentral(t,df);
    const logX=-logRatio(t,df);
    return .5*beta(Math.exp(logX),df/2,.5,logBetaHalf(df/2),logX);
  }
  const cdf=(t,df)=>sf(-t,df);
  function interval(a,b,df) {
    checkDf(df);
    if(Number.isNaN(a)||Number.isNaN(b)||a>b)throw new RangeError('Lower cutoff must not exceed upper cutoff.');
    if(a===b)return 0;
    // Simpson quadrature avoids cancellation for very close finite cutoffs.
    if(Number.isFinite(a)&&Number.isFinite(b)&&b-a<1e-5*Math.max(1,Math.abs(a),Math.abs(b))) {
      const mid=a+(b-a)/2;
      return (b-a)/6*(pdf(a,df)+4*pdf(mid,df)+pdf(b,df));
    }
    if(a>=0)return Math.max(0,sf(a,df)-sf(b,df));
    if(b<=0)return Math.max(0,sf(-b,df)-sf(-a,df));
    if(Math.max(-a,b)<.5)return halfCentral(a,df)+halfCentral(b,df);
    return 1-sf(-a,df)-sf(b,df);
  }
  function bisect(target,df,central=false) {
    let lo=0,hi=1;
    const value=t=>central?2*halfCentral(t,df):sf(t,df);
    while(central?value(hi)<target:value(hi)>target) {
      hi*=2;
      if(!Number.isFinite(hi))throw new RangeError('The critical value exceeds the finite numerical range. Use a less extreme probability.');
    }
    for(let i=0;i<1100;i++) {
      const mid=lo+(hi-lo)/2;
      if(mid===lo||mid===hi)return mid;
      if(central?value(mid)<target:value(mid)>target)lo=mid;else hi=mid;
      if(hi-lo<=4e-15*Math.max(hi,Number.MIN_VALUE))return lo+(hi-lo)/2;
    }
    throw new RangeError('The critical value is too small to resolve. Use a larger probability.');
  }
  function probability(p) {if(!Number.isFinite(p)||p<=0||p>=1)throw new RangeError('Enter a probability strictly between 0 and 1.');}
  function inv(p,df) {
    checkDf(df);probability(p);if(p===.5)return 0;
    const sign=p<.5?-1:1,tail=Math.min(p,1-p);
    return sign*(tail>.25?bisect(1-2*tail,df,true):bisect(tail,df));
  }
  function central(p,df) {
    checkDf(df);probability(p);
    return p<.5?bisect(p,df,true):bisect((1-p)/2,df);
  }
  const api={checkDf,pdf,cdf,sf,interval,inv,central};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TMath=api;
})(globalThis);
