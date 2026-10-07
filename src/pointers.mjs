// One route and one grounded effect for each pointer. UI owns capture/release.
export function createPointers(world){
 const active=new Map();
 function sample(id,finger){const p=world.pick(finger.x,finger.y);if(!p)return;world.setTouch(p,id);world.clearIntersecting(p);world.railway.add(p,id);}
 function begin(id,finger){if(active.has(id))return false;const p=world.pick(finger.x,finger.y);if(!p||!world.railway.begin(p,id))return false;active.set(id,{...finger});world.setTouch(p,id);world.clearIntersecting(p);return true;}
 function move(id,finger){if(!active.has(id))return;active.set(id,{...finger});sample(id,finger);}
 function finish(id,commit){if(!active.has(id))return;active.delete(id);world.railway.finish(commit,id);world.setTouch(null,id);}
 function update(){for(const [id,finger] of active)sample(id,finger);}
 function cancelAll(commit=false){for(const id of [...active.keys()])finish(id,commit);}
 return{active,begin,move,finish,update,cancelAll};
}
