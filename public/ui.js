/* Styled controls keep their original form values and server validation. */
(() => {
  const controls = new Map();
  let active = null, sequence = 0;
  const make = (tag, className, text) => {
    const node = document.createElement(tag);node.className=className;
    if(text!==undefined)node.textContent=text;
    if(tag==='button')node.type='button';
    return node;
  };
  function close(focus=false){
    if(!active)return;
    const previous=active;active=null;previous.panel.hidden=true;previous.button.setAttribute('aria-expanded','false');
    if(focus)previous.button.focus();
  }
  function changed(input,value){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));sync();close(true);}
  function open(control){
    close();active=control;control.panel.hidden=false;control.button.setAttribute('aria-expanded','true');
    control.draw();control.panel.querySelector('[aria-selected="true"],button:not(:disabled)')?.focus();
  }
  function enhance(input){
    if(controls.has(input))return;
    const kind=input.tagName==='SELECT'?'select':input.type;
    const wrap=make('div','ui-control'),button=make('button','ui-trigger'),panel=make('div','ui-popover');
    panel.id=`ui-options-${++sequence}`;panel.hidden=true;panel.setAttribute('role',kind==='select'?'listbox':'dialog');
    button.setAttribute('aria-haspopup',kind==='select'?'listbox':'dialog');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',panel.id);
    const label=input.closest('label');const labelText=label?.firstChild?.textContent.trim()||'選擇';
    panel.setAttribute('aria-label',labelText);button.setAttribute('aria-label',labelText);
    input.before(wrap);wrap.append(input,button,panel);input.classList.add('ui-source');input.hidden=true;input.tabIndex=-1;input.setAttribute('aria-hidden','true');
    const control={input,button,panel,kind,draw(){}};controls.set(input,control);
    if(kind==='select'){
      control.draw=()=>{
        panel.replaceChildren();
        for(const option of input.options){
          const item=make('button','ui-option',option.textContent);item.disabled=option.disabled;item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.selected));
          item.addEventListener('click',()=>changed(input,option.value));panel.append(item);
        }
      };
    }else{
      let year,month;
      control.draw=()=>{
        const current=input.value||new Date().toISOString().slice(0,10);
        year=Number(current.slice(0,4));month=Number(current.slice(5,7))-1;drawCalendar();
      };
      function drawCalendar(){
        panel.replaceChildren();
        const header=make('div','ui-calendar-head'),back=make('button','ui-calendar-nav','‹'),next=make('button','ui-calendar-nav','›');
        back.setAttribute('aria-label',kind==='month'?'上一年':'上個月');next.setAttribute('aria-label',kind==='month'?'下一年':'下個月');
        header.append(back,make('strong','',kind==='month'?`${year} 年`:`${year} 年 ${month+1} 月`),next);panel.append(header);
        const move=delta=>{if(kind==='month')year+=delta;else{month+=delta;if(month<0){month=11;year--}if(month>11){month=0;year++}}drawCalendar()};
        back.onclick=()=>move(-1);next.onclick=()=>move(1);
        const grid=make('div',kind==='month'?'ui-month-grid':'ui-day-grid');panel.append(grid);
        if(kind==='date'){
          for(const day of ['日','一','二','三','四','五','六'])grid.append(make('span','ui-weekday',day));
          for(let i=0;i<new Date(year,month,1).getDay();i++)grid.append(make('span',''));
        }
        const count=kind==='month'?12:new Date(year,month+1,0).getDate();
        for(let i=1;i<=count;i++){
          const value=kind==='month'?`${year}-${String(i).padStart(2,'0')}`:`${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
          const item=make('button','ui-calendar-cell',kind==='month'?`${i} 月`:String(i));item.setAttribute('aria-selected',String(value===input.value));
          item.disabled=!!((input.min&&value<input.min)||(input.max&&value>input.max));item.onclick=()=>changed(input,value);grid.append(item);
        }
        const today=make('button','ui-today',kind==='month'?'本月':'今天');today.onclick=()=>changed(input,new Date().toLocaleDateString('sv-SE').slice(0,kind==='month'?7:10));panel.append(today);
      }
    }
    button.onclick=()=>active===control?close():open(control);
    button.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();open(control)}});
    panel.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return}
      if(event.key==='Tab'){close();return}
      const items=[...panel.querySelectorAll('button:not(:disabled)')],index=items.indexOf(document.activeElement);
      const step={ArrowDown:1,ArrowUp:-1,ArrowRight:1,ArrowLeft:-1}[event.key];
      if(step){event.preventDefault();items[(index+step+items.length)%items.length]?.focus()}
      if(event.key==='Home'||event.key==='End'){event.preventDefault();items[event.key==='Home'?0:items.length-1]?.focus()}
    });
  }
  function sync(){
    for(const [input,c] of controls){
      if(!input.isConnected){controls.delete(input);continue}
      const text=c.kind==='select'?input.selectedOptions[0]?.textContent||'請選擇':input.value?input.value.replaceAll('-',' / '):c.kind==='month'?'選擇月份':'選擇日期';
      if(c.button.textContent!==text)c.button.textContent=text;
      if(c.button.disabled!==input.disabled)c.button.disabled=input.disabled;
    }
  }
  function scan(){
    document.querySelectorAll('select,input[type=month],input[type=date]').forEach(enhance);
    document.querySelectorAll('form').forEach(form=>form.noValidate=true);sync();
  }
  document.addEventListener('click',event=>{if(active&&!active.panel.parentElement.contains(event.target))close();queueMicrotask(sync)});
  document.addEventListener('change',sync);document.addEventListener('reset',event=>{event.target.querySelectorAll('.ui-field-error').forEach(node=>node.remove());event.target.querySelectorAll('[aria-invalid]').forEach(node=>node.removeAttribute('aria-invalid'));setTimeout(sync)});
  document.addEventListener('submit',event=>{
    const form=event.target;
    form.querySelectorAll('.ui-field-error').forEach(node=>node.remove());form.querySelectorAll('[aria-invalid]').forEach(node=>node.removeAttribute('aria-invalid'));
    const invalid=[...form.elements].filter(input=>input.willValidate&&!input.validity.valid);
    if(!invalid.length)return;
    event.preventDefault();event.stopImmediatePropagation();
    for(const input of invalid){
      const v=input.validity;
      const message=v.valueMissing?'請填寫此欄位':v.tooShort?`請輸入至少 ${input.minLength} 個字元`:v.rangeUnderflow?`數值不能小於 ${input.min}`:v.rangeOverflow?`數值不能大於 ${input.max}`:v.stepMismatch?'請輸入符合格式的數值':'請確認輸入格式';
      const error=make('span','ui-field-error',message);error.id=`ui-error-${++sequence}`;error.setAttribute('role','alert');input.closest('label')?.append(error);
      const target=controls.get(input)?.button||input;target.setAttribute('aria-invalid','true');target.setAttribute('aria-describedby',error.id);
    }
    (controls.get(invalid[0])?.button||invalid[0]).focus();
  },true);
  document.addEventListener('input',event=>{
    if(event.target.validity?.valid){event.target.closest('label')?.querySelector('.ui-field-error')?.remove();event.target.removeAttribute('aria-invalid');controls.get(event.target)?.button.removeAttribute('aria-invalid')}
  });
  const confirmation=make('dialog','ui-confirm');
  confirmation.setAttribute('aria-label','確認操作');
  confirmation.innerHTML='<div class="dialog-card"><h2>確認操作</h2><p class="ui-confirm-message"></p><div class="dialog-actions"><button type="button" class="secondary">取消</button><button type="button" class="primary">確認</button></div></div>';
  document.body.append(confirmation);
  let pending=null;
  function finish(value){if(!pending)return;const resolve=pending;pending=null;confirmation.close();resolve(value)}
  confirmation.querySelector('.secondary').onclick=()=>finish(false);confirmation.querySelector('.primary').onclick=()=>finish(true);
  confirmation.addEventListener('cancel',event=>{event.preventDefault();finish(false)});confirmation.addEventListener('close',()=>finish(false));
  window.UI={sync,confirm(message){if(pending)return Promise.resolve(false);close();confirmation.querySelector('p').textContent=message;confirmation.showModal();confirmation.querySelector('.secondary').focus();return new Promise(resolve=>pending=resolve)}};
  const observer=new MutationObserver(scan);scan();observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','open']});
})();
