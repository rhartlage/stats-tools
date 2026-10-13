const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../t-math.js'),{solve}=require('../t-model.js');
const rows=require('./scipy-reference.json');
test('probabilities, density, and quantiles against SciPy 1.17.0',()=>{
  for(const [fn,x,df,expected] of rows){
    // scipy.stats.t.ppf saturates at 1e100 for some extreme df=1 tails.
    if(fn==='inv'&&x===1e-100&&df===1)continue;
    const actual=M[fn](x,df),rel=Math.abs(actual-expected)/Math.max(Math.abs(expected),1e-300);
    const tol=fn==='central'&&x<1e-8?1e-6:fn==='inv'?2e-8:2e-8;
    assert.ok(expected===0?Math.abs(actual)<1e-300:rel<tol,`${fn}(${x},${df}): ${actual} vs ${expected}, relative ${rel}`);
  }
});
test('Cauchy tails retain extreme finite values',()=>{for(const x of [1,1e10,1e100,1e200,1e300])assert.ok(Math.abs(M.sf(x,1)/(Math.atan(1/x)/Math.PI)-1)<1e-12);});
test('df 5 middle 95% matches critical bounds',()=>{const m=solve({df:5,mode:'inverse',type:'between',p:.95});assert.ok(Math.abs(m.b-2.570581835636314)<1e-10);assert.equal(m.a,-m.b);assert.ok(Math.abs(M.interval(m.a,m.b,5)-.95)<1e-13);assert.deepEqual(m.formulas,['=-T.INV.2T(1-0.95,5)','=T.INV.2T(1-0.95,5)']);});
test('signed one-tail versus positive two-tail quantiles and Excel',()=>{const left=solve({df:5,mode:'inverse',type:'left',p:.95}),right=solve({df:5,mode:'inverse',type:'right',p:.95}),tails=solve({df:5,mode:'inverse',type:'absGreater',p:.05});assert.ok(left.a>0);assert.equal(right.a,-left.a);assert.ok(tails.b>0);assert.equal(right.formulas[0],'=-T.INV(0.95,5)');assert.ok(Math.abs(2*M.sf(tails.b,5)-.05)<1e-13);});
test('interval stability, symmetry, zero width, and asymmetric bounds',()=>{assert.equal(M.interval(2,2,5),0);assert.ok(Math.abs(M.interval(-1,2,10)-0.7928594164635998)<1e-12);assert.ok(M.interval(20,20.0000001,5)>0);assert.ok(Math.abs(M.interval(-2,1,5)-M.interval(-1,2,5))<1e-14);});
test('inverse tails round trip including extreme probabilities',()=>{for(const df of [1,2,5,30,1000000])for(const p of [1e-100,1e-20,1e-12,.025,.49])assert.ok(Math.abs(M.cdf(M.inv(p,df),df)/p-1)<2e-8);});
test('invalid df, probabilities, negative magnitude and reversed interval rejected',()=>{for(const df of [0,-1,1.5,NaN,Infinity,1000001])assert.throws(()=>M.inv(.95,df));for(const p of [0,1,-.1,NaN,Infinity])assert.throws(()=>M.inv(p,5));assert.throws(()=>solve({df:5,mode:'probability',type:'absGreater',a:-1}));assert.throws(()=>solve({df:5,mode:'probability',type:'between',a:2,b:1}));});

test('all forward regions agree with independent values and formulas',()=>{
  const cases=[['left',-2,undefined,.05096973941492914,'=T.DIST(-2,5,TRUE)'],['right',-2,undefined,.9490302605850709,'=T.DIST.RT(-2,5)'],['absGreater',2,undefined,.10193947882985828,'=T.DIST.2T(2,5)']];
  for(const [type,a,b,p,f] of cases){const m=solve({df:5,mode:'probability',type,a,b});assert.ok(Math.abs(m.p-p)<1e-13);assert.equal(m.formulas[0],f);}
});
