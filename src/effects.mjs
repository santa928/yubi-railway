// Shared solid geometry, bounded transient effects. No textures or sprite cards.
export function createEffects(THREE,root,{reducedMotion=false}={}){
 const group=new THREE.Group();group.name='drawing-and-town-effects';root.add(group);
 const ringGeo=new THREE.TorusGeometry(1,.055,5,48),sparkGeo=new THREE.OctahedronGeometry(.13,0);
 const colors=['#fffbd0','#ff9ecf','#65e5df','#ffd05b'];
 const materials=colors.map(color=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:.86,depthWrite:false}));
 const touchGroup=new THREE.Group();touchGroup.name='held-touch-bloom';group.add(touchGroup);touchGroup.visible=false;
 for(let i=0;i<4;i++){const ring=new THREE.Mesh(ringGeo,materials[i]);ring.rotation.x=-Math.PI/2;ring.position.y=.22+i*.035;touchGroup.add(ring);}
 for(let i=0;i<12;i++){const s=new THREE.Mesh(sparkGeo,materials[i%4]);touchGroup.add(s);}
 const trails=Array.from({length:24},()=>{const m=new THREE.Mesh(ringGeo,materials[0]);m.rotation.x=-Math.PI/2;m.visible=false;group.add(m);return{mesh:m,age:2};});
 const births=Array.from({length:12},()=>{const g=new THREE.Group();g.name='town-birth';g.visible=false;group.add(g);for(let i=0;i<2;i++){const r=new THREE.Mesh(ringGeo,materials[i===0?0:3]);r.rotation.x=-Math.PI/2;r.position.y=.15+i*.03;g.add(r);}for(let i=0;i<8;i++)g.add(new THREE.Mesh(sparkGeo,materials[i%4]));return{group:g,age:2};});
 const touchGroups=[touchGroup];for(let i=1;i<8;i++){const g=touchGroup.clone();g.visible=false;group.add(g);touchGroups.push(g);}const touches=new Map();let time=0,trailClock=0,trailIndex=0,birthIndex=0;
 function setTouch(p,key="default"){let t=touches.get(key);if(!p){if(t){t.group.visible=false;touches.delete(key);}return;}if(!t){const g=touchGroups.find(g=>![...touches.values()].some(t=>t.group===g));if(!g)return;t={group:g,p};touches.set(key,t);}t.p=p;t.group.visible=true;t.group.position.set(p.x,0,p.z);}
 function birth(p){if(reducedMotion)return;const b=births[birthIndex++%births.length];b.group.position.set(p.x,0,p.z);b.age=0;b.group.visible=true;}
 function tick(dt){time+=dt;trailClock+=dt;
  for(const {p:touch,group:touchGroup} of touches.values()){touchGroup.children.forEach((m,i)=>{if(i<4){const phase=reducedMotion?.45:(time*.9+i*.25)%1;m.scale.setScalar(.7+phase*1.75);}else{const a=(i-4)*Math.PI/6+time*.6;const r=1.6+Math.sin(time*3+i)*.2;m.position.set(Math.cos(a)*r,.30+Math.abs(Math.sin(time*2+i))*.55,Math.sin(a)*r);m.rotation.set(time*.6,0,time+i);m.scale.setScalar(.7+.4*Math.sin(time*3+i)**2);m.visible=!reducedMotion;}});
   if(!reducedMotion&&trailClock>=.055){const t=trails[trailIndex++%trails.length];t.age=0;t.mesh.visible=true;t.mesh.position.set(touch.x,.19,touch.z);}}
  if(trailClock>=.055)trailClock=0;
  for(const t of trails){t.age+=dt;t.mesh.visible=t.age<.75;t.mesh.scale.setScalar(Math.max(.001,(1-t.age/.75)*.32));}
  for(const b of births){b.age+=dt;b.group.visible=b.age<1.05;if(!b.group.visible)continue;const p=b.age/1.05;for(let i=0;i<2;i++)b.group.children[i].scale.setScalar((.65+p*1.9)*(i? .82:1));for(let i=2;i<10;i++){const m=b.group.children[i],a=(i-2)*Math.PI/4,r=.5+p*1.8;m.position.set(Math.cos(a)*r,.2+Math.sin(p*Math.PI)*1.25,Math.sin(a)*r);m.scale.setScalar(Math.max(.001,(1-p)*1.3));m.rotation.set(p*4,a,p*3);}}
 }
 function clear(){touches.clear();touchGroups.forEach(g=>g.visible=false);time=0;trailClock=0;for(const t of trails){t.age=2;t.mesh.visible=false;}for(const b of births){b.age=2;b.group.visible=false;}}
 function stats(){return{births:births.filter(b=>b.group.visible).length,trail:trails.filter(t=>t.mesh.visible).length,touch:touches.size>0,touches:touches.size};}
 function dispose(){root.remove(group);ringGeo.dispose();sparkGeo.dispose();materials.forEach(m=>m.dispose());}
 return{setTouch,birth,tick,clear,stats,dispose,touchGroup};
}
