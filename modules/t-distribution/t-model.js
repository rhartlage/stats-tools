/* Shared question model and Excel formulas; independently testable from the UI. */
(function(root){
  'use strict';
  const M=typeof module==='object'&&module.exports?require('./t-math.js'):root.TMath;
  const exact=n=>String(Object.is(n,-0)?0:n);
  function solve({df,mode,type,a,b,p}) {
    M.checkDf(df);
    if(!['left','right','between','absGreater'].includes(type)||!['probability','inverse'].includes(mode))throw new RangeError('Choose a supported question.');
    let formulas,arithmetic;
    if(mode==='inverse') {
      if(!Number.isFinite(p)||p<=0||p>=1)throw new RangeError('Enter a probability strictly between 0 and 1 (for example, 0.95).');
      const P=exact(p),D=exact(df);
      if(type==='left'){a=M.inv(p,df); formulas=[`=T.INV(${P},${D})`];arithmetic=`The area to the left of the cutoff is p = ${P}.`;}
      if(type==='right'){a=-M.inv(p,df);formulas=[`=-T.INV(${P},${D})`];arithmetic=`By symmetry, negate the left-tail quantile for p = ${P}. This avoids subtracting a tiny p from 1.`;}
      if(type==='between') {b=M.central(p,df);a=-b;formulas=[`=-T.INV.2T(1-${P},${D})`,`=T.INV.2T(1-${P},${D})`];arithmetic=`Outside area = 1 − ${P}; each unshaded tail = (1 − ${P}) / 2.`;}
      if(type==='absGreater') {b=-M.inv(p/2,df);a=-b;formulas=[`=-T.INV.2T(${P},${D})`,`=T.INV.2T(${P},${D})`];arithmetic=`Total shaded area = ${P}; each shaded tail = ${P} / 2.`;}
      if(!Number.isFinite(a)||(b!==undefined&&!Number.isFinite(b)))throw new RangeError('These cutoffs exceed the finite numerical range.');
      if(type==='between' && 1-p===1)throw new RangeError('This middle probability is too small for an equivalent Excel 1−p formula. Enter a larger probability.');
    } else {
      if(!Number.isFinite(a)||(type==='between'&&!Number.isFinite(b)))throw new RangeError('Enter finite t cutoffs.');
      if(type==='absGreater'){if(a<0)throw new RangeError('Two-tail magnitude must be 0 or greater; one-sided cutoffs may be signed.');b=a;a=-b;}
      if(type==='between'&&a>b)throw new RangeError('The lower cutoff must be less than or equal to the upper cutoff.');
      const A=exact(a),B=exact(b),D=exact(df);
      if(type==='left'){p=M.cdf(a,df);formulas=[`=T.DIST(${A},${D},TRUE)`];arithmetic=`F(${A}) is the cumulative area to the left.`;}
      if(type==='right'){p=M.sf(a,df);formulas=[`=T.DIST.RT(${A},${D})`];arithmetic=`S(${A}) is the area to the right = 1 − F(${A}). A direct right-tail function retains small tail areas.`;}
      if(type==='between') {p=M.interval(a,b,df);formulas=[a>=0?`=T.DIST.RT(${A},${D})-T.DIST.RT(${B},${D})`:`=T.DIST(${B},${D},TRUE)-T.DIST(${A},${D},TRUE)`];arithmetic=`F(${B}) − F(${A}). For positive cutoffs, subtract right tails S(${A}) − S(${B}) to retain precision.`;}
      if(type==='absGreater'){p=2*M.sf(b,df);formulas=[`=T.DIST.2T(${B},${D})`];arithmetic=`P(T < ${A}) + P(T > ${B}) = 2 × S(${B}).`;}
    }
    const ts=['left','right'].includes(type)?[a]:[a,b];
    const segments=type==='left'?[[-Infinity,a]]:type==='right'?[[a,Infinity]]:type==='between'?[[a,b]]:[[-Infinity,a],[b,Infinity]];
    return {df,mode,type,a,b,p,ts,segments,formulas,arithmetic};
  }
  const api={solve};if(typeof module==='object'&&module.exports)module.exports=api;else root.TModel=api;
})(globalThis);
