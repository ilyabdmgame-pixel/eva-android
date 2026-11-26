const width=128,height=64;
const hero=[
 '...IIII...',
 '..IHHHHI..',
 '..IHHSHI..',
 '...ISSSI..',
 '..IPPPPI..',
 '.IIPPPPII.',
 '..IPPPPI..',
 '..IIBBII..',
 '..IB..BI..',
 '..II..II..'
];
const colors={I:'#202032',H:'#743e56',S:'#ffbc8b',P:'#a885e1',B:'#485983'};

export function drawStreamFrame(ctx,frame){
 const x=frame;
 const wrap=(a,span)=>(a%span+span)%span;
 const draw=(fill,a,b,w,h)=>{ctx.fillStyle=fill;ctx.fillRect(Math.floor(a),Math.floor(b),w,h);};
 draw('#182744',0,0,width,height);
 draw('#26455f',0,20,width,26);
 draw('#336376',0,36,width,28);
 draw('#f6cb95',93,8,14,12);
 draw('#ffddab',96,6,8,16);
 for(let i=0;i<8;i++){
   const u=wrap(i*29-Math.floor(x*.22),140)-12,y=8+(i*11)%24;
   draw('#8399a7',u,y,13,2);draw('#526e84',u+3,y+2,16,3);
 }
 for(let i=0;i<8;i++){
   const u=wrap(i*22-Math.floor(x*.45),176)-22,y=29+(i*13)%12;
   draw('#2b4c63',u,y,17,26);draw('#376879',u+3,y-3,8,5);
   draw('#7fa19a',u+10,y+3,2,12);
 }
 draw('#293742',0,55,width,9);
 for(let i=-1;i<8;i++){
   const u=i*22-x%22;
   draw('#55786b',u,54,19,2);draw('#3b5057',u+3,59,7,2);
 }
 for(let i=-1;i<4;i++){
   const u=i*43-x%43+22,y=32+((i+Math.floor(x/43))&1)*9;
   draw('#71bca1',u,y,21,2);draw('#416c70',u+1,y+2,19,5);
   draw('#c4aa78',u+5,y+4,3,2);draw('#aacac1',u+14,y+3,2,2);
   const shine=(frame+i*5)%10<5;
   draw(shine?'#ffe7a4':'#e2b264',u+9,y-8,4,5);
   draw('#c47a54',u+10,y-3,2,1);
 }
 const jump=frame%29, lift=jump>=8&&jump<23?Math.sin((jump-8)*Math.PI/15)*21:0;
 const offsetY=44-lift+(lift===0&&frame%4<2?1:0);
 for(let row=0;row<hero.length;row++)for(let col=0;col<hero[row].length;col++){
   const ink=colors[hero[row][col]];
   if(ink)draw(ink,26+col,offsetY+row,1,1);
 }
 const bug=wrap(77-x,67)+20;
 draw('#423551',bug,49,8,5);draw('#84557a',bug+1,47,6,3);
 draw('#e6bda4',bug+2,49,1,1);draw('#e6bda4',bug+5,49,1,1);
 draw('#202536',0,0,32,7);
 for(let i=0;i<3;i++)draw(i===2?'#588093':'#ef897e',4+i*7,2,4,3);
 draw('#edb77e',25,2,3,3);
}
