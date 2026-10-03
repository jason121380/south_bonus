export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function text(value, label, {required = false, max = 200} = {}) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new AppError(400, `${label}格式不正確`);
  return value.trim();
}
export function number(value, label, max = 1e10) {
  if (value == null || value === '' || typeof value === 'boolean' || !['number','string'].includes(typeof value)) throw new AppError(400, `請輸入${label}`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new AppError(400, `${label}必須為有效的非負數`);
  return n;
}
export function month(value) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new AppError(400,'月份格式不正確');
  return value;
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw new AppError(400,'日期格式不正確');
  return value;
}
function choice(value, allowed, label) {
  if (!allowed.includes(value)) throw new AppError(400, `請選擇${label}`);
  return value;
}
export function normalizeRecord(kind, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError(400,'資料格式不正確');
  if (kind === 'revenue' || kind === 'ad') {
    const row = {date:date(input.date),amount:number(input.amount,'金額')};
    if (kind === 'revenue') return {...row,designer:text(input.designer,'設計師'),service:text(input.service,'服務項目'),customerType:choice(input.customerType,['新客','回客','介紹'],'客人類型'),source:text(input.source,'客源',{required:true}),adAttributed:choice(input.adAttributed,['yes','no'],'廣告來源'),note:text(input.note,'備註',{max:2000})};
    return {...row,platform:text(input.platform,'平台',{required:true}),campaign:text(input.campaign,'活動'),note:text(input.note,'備註',{max:2000})};
  }
  if (!['subsidy','traffic-subsidy'].includes(kind)) throw new AppError(400,'不支援的紀錄類型');
  const row = {month:month(input.month),designer:text(input.designer,'設計師',{required:true}),monthlyAdFee:number(input.monthlyAdFee,'廣告費')};
  row.actualAdFee = row.monthlyAdFee * 1.05;
  if (kind === 'subsidy') {
    row.onlineRevenue = number(input.onlineRevenue,'網路業績');
    row.adItem = choice(input.adItem,['染髮','縮毛矯正','燙髮','護髮','接髮','其他'],'廣告項目');
    row.roas = row.actualAdFee ? row.onlineRevenue / row.actualAdFee : 0;
    row.roasHit = row.roas >= 3.5;
    for (const name of ['socialPost','replyWithin','followSop']) row[name] = row.roasHit ? '' : choice(input[name],['yes','no'],'三項配合度');
    const hits = [row.socialPost,row.replyWithin,row.followSop].filter(v=>v==='yes').length;
    row.allThreeBonus = !row.roasHit && hits === 3;
    row.subsidyPercent = row.roasHit ? 50 : hits * 10 + (row.allThreeBonus ? 10 : 0);
    row.replyMinutes = number(input.replyMinutes ?? 0,'回覆分鐘',100000);
    if (!Number.isInteger(row.replyMinutes)) throw new AppError(400,'回覆時間須為整數分鐘');
    const h = Math.floor(row.replyMinutes/60), m = row.replyMinutes % 60;
    row.replyTime = [h ? `${h} 小時` : '',m ? `${m} 分鐘` : ''].filter(Boolean).join(' ');
    row.talentType = choice(input.talentType || '一般',['一般','新秀','首次投放'],'身分類別');
  } else {
    row.actualRevenue = number(input.actualRevenue,'實業績');
    row.subsidyPercent = row.actualRevenue >= 300000 ? 50 : row.actualRevenue >= 250000 ? 40 : row.actualRevenue >= 200000 ? 30 : row.actualRevenue >= 150000 ? 20 : 0;
  }
  row.departmentSubsidy = row.actualAdFee * row.subsidyPercent / 100;
  row.designerBurden = row.actualAdFee - row.departmentSubsidy;
  return row;
}
export function normalizeSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError(400,'設定格式不正確');
  const margin = number(input.margin ?? 50,'毛利率',100), goals = {};
  if (input.goals && (typeof input.goals !== 'object' || Array.isArray(input.goals))) throw new AppError(400,'目標格式不正確');
  for(const [key,value] of Object.entries(input.goals || {})) goals[month(key)] = number(value,'目標');
  if(!Array.isArray(input.designers) || input.designers.length > 200) throw new AppError(400,'設計師名單格式不正確');
  const designers = [...new Set(input.designers.map(d=>text(d,'設計師',{required:true})))];
  if(!designers.length) throw new AppError(400,'至少保留一位設計師');
  return {margin,goals,designers};
}
