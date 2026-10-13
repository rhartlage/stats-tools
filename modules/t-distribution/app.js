/* Browser-local teaching UI. Numeric controls provide every graph operation. */
const $=id=>document.getElementById(id),svg=$('tSvg');
const {pdf,cdf,sf,interval}=TMath;
const width=900,axisY=300,leftPad=55,plotWidth=790;
let current=null,drag=null,radius=4;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const exact=n=>String(Object.is(n,-0)?0:n);
const fmt=n=>Math.abs(n)>=1e7||(n!==0&&Math.abs(n)<1e-5)?n.toExponential(7):Number(n.toFixed(8)).toString();
const prob=n=>n===0?'0 (or below floating-point resolution)':n===1?'1 (to floating-point precision)':n<1e-6||n>1-1e-6?exact(n):n.toFixed(8);
const distinct=values=>{const labels=values.map(fmt);return new Set(labels).size<new Set(values).size?values.map(exact):labels;};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toX=t=>leftPad+(t+radius)/(2*radius)*plotWidth;
const fromX=x=>(x-leftPad)/plotWidth*2*radius-radius;
const toY=t=>axisY-pdf(t,current.df)*590;
function number(id,name) {
  const s=$(id).value.trim();if(!s||!Number.isFinite(Number(s)))throw new Error(`Enter a finite number for ${name}.`);return Number(s);
}
function configure() {
  const inverse=$('solveMode').value==='inverse',type=$('regionType').value;
  $('forwardControls').hidden=inverse;$('inverseControls').hidden=!inverse;$('bControl').hidden=type!=='between';$('practicePanel').hidden=inverse;
  $('regionType').options[2].textContent=inverse?'Central interval — equal unshaded tails':'Between two cutoffs';
  $('aLabel').textContent=type==='absGreater'?'Nonnegative critical magnitude (|t|)':type==='between'?'Lower cutoff (t)':'Signed cutoff (t)';
  $('regionHint').textContent=type==='absGreater'?'The probability is the combined area of both tails; each tail has half.':inverse&&type==='between'?'The requested middle area is centered on zero; the remaining area is split equally between two tails.':inverse&&type==='right'?'Enter the right-tail area. The cutoff is negative when that area exceeds 0.5.':'';
}
function readModel() {
  const df=number('dfInput','degrees of freedom'),mode=$('solveMode').value,type=$('regionType').value;
  return TModel.solve({df,mode,type,...(mode==='inverse'?{p:number('probabilityInput','the probability')}:{a:number('aInput','the cutoff'),...(type==='between'?{b:number('bInput','the upper cutoff')}:{})})});
}
function curvePath(lo,hi,area=false) {
  lo=Math.max(lo,-radius);hi=Math.min(hi,radius);if(lo>hi)return '';
  const n=Math.max(2,Math.ceil((hi-lo)*60));
  let s=area?`M ${toX(lo)} ${axisY} L ${toX(lo)} ${toY(lo)}`:`M ${toX(lo)} ${toY(lo)}`;
  for(let i=1;i<=n;i++){const t=lo+(hi-lo)*i/n;s+=` L ${toX(t)} ${toY(t)}`;}
  return s+(area?` L ${toX(hi)} ${axisY} Z`:'');
}
function draw(m) {
  radius=drag?.radius??Math.min(20,Math.max(4,Math.ceil(Math.max(...m.ts.map(Math.abs))+.5)));
  let s=`<title>${esc($('questionText').textContent)}. ${esc($('answerText').textContent)}</title><line x1="55" y1="300" x2="845" y2="300" stroke="currentColor"/>`;
  for(let i=-4;i<=4;i++) {const t=i*radius/4,x=toX(t);s+=`<line x1="${x}" x2="${x}" y1="45" y2="306" stroke="currentColor" opacity=".1"/><text x="${x}" y="332" text-anchor="middle" font-size="15" fill="var(--ink)">${fmt(t)}</text>`;}
  s+='<text x="450" y="373" text-anchor="middle" font-size="17" fill="var(--ink)">t cutoff · symmetric about zero</text>';
  s+=m.segments.map(([a,b])=>`<path d="${curvePath(a,b,true)}" fill="var(--accent-soft)"/>`).join('');
  s+=`<path d="${curvePath(-radius,radius)}" fill="none" stroke="var(--accent)" stroke-width="3.5"/>`;
  m.ts.forEach((t,i)=>{
    if(Math.abs(t)>radius)return;
    const x=toX(t),y=toY(t),label=`${m.ts.length===1?'Cutoff':i?'Upper':'Lower'}: ${distinct(m.ts)[i]}`;
    const slotLeft=m.ts.length>1&&i?468:55,slotRight=m.ts.length>1&&!i?432:845;
    const textWidth=Math.min(label.length*9.6,slotRight-slotLeft),labelLeft=clamp(x-textWidth/2,slotLeft,slotRight-textWidth);
    s+=`<g pointer-events="none"><line x1="${x}" x2="${x}" y1="300" y2="${y}" stroke="var(--accent-deep)" stroke-width="2" stroke-dasharray="5 4"/><circle cx="${x}" cy="300" r="8" fill="var(--accent-deep)" stroke="white" stroke-width="2"/><path d="M ${labelLeft+textWidth/2} 35 L ${x} ${y-4}" fill="none" stroke="var(--accent-deep)" opacity=".65"/><text x="${labelLeft}" y="26" font-family="Consolas,monospace" font-size="16" textLength="${textWidth}" lengthAdjust="spacingAndGlyphs" fill="var(--ink)">${esc(label)}</text></g>`;
  });
  svg.innerHTML=s;
  $('plotCaption').textContent=`${m.ts.some(t=>Math.abs(t)>radius)?'A cutoff is outside the displayed ±20 t range. ':m.mode==='inverse'&&m.ts.length>1?'Drag either boundary to change the area while keeping it centered on zero. ':'Drag a cutoff or shaded region; numeric inputs and sliders provide keyboard control. '}Tails continue beyond the plot. The calculation includes their full probability; the visible shading may omit substantial area at small df.`;
  for(const [id,t] of [['aSlider',m.type==='absGreater'?m.b:m.a],['bSlider',m.b??m.a]]) {
    $(id).min=id==='aSlider'&&m.type==='absGreater'?0:-radius;$(id).max=radius;$(id).value=clamp(t,Number($(id).min),radius);
    $(id).setAttribute('aria-valuetext',`${fmt(t)} t units${Math.abs(t)>radius?' (outside slider range; use numeric input)':''}`);
  }
}
const step=(title,text)=>`<li><strong>${esc(title)}</strong><p class="math-line">${esc(text)}</p></li>`;
function renderResult(m) {
  const [a,b]=distinct(m.ts);
  $('modelBadge').textContent=`Student t · df = ${m.df}`;
  $('questionText').textContent=m.type==='left'?`P(T < ${a})`:m.type==='right'?`P(T > ${a})`:m.type==='between'?`P(${a} < T < ${b})`:`P(T < ${a} or T > ${b})`;
  $('standardQuestion').textContent=`T follows Student t with ${m.df} degrees of freedom.`;
  $('answerText').textContent=m.mode==='inverse'?`${m.ts.length>1?'Critical bounds':'Signed cutoff'} ≈ ${m.ts.map(fmt).join(' and ')} · requested area ${prob(m.p)} (${fmt(100*m.p)}%)`:`Probability ≈ ${prob(m.p)} (${fmt(100*m.p)}%)`;
  $('workingTitle').textContent=m.mode==='inverse'?'Start with area, solve for t':'Start with t, calculate area';
  $('workingSteps').innerHTML=step('Describe the model',`T ~ t(df = ${m.df}). The distribution is symmetric about 0. For a one-sample mean, t = (x̄ − μ₀) / (s / √n), with df = n − 1.`)+step(m.mode==='inverse'?'Allocate the probability':'Combine the appropriate areas',m.arithmetic)+step(m.mode==='inverse'?'Read the critical value':'Interpret the result',m.mode==='inverse'?`The ${m.ts.length>1?'bounds are':'cutoff is'} ${m.ts.map(fmt).join(' and ')}. ${m.type==='absGreater'?'The upper bound is the positive critical magnitude.':m.type==='between'?'The unshaded tails are equal.':'The sign locates the cutoff relative to zero.'}`:`The shaded region contains approximately ${fmt(100*m.p)}% of the distribution.`);
  $('excelFormulas').innerHTML=m.formulas.map((f,i)=>`<div class="formula-group"><h4>${m.mode==='inverse'?(m.ts.length>1?(i?'Upper bound / positive magnitude':'Lower bound'):'Signed cutoff'):'Shaded probability'}</h4><div class="formula-row"><code>${esc(f)}</code><button type="button" class="copy-button" data-copy="${esc(f)}" aria-label="Copy ${esc(f)}">Copy</button></div></div>`).join('');
  $('excelNote').textContent='T.DIST.2T and T.INV.2T use the combined two-tail area. For a middle interval, supply 1 minus the middle area. Very narrow intervals and extreme tails may reach Excel’s numerical limits.';
}
function update() {
  configure();
  try {current=readModel();$('inputError').hidden=true;$('results').hidden=false;svg.hidden=false;svg.style.display='block';renderResult(current);draw(current);}
  catch(e){current=null;$('inputError').textContent=e.message;$('inputError').hidden=false;$('results').hidden=true;svg.hidden=true;svg.style.display='none';$('modelBadge').textContent='Check the inputs';$('plotCaption').textContent='Enter valid inputs to display the graph and worked answer.';}
  $('copyStatus').textContent='';
}
function writeCutoffs(ts,m) {$('aInput').value=exact(m.type==='absGreater'?Math.abs(ts[1]):ts[0]);if(ts.length>1&&m.type!=='absGreater')$('bInput').value=exact(ts[1]);}
function changed(){ $('estimateFeedback').textContent='Question changed. Make a new estimate, then check.';update(); }
['dfInput','aInput','bInput','probabilityInput'].forEach(id=>$(id).addEventListener('input',changed));
$('regionType').addEventListener('change',changed);
$('solveMode').addEventListener('change',()=>{if(current&&$('solveMode').value==='probability')writeCutoffs(current.ts,current);changed();});
for(const [id,index] of [['aSlider',0],['bSlider',1]])$(id).addEventListener('input',()=>{if(!current)return;let ts=[...current.ts],t=Number($(id).value);if(current.type==='absGreater')ts=[-Math.abs(t),Math.abs(t)];else{ts[index]=t;ts.sort((a,b)=>a-b);}writeCutoffs(ts,current);changed();});
function setExample(kind) {
  $('dfInput').value=kind==='cauchy'?1:['percentile','between'].includes(kind)?10:5;
  $('solveMode').value=['central','tails','percentile'].includes(kind)?'inverse':'probability';
  $('regionType').value={right:'right',between:'between',percentile:'left',central:'between',tails:'absGreater',cauchy:'right'}[kind];
  $('aInput').value=kind==='between'?-1:kind==='cauchy'?10:2;$('bInput').value=2;
  $('probabilityInput').value=kind==='tails'?.05:.95;$('estimateInput').value='';
  $('estimateFeedback').textContent='Estimate the shaded fraction, then compare it with the answer.';update();
}
document.querySelectorAll('[data-example]').forEach(b=>b.addEventListener('click',()=>setExample(b.dataset.example)));
$('resetStart').addEventListener('click',()=>setExample('right'));
$('checkEstimate').addEventListener('click',()=>{try{const estimate=number('estimateInput','your estimate');if(estimate<0||estimate>1)throw new Error('Enter a probability from 0 through 1.');if(!current)throw new Error('Correct the model inputs first.');$('estimateFeedback').textContent=`${Math.abs(estimate-current.p)<=.01?'Strong estimate!':'Compare with the shaded fraction.'} Your estimate: ${prob(estimate)}. Calculated area: ${prob(current.p)}.`;}catch(e){$('estimateFeedback').textContent=e.message;}});
$('excelFormulas').addEventListener('click',async event=>{const b=event.target.closest('[data-copy]');if(!b)return;try{await navigator.clipboard.writeText(b.dataset.copy);$('copyStatus').textContent='Excel formula copied.';}catch{$('copyStatus').textContent='Select the formula and copy with Ctrl+C (or Command+C).';}});
function point(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
function target(p){if(!current||p.y<35||p.y>axisY+15||p.x<leftPad||p.x>width-leftPad)return null;const i=current.ts.findIndex(t=>Math.abs(toX(t)-p.x)<20);if(i>=0)return{kind:'edge',index:i};const t=fromX(p.x);if(p.y>=toY(t)-10&&current.segments.some(([a,b])=>t>=a&&t<=b))return{kind:current.type==='between'&&current.mode==='probability'?'band':'edge',index:current.type==='absGreater'&&t>0?1:0};return null;}
svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;const p=point(e),t=target(p);if(!t)return;drag={...t,id:e.pointerId,start:fromX(p.x),radius,model:current};svg.setPointerCapture(e.pointerId);e.preventDefault();});
svg.addEventListener('pointermove',e=>{const p=point(e);if(!drag){svg.style.cursor=target(p)?'ew-resize':'default';return;}if(e.pointerId!==drag.id)return;const m=drag.model,t=Number(clamp(fromX(p.x),-radius,radius).toFixed(2));let ts=[...m.ts];if(m.mode==='inverse'){let p=m.type==='left'?cdf(t,m.df):m.type==='right'?sf(t,m.df):m.type==='between'?interval(-Math.abs(t),Math.abs(t),m.df):2*sf(Math.abs(t),m.df);$('probabilityInput').value=exact(clamp(p,1e-12,1-1e-12));}else{if(m.type==='absGreater')ts=[-Math.abs(t),Math.abs(t)];else if(drag.kind==='band'){const delta=clamp(t-drag.start,-radius-m.a,radius-m.b);ts=[m.a+delta,m.b+delta];}else{ts[drag.index]=t;ts.sort((a,b)=>a-b);}writeCutoffs(ts,m);}changed();});
function endDrag(){if(!drag)return;drag=null;svg.style.cursor='default';update();}
['pointerup','pointercancel','lostpointercapture'].forEach(e=>svg.addEventListener(e,endDrag));
window.addEventListener('blur',endDrag);
setExample('right');
