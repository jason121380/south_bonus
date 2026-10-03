window.API = {
  settingsPayload(fields,loaded,month) {
    const result={...loaded,margin:Number(fields.margin),goals:{...loaded.goals}};
    if(Number(fields.goal)>0)result.goals[month]=Number(fields.goal);else delete result.goals[month];
    return result;
  },
  async request(path,{method='GET',body}={}) {
    let response;
    try {
      response=await fetch(`/api${path}`,{method,credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    } catch {throw new Error('無法連線，請重新載入確認儲存結果後再重試');}
    if(response.status===204)return null;
    let result;try{result=await response.json();}catch{throw new Error('伺服器回應異常，請稍後重試');}
    if(!response.ok){if(response.status===401&&path!=='/login')window.dispatchEvent(new CustomEvent('session-expired'));const error=new Error(result.error||'操作失敗');error.status=response.status;throw error;}
    return result;
  }
};
