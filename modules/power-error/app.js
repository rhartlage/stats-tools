/* Browser-local design exploration. No observed data, persistence, or requests. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const M = window.PowerMath;
  const defaults = {model:'mean',tail:'right',mu0:100,mu1:105,sigma:15,n:50,p1:.14,p2:.19,n1:681,n2:681,alpha:.05};
  let state = {...defaults}, result, bounds, yAnchor, geometry, dragging;
  const fields = ['mu0','mu1','sigma','n','p1','p2','n1','n2','alpha'];
  const fmt = (x,d=4) => !Number.isFinite(x) ? (x<0?'−∞':'∞') : (Math.abs(x)>0 && Math.abs(x)<.0001 ? x.toExponential(3) : Number(x.toFixed(d)).toLocaleString('en-US',{maximumFractionDigits:d}));
  const pct = x => (x*100).toFixed(x>0&&x<.0001?5:2)+'%';
  const tick = (x,d=3) => Math.abs(x)>=10000?x.toExponential(1):fmt(x,d);
  const text = (id,value) => { $(id).textContent=value; };
  const activeFields = () => state.model==='mean'?['mu0','mu1','effect','sigma','n','alpha']:['p1','p2','n1','n2','alpha'];
  function sync() {
    for(const id of fields) $(id).value=state[id];
    $('model').value=state.model; $('tail').value=state.tail; $('effect').value=Number((state.mu1-state.mu0).toPrecision(12));
    $('mean-fields').hidden=state.model!=='mean'; $('proportion-fields').hidden=state.model!=='proportions';
    for(const id of fields.concat('effect')) $(id).removeAttribute('aria-invalid');
    text('validation','');
  }
  function fit() {
    const spread=Math.max(result.se0,result.se1);
    bounds=[Math.min(result.mean0,result.mean1)-4.4*spread,Math.max(result.mean0,result.mean1)+4.4*spread];
    yAnchor=Math.max(M.normalPDF(0)/result.se0,M.normalPDF(0)/result.se1)*2.35;
  }
  function recalculate(refit=false) {
    result=M.derive(state); if(refit||!bounds) fit();
    $('lower-field').hidden=state.tail==='right'; $('upper-field').hidden=state.tail==='left';
    $('lower').value=Number.isFinite(result.lower)?Number(result.lower.toPrecision(10)):'';
    $('upper').value=Number.isFinite(result.upper)?Number(result.upper.toPrecision(10)):'';
    $('lower').removeAttribute('aria-invalid'); $('upper').removeAttribute('aria-invalid');
    text('cutoff-note',state.tail==='two'?'Two-sided cutoffs mirror around the null value; each null tail contains α/2.':'Cutoffs use the raw estimate scale shown on the horizontal axis.');
    renderText(); draw();
  }
  function renderText() {
    const r=result, mean=state.model==='mean', param=mean?'μ':'p₂ − p₁', sign={right:'>',left:'<',two:'≠'}[state.tail];
    const nullScenario=mean?`the population mean is ${fmt(state.mu0)}`:`both population rates equal the planning null rate ${pct(r.pooled)}`;
    const altScenario=mean?`the population mean is ${fmt(state.mu1)}`:`the population rates are p₁ = ${pct(state.p1)} and p₂ = ${pct(state.p2)}`;
    const zero=Math.abs(r.mean1-r.mean0)<1e-12;
    const wrong=(state.tail==='right'&&r.mean1<r.mean0)||(state.tail==='left'&&r.mean1>r.mean0);
    const actualAlt=!zero&&!wrong;
    text('beta-legend',actualAlt?'β (hatched)':'Non-rejection (hatched)'); text('power-legend',actualAlt?'Power':'Rejection');
    $('shading').querySelector('[value="beta"]').textContent=actualAlt?'β only':'Non-rejection';
    $('shading').querySelector('[value="power"]').textContent=actualAlt?'Power only':'Rejection';
    text('identity',actualAlt?'β + power = 1 for the specified alternative. α and β describe different sampling worlds; they do not need to add to 1.':'Non-rejection + rejection probability = 1 for the specified distribution. β and power labels apply only to an effect within the chosen alternative.');
    text('hypotheses',`H₀: ${param} = ${fmt(r.mean0)}   ·   Hₐ: ${param} ${sign} ${fmt(r.mean0)}   ·   specified ${param} = ${fmt(r.mean1)}`);
    text('alpha-value',pct(r.alpha)); text('beta-value',pct(r.beta)); text('power-value',pct(r.power));
    text('alpha-meaning',`If ${nullScenario}, about ${pct(r.alpha)} of repeated studies would reject H₀: a Type I error under this model.`);
    text('beta-label',actualAlt?'β · Type II error':'Non-rejection probability');
    text('power-label',actualAlt?'1 − β · Power':'Rejection probability');
    text('beta-meaning',actualAlt?`If ${altScenario}, about ${pct(r.beta)} of repeated studies would fail to reject H₀, missing this specified effect.`:`If ${altScenario}, about ${pct(r.beta)} of repeated studies would fail to reject H₀. ${zero?'This is the null case, so it is not a Type II error.':'This effect is outside the chosen alternative, so this is not β for that alternative.'}`);
    text('power-meaning',actualAlt?`If ${altScenario}, about ${pct(r.power)} of repeated studies would reject H₀, detecting this specified effect.`:`If ${altScenario}, about ${pct(r.power)} of repeated studies would reject H₀. ${zero?'This equals α, not power against a real alternative.':'The selected rejection direction is unchanged; this is not power against the chosen alternative.'}`);
    const estimate=mean?'x̄':'D̂ = p̂₂ − p̂₁';
    const rule=state.tail==='right'?`${estimate} > ${fmt(r.upper,6)}`:state.tail==='left'?`${estimate} < ${fmt(r.lower,6)}`:`${estimate} < ${fmt(r.lower,6)} or ${estimate} > ${fmt(r.upper,6)}`;
    text('decision-rule',`Reject H₀ when ${rule}. Otherwise, fail to reject H₀.`);
    const warnings=[...(r.warnings||[])];
    if(zero) warnings.push('The specified distribution equals the null: there is no actual alternative effect. Rejection probability equals α.');
    if(wrong) warnings.push('The specified effect is outside the chosen alternative. The tool does not reverse your test direction. Change the direction or the specified effect to study power against that alternative.');
    if(!mean) warnings.push('Planning approximation: smooth normal curves, untransformed difference, no continuity correction. These are approximate design rates, not exact binomial test errors.');
    text('model-warning',warnings.join(' '));
    const F=(title,symbolic,numeric)=>`<article class="pe-equation"><h3>${title}</h3><p class="pe-symbolic">${symbolic}</p><p class="pe-numeric">${numeric}</p></article>`;
    let equations='';
    if(mean){
      equations+=F('Standard error','SE = σ / √n',`SE = ${fmt(state.sigma)} / √${state.n} = ${fmt(r.se0,6)}`);
      equations+=F('Two sampling worlds','H₀: X̄ ∼ N(μ₀, σ²/n)<br>Specified: X̄ ∼ N(μ₁, σ²/n)',`H₀: N(${fmt(r.mean0)}, ${fmt(r.se0,6)}²)<br>Specified: N(${fmt(r.mean1)}, ${fmt(r.se1,6)}²)`);
      equations+=F('Standardized statistic','Z = (X̄ − μ₀) / (σ/√n)<br>H₀: Z ∼ N(0,1)<br>Specified: Z ∼ N((μ₁−μ₀)/SE, 1)',`Z = (X̄ − ${fmt(state.mu0)}) / ${fmt(r.se0,6)}<br>Specified standardized shift = ${fmt((r.mean1-r.mean0)/r.se0,6)}`);
      text('method-note','The curves are exact sampling distributions when observations are independent normal values with known population σ. Otherwise they are normal approximations whose adequacy depends on the population and design. σ is population variability; SE is variability of the sample mean.');
    } else {
      equations+=F('Planning null standard error','p̄ = (n₁p₁ + n₂p₂)/(n₁+n₂)<br>SE₀ = √[p̄(1−p̄)(1/n₁+1/n₂)]',`p̄ = (${state.n1}×${fmt(state.p1)} + ${state.n2}×${fmt(state.p2)})/(${state.n1}+${state.n2}) = ${fmt(r.pooled,6)}<br>SE₀ = √[${fmt(r.pooled,6)}(1−${fmt(r.pooled,6)})(1/${state.n1}+1/${state.n2})] = ${fmt(r.se0,8)}`);
      equations+=F('Specified alternative standard error','Δ = p₂ − p₁<br>SE₁ = √[p₁(1−p₁)/n₁ + p₂(1−p₂)/n₂]',`Δ = ${fmt(state.p2)} − ${fmt(state.p1)} = ${fmt(r.mean1,6)}<br>SE₁ = √[${fmt(state.p1)}(1−${fmt(state.p1)})/${state.n1} + ${fmt(state.p2)}(1−${fmt(state.p2)})/${state.n2}] = ${fmt(r.se1,8)}`);
      equations+=F('Two sampling worlds','D̂ = p̂₂ − p̂₁<br>H₀: D̂ ≈ N(0, SE₀²)<br>Specified: D̂ ≈ N(Δ, SE₁²)<br>Z = D̂ / SE₀',`H₀: N(0, ${fmt(r.se0,8)}²)<br>Specified: N(${fmt(r.mean1,6)}, ${fmt(r.se1,8)}²)<br>Specified Z ≈ N(${fmt(r.mean1/r.se0,6)}, ${fmt(r.se1/r.se0,6)}²)`);
      text('method-note','The planning null uses the sample-size-weighted rate p̄, held fixed for the proposed design. A realized pooled z test estimates that rate from data, so finite-sample errors need not equal these design approximations. This is not a Cohen h/arcsine calculation or an exact binomial test. The reference scenario p₁=.14, p₂=.19, n₁=n₂=681, right tail, α=.05 gives power ≈ .80031. Expected successes and failures should be adequate in both groups and under the planning null; warnings use a conservative minimum of 10.');
    }
    const q=state.tail==='two'?'1−α/2':state.tail==='right'?'1−α':'α';
    equations+=F('Decision cutoff(s)',state.tail==='two'?'z* = Φ⁻¹(1−α/2)<br>L = m₀ − z*SE₀; U = m₀ + z*SE₀':`z* = Φ⁻¹(${q})<br>c = m₀ + z*SE₀`,`α = ${fmt(r.alpha,8)}; z* = ${fmt(r.z,8)}<br>${state.tail==='two'?`L = ${fmt(r.mean0)} − ${fmt(r.z,6)} × ${fmt(r.se0,6)} = ${fmt(r.lower,8)}<br>U = ${fmt(r.mean0)} + ${fmt(r.z,6)} × ${fmt(r.se0,6)} = ${fmt(r.upper,8)}`:`c = ${fmt(r.mean0)} + ${fmt(r.z,6)} × ${fmt(r.se0,6)} = ${fmt(state.tail==='left'?r.lower:r.upper,8)}`}`);
    const betaFormula=state.tail==='right'?'β = Φ((c−m₁)/SE₁)':state.tail==='left'?'β = 1 − Φ((c−m₁)/SE₁)':'β = Φ((U−m₁)/SE₁) − Φ((L−m₁)/SE₁)';
    const alphaFormula=state.tail==='right'?'α = 1 − Φ((c−m₀)/SE₀)':state.tail==='left'?'α = Φ((c−m₀)/SE₀)':'α = Φ((L−m₀)/SE₀) + 1 − Φ((U−m₀)/SE₀)';
    const standard=v=>`(${fmt(v,6)} − ${fmt(r.mean1,6)})/${fmt(r.se1,6)}`;
    const betaNumeric=state.tail==='right'?`Φ(${standard(r.upper)})`:state.tail==='left'?`1 − Φ(${standard(r.lower)})`:`Φ(${standard(r.upper)}) − Φ(${standard(r.lower)})`;
    equations+=F('Areas under the curves',`${alphaFormula}<br>${actualAlt?betaFormula:betaFormula.replace('β','P(non-rejection)')}<br>${actualAlt?'Power = 1 − β':'P(rejection) = 1 − P(non-rejection)'}`,`α = ${fmt(r.alpha,8)}<br>${actualAlt?'β':'Non-rejection'} = ${betaNumeric} = ${fmt(r.beta,8)}<br>${actualAlt?'Power':'Rejection'} = 1 − ${fmt(r.beta,8)} = ${fmt(r.power,8)}`);
    equations+=F('Normal density shown','f(x; m, SE) = exp[−(x−m)²/(2SE²)] / (SE√(2π))','Null peak density = '+fmt(M.normalPDF(0)/r.se0,6)+'<br>Specified peak density = '+fmt(M.normalPDF(0)/r.se1,6)+'<br>Each full curve has area 1.');
    $('formulas').innerHTML=equations;
  }
  function draw() {
    if(!result)return;
    const svg=$('plot'), r=result, width=Math.max(280,$('plot-wrap').clientWidth), height=window.innerWidth<=720?350:390;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const left=48,right=width-18,top=51,bottom=height-65;
    const peak=Math.max(M.normalPDF(0)/r.se0,M.normalPDF(0)/r.se1), ymax=Math.max(yAnchor,peak*1.12);
    const X=v=>left+(v-bounds[0])/(bounds[1]-bounds[0])*(right-left), Y=v=>bottom-v/ymax*(bottom-top);
    geometry={left,right,top,bottom,width,height,X,Y};
    const clip=$('clip-rect');for(const [k,v]of Object.entries({x:left,y:top,width:right-left,height:bottom-top}))clip.setAttribute(k,v);
    let grid='',axis='';
    for(let i=0;i<=4;i++){const v=ymax*i/4,y=Y(v);grid+=`<line x1="${left}" x2="${right}" y1="${y}" y2="${y}" stroke="#e0e5ec"/><text x="${left-7}" y="${y+4}" text-anchor="end">${tick(v)}</text>`;}
    const ticks=width<450?4:6;
    for(let i=0;i<=ticks;i++){const v=bounds[0]+(bounds[1]-bounds[0])*i/ticks,x=X(v);axis+=`<line x1="${x}" x2="${x}" y1="${bottom}" y2="${bottom+5}" stroke="#738096"/><text x="${x}" y="${bottom+21}" text-anchor="middle">${tick(v,state.model==='mean'?1:3)}</text>`;}
    axis+=`<text x="${left}" y="17">Probability density</text><text x="${(left+right)/2}" y="${height-12}" text-anchor="middle">${state.model==='mean'?'Sample mean x̄ (raw units)':'Sample proportion difference p̂₂ − p̂₁'}</text>`;
    $('grid').innerHTML=grid; $('axis').innerHTML=axis;
    const density=(v,m,s)=>M.normalPDF((v-m)/s)/s;
    function path(m,s,a=bounds[0],b=bounds[1],fill=false){
      a=Math.max(a,bounds[0]);b=Math.min(b,bounds[1]);if(b<=a)return'';
      const values=[a,b];const count=Math.max(40,Math.ceil(600*(b-a)/(bounds[1]-bounds[0])));
      for(let i=0;i<=count;i++)values.push(a+(b-a)*i/count);
      // Resolve narrow peaks even when the modes are far apart on the raw axis.
      for(let i=-160;i<=160;i++){const v=m+i*s/20;if(v>a&&v<b)values.push(v);}
      const pts=[...new Set(values)].sort((u,v)=>u-v).map(v=>`${X(v)},${Y(density(v,m,s))}`);
      return fill?`M${X(a)},${bottom} L${pts.join(' L')} L${X(b)},${bottom} Z`:`M${pts.join(' L')}`;
    }
    const show=$('shading').value, shaded=(kind,m,s,a,b,color,opacity=1)=>show==='all'||show===kind?`<path data-region="${kind}" d="${path(m,s,a,b,true)}" fill="${color}" fill-opacity="${opacity}"/>`:'';
    let curves='';
    curves+=shaded('power',r.mean1,r.se1,-Infinity,r.lower,'#6c9ddd',.55)+shaded('power',r.mean1,r.se1,r.upper,Infinity,'#6c9ddd',.55);
    curves+=shaded('beta',r.mean1,r.se1,r.lower,r.upper,'url(#beta-hatch)');
    curves+=shaded('alpha',r.mean0,r.se0,-Infinity,r.lower,'#d34a60',.6)+shaded('alpha',r.mean0,r.se0,r.upper,Infinity,'#d34a60',.6);
    curves+=`<path data-curve="null" d="${path(r.mean0,r.se0)}" fill="none" stroke="#b52b46" stroke-width="3"/><path data-curve="alternative" d="${path(r.mean1,r.se1)}" fill="none" stroke="#245fbd" stroke-width="3"/>`;
    $('curves').innerHTML=curves;
    let offscreen=false;
    for(const id of ['lower','upper']){
      const bar=$(id+'-bar'),v=r[id],hidden=!Number.isFinite(v);bar.style.display=hidden?'none':'';bar.setAttribute('tabindex',hidden?'-1':'0');if(hidden)continue;
      const clipped=Math.max(bounds[0],Math.min(bounds[1],v));if(v!==clipped)offscreen=true;
      bar.setAttribute('transform',`translate(${X(clipped)},0)`);
      bar.setAttribute('aria-valuemin',Math.min(bounds[0],v));bar.setAttribute('aria-valuemax',Math.max(bounds[1],v));bar.setAttribute('aria-valuenow',v);bar.setAttribute('aria-valuetext',`${fmt(v,6)}; alpha ${pct(r.alpha)}; ${v!==clipped?'cutoff beyond displayed range':''}`);
      const hit=bar.querySelector('.pe-bar-hit');for(const[k,val]of Object.entries({x:-22,y:22,width:44,height:bottom-22}))hit.setAttribute(k,val);
      const line=bar.querySelector('line');line.setAttribute('x1',0);line.setAttribute('x2',0);line.setAttribute('y1',49);line.setAttribute('y2',bottom);
      const handle=bar.querySelector('.pe-bar-handle');for(const[k,val]of Object.entries({x:-20,y:25,width:40,height:28}))handle.setAttribute(k,val);
      const grip=bar.querySelector('text');grip.setAttribute('x',0);grip.setAttribute('y',46);
    }
    text('axis-note',`SE₀ = ${fmt(r.se0,6)}; SE₁ = ${fmt(r.se1,6)}. Horizontal scale stays fixed on n-only edits. ${ymax>yAnchor?'Density axis expanded to keep the peaks visible. ':''}${offscreen?'A cutoff is outside the plot; its handle is pinned to the edge. Use its numeric field or fit the axes. ':''}Areas include tails beyond the visible plot.`);
  }
  function setCutoff(value){
    if(!Number.isFinite(value))return;
    if(activeFields().some(id=>!$(id).validity.valid||$(id).value==='')){text('validation','Correct the marked design fields before moving the cutoff. Results show the last valid design.');return;}
    state.alpha=M.alphaForCutoff(state,value);$('alpha').value=Number(state.alpha.toPrecision(10));text('validation','');recalculate();
  }
  $('design').addEventListener('submit',e=>e.preventDefault());
  $('design').addEventListener('input',e=>{
    const id=e.target.id;if(id==='model'||id==='tail')return;
    const invalid=activeFields().filter(key=>!(id==='effect'&&key==='mu1')&&(!$(key).validity.valid||$(key).value===''));
    for(const key of activeFields())$(key).setAttribute('aria-invalid',String(invalid.includes(key)));
    if(invalid.length){text('validation','Enter valid values in the marked fields. Results show the last valid design.');return;}
    let next={...state};for(const key of fields)if(activeFields().includes(key))next[key]=Number($(key).value);
    if(id==='effect'){next.mu1=next.mu0+Number($('effect').value);$('mu1').value=next.mu1;if(!$('mu1').validity.valid){$('mu1').setAttribute('aria-invalid','true');text('validation','The specified mean must be between −1,000,000 and 1,000,000. Results show the last valid design.');return;}}
    else $('effect').value=Number((next.mu1-next.mu0).toPrecision(12));
    try{M.derive(next);state=next;text('validation','');recalculate(!['n','n1','n2','alpha'].includes(id));}catch(err){text('validation',err.message+' Results show the last valid design.');}
  });
  for(const id of ['model','tail'])$(id).addEventListener('change',()=>{state[id]=$(id).value;sync();recalculate(true);});
  for(const id of ['lower','upper'])$(id).addEventListener('change',()=>{
    const v=Number($(id).value);
    if($(id).value===''||!Number.isFinite(v)){text('validation','Enter a finite decision cutoff. Results show the last valid design.');$(id).setAttribute('aria-invalid','true');return;}
    if(state.tail==='two'&&((id==='lower'&&v>=result.mean0)||(id==='upper'&&v<=result.mean0))){text('validation','A two-sided lower cutoff must be below the null; the upper cutoff must be above it.');$(id).setAttribute('aria-invalid','true');return;}
    setCutoff(v);
  });
  for(const id of ['lower','upper'])$(id).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$(id).dispatchEvent(new Event('change'));}});
  for(const id of ['lower','upper']){
    const bar=$(id+'-bar');
    bar.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragging=id;bar.setPointerCapture(e.pointerId);bar.focus();e.preventDefault();});
    bar.addEventListener('pointermove',e=>{if(dragging!==id)return;const point=$('plot').createSVGPoint();point.x=e.clientX;point.y=e.clientY;const p=point.matrixTransform($('plot').getScreenCTM().inverse());let v=bounds[0]+(Math.max(geometry.left,Math.min(geometry.right,p.x))-geometry.left)/(geometry.right-geometry.left)*(bounds[1]-bounds[0]);if(state.tail==='two')v=id==='lower'?Math.min(v,result.mean0-1e-12):Math.max(v,result.mean0+1e-12);setCutoff(v);});
    const end=()=>{dragging=null;};bar.addEventListener('pointerup',end);bar.addEventListener('pointercancel',end);bar.addEventListener('lostpointercapture',end);
    bar.addEventListener('keydown',e=>{let v=result[id],step=(bounds[1]-bounds[0])/(e.shiftKey?100:1000);if(['ArrowRight','ArrowUp'].includes(e.key))v+=step;else if(['ArrowLeft','ArrowDown'].includes(e.key))v-=step;else if(e.key==='Home')v=bounds[0];else if(e.key==='End')v=bounds[1];else return;e.preventDefault();if(state.tail==='two')v=id==='lower'?Math.min(v,result.mean0-1e-12):Math.max(v,result.mean0+1e-12);setCutoff(v);});
  }
  $('shading').addEventListener('change',draw);
  $('refit').addEventListener('click',()=>{fit();const finite=[result.lower,result.upper].filter(Number.isFinite);for(const v of finite){bounds[0]=Math.min(bounds[0],v-result.se0);bounds[1]=Math.max(bounds[1],v+result.se0);}draw();});
  function preset(name){state={...defaults};if(name==='small')state.mu1=102;if(name==='two')state.tail='two';if(name==='proportions')state.model='proportions';sync();recalculate(true);}
  for(const button of document.querySelectorAll('[data-preset]'))button.addEventListener('click',()=>preset(button.dataset.preset));
  $('reset').addEventListener('click',()=>preset('mean'));
  new ResizeObserver(draw).observe($('plot-wrap'));
  sync();recalculate(true);
})();
