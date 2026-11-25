import {regionAt,solidWall,surfaceAt,waterAt} from './district.mjs';
import {streetSurface,crossing} from './town-plan.mjs';

const movable=new Set(['stove','basin','shower','fridge','screen','toilet','chair','lamp','plant','flowers','bin','notice','seasonTree','placedLamp','pickup','bucket','umbrella','easel','cargo','mail','market','grass','forage','sign','windsock']);
export function editableFixture(o){
  return Boolean(o&&!o.z&&(o.portable||o.art==='studio-cabinet'||movable.has(o.kind)));
}
export function placementIssue(o,p,fixtures,doors,people){
  const u=p.u,v=p.v,x=u+o.w,y=v+o.d;
  if(!Number.isFinite(u)||!Number.isFinite(v))return 'За краем карты';
  const region=regionAt(u,v),z=surfaceAt(u,v);
  if(!region||region!==regionAt(x,y))return 'Граница квартала';
  const inside=(a,b,gap)=>a>u-gap&&a<x+gap&&b>v-gap&&b<y+gap;
  if(people.some(a=>inside(a.u,a.v,.27)))return 'Здесь стоит персонаж';
  for(const f of fixtures){
    if(f.id===o.id)continue;
    if(x>f.u-.055&&u<f.u+f.w+.055&&y>f.v-.055&&v<f.v+f.d+.055)return 'Здесь уже есть предмет';
  }
  for(const door of doors){
    const reach=door.width+.24,across=door.width*.5+.23;
    const a=door.vertical?reach:across,b=door.vertical?across:reach;
    if(x>door.u-a&&u<door.u+a&&y>door.v-b&&v<door.v+b)return 'Оставь место для двери';
  }
  const nx=Math.max(1,Math.ceil(o.w/.12)),ny=Math.max(1,Math.ceil(o.d/.12));
  for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++){
    const a=u+o.w*i/nx,b=v+o.d*j/ny,s=streetSurface(a,b);
    if(s==='road'||s==='kerb'||crossing(a,b))return 'Оставь свободным проезд и переход';
    if(waterAt(a,b)||solidWall(a,b)||Math.abs(z-surfaceAt(a,b))>.009)return 'Нужна ровная свободная площадка';
  }
  return '';
}
