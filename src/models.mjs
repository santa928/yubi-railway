/**
 * Miniature railway model kit. Pass the host scene's THREE namespace.
 * Units: y is up; all assets rest at y=0. Buildings face +z and are centered
 * in x/z (1.5–2.1 wide, 1.4–1.9 deep, 1.4–3.2 tall). Train cars face +z,
 * are 0.78 wide × 1.96 long × 0.79 high; put the group at rail-head height.
 * Trees are approximately 0.9–1.1 wide × 1.45–1.8 tall. Parks are 2.2 square.
 * Additional kinds: building('cinema'|'greenhouse', seed),
 * park(seed, 'playground'|'flowerGarden'|'fountainPlaza'), tree(seed,'flowering').
 * Existing calls remain unchanged. New parks/buildings occupy <=2.6 square.
 * Shared material/geometry ownership belongs to the kit. Call dispose() only
 * after removing all of its instances. Individual model clones are independent
 * transforms, but intentionally share geometry and materials.
 */
export function createModelKit(THREE) {
  const geometryPool = new Set();
  const materialPool = new Map();
  const prototypes = new Map();
  let disposed = false;
  const palette = {
    cream: 0xfff2d8, white: 0xfffaf0, coral: 0xf17965, ochre: 0xefb647,
    turquoise: 0x42b6af, navy: 0x254559, glass: 0x326878, glassLight: 0x76bcc5,
    slate: 0x56777b, foundation: 0xd9cbb4, pavement: 0xf0dfbf,
    grass: 0x91bf68, leaf: 0x48976d, leafLight: 0x70ae70,
    leafDark: 0x35816a, bark: 0x9d7050, wheel: 0x253943,
    water: 0x68c7d0, pink: 0xf79795, yellow: 0xffd36a,
  };
  function material(key) {
    if (!materialPool.has(key)) materialPool.set(key, new THREE.MeshStandardMaterial({
      color: palette[key] ?? palette.cream,
      roughness: key === 'glass' || key === 'water' ? 0.32 : 0.82,
      metalness: key === 'wheel' ? 0.18 : 0.02,
    }));
    return materialPool.get(key);
  }
  function keep(geometry) { geometryPool.add(geometry); return geometry; }
  const cube = keep(new THREE.BoxGeometry(1, 1, 1).toNonIndexed());
  const cylinder = keep(new THREE.CylinderGeometry(0.5, 0.5, 1, 12).toNonIndexed());
  const cone = keep(new THREE.ConeGeometry(0.5, 1, 8).toNonIndexed());
  const sphere = keep(new THREE.IcosahedronGeometry(0.5, 1));
  const ring = keep(new THREE.TorusGeometry(.5,.045,8,24).toNonIndexed());
  const rounded = keep(new THREE.BoxGeometry(1, 1, 1, 4, 4, 4).toNonIndexed());
  {
    const p = rounded.attributes.position, n = rounded.attributes.normal;
    const point = new THREE.Vector3(), core = new THREE.Vector3(), delta = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      point.fromBufferAttribute(p, i);
      core.copy(point).clampScalar(-0.42, 0.42);
      delta.subVectors(point, core).normalize();
      point.copy(core).addScaledVector(delta, 0.08);
      p.setXYZ(i, point.x, point.y, point.z); n.setXYZ(i, delta.x, delta.y, delta.z);
    }
    rounded.computeBoundingSphere();
  }
  const roof = keep(new THREE.BufferGeometry());
  // Closed triangular prism: ridge along z, base at local y=0.
  const v = [[-.5,0,-.5],[.5,0,-.5],[0,1,-.5],[-.5,0,.5],[.5,0,.5],[0,1,.5]];
  const faces = [[0,2,1],[3,4,5],[0,3,5],[0,5,2],[1,2,5],[1,5,4],[0,1,4],[0,4,3]];
  roof.setAttribute('position', new THREE.Float32BufferAttribute(faces.flatMap(f => f.flatMap(i => v[i])), 3));
  roof.computeVertexNormals();

  function random(seed = 0) {
    const text = String(seed); let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function builder(name) {
    const batches = new Map();
    const matrix = new THREE.Matrix4(), pos = new THREE.Vector3(), scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion(), euler = new THREE.Euler();
    const point = new THREE.Vector3(), normal = new THREE.Vector3(), normalMatrix = new THREE.Matrix3();
    function add(geometry, key, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
      let batch = batches.get(key);
      if (!batch) batches.set(key, batch = { p: [], n: [] });
      pos.set(x,y,z); scale.set(sx,sy,sz); euler.set(rx,ry,rz); quaternion.setFromEuler(euler);
      matrix.compose(pos, quaternion, scale); normalMatrix.getNormalMatrix(matrix);
      const p = geometry.attributes.position, n = geometry.attributes.normal;
      const count = geometry.index ? geometry.index.count : p.count;
      for (let j = 0; j < count; j++) {
        const i = geometry.index ? geometry.index.getX(j) : j;
        point.fromBufferAttribute(p,i).applyMatrix4(matrix);
        normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();
        batch.p.push(point.x, point.y, point.z); batch.n.push(normal.x, normal.y, normal.z);
      }
    }
    function box(key,x,y,z,w,h,d,rx=0,ry=0,rz=0) { add(cube,key,x,y,z,w,h,d,rx,ry,rz); }
    function beam(key, a, c, radius=.035) {
      const start=new THREE.Vector3(...a), end=new THREE.Vector3(...c);
      const direction=end.clone().sub(start), center=start.clone().add(end).multiplyScalar(.5);
      const rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), direction.clone().normalize()));
      add(cylinder,key,center.x,center.y,center.z,radius*2,direction.length(),radius*2,rotation.x,rotation.y,rotation.z);
    }
    function finish() {
      const group = new THREE.Group(); group.name = name;
      for (const [key, batch] of batches) {
        const geometry = keep(new THREE.BufferGeometry());
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.p,3));
        geometry.setAttribute('normal',new THREE.Float32BufferAttribute(batch.n,3));
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry,material(key));
        mesh.name = `${name}-${key}`; mesh.castShadow = true; mesh.receiveShadow = true;
        group.add(mesh);
      }
      return group;
    }
    return {add,box,beam,finish};
  }
  function makeBuilding(kind, variant) {
    const b = builder(`miniature-${kind}`), {box,add} = b;
    const color = ['coral','ochre','turquoise','cream'][variant % 4];
    const roofColor = ['navy','coral','slate','navy'][(variant >> 1) % 4];
    // All facade elements are shallow solids, offset from the actual wall face.
    function window(x,y,z,w=.3,h=.39,side=false) {
      if (side) {
        box('cream',x,y,z,.04,h+.09,w+.09);
        box('glass',x + Math.sign(x)*.025,y,z,.025,h,w);
        box('cream',x + Math.sign(x)*.042,y,z,.022,h,.026);
      } else {
        box('cream',x,y,z,w+.09,h+.09,.04);
        box('glass',x,y,z + Math.sign(z)*.025,w,h,.025);
        box('cream',x,y,z + Math.sign(z)*.042,.025,h,.022);
      }
    }
    function door(x,y,z,w=.29,h=.65) {
      box('cream',x,y,z,w+.10,h+.06,.065);
      box('navy',x,y-.015,z+.04,w,h,.035);
      box('ochre',x+w*.28,y-.02,z+.065,.035,.045,.018);
    }
    if (kind === 'house') {
      box('foundation',0,.06,0,1.69,.12,1.48);
      box(color,0,.715,0,1.52,1.19,1.32);
      box('cream',0,1.305,0,1.66,.12,1.44);
      add(roof,roofColor,0,1.36,0,1.82,.55,1.61);
      box('cream',.44,1.66,-.29,.22,.64,.25);
      box(roofColor,.44,1.995,-.29,.28,.07,.30);
      door(0,.465,.683,.28,.64);
      window(-.47,.84,.68,.29,.37); window(.47,.84,.68,.29,.37);
      window(-.775,.85,0,.39,.40,true); window(.775,.85,0,.39,.40,true);
      window(-.38,.84,-.68,.30,.38); window(.38,.84,-.68,.30,.38);
      box('foundation',0,.10,.86,.55,.12,.25);
    } else if (kind === 'shop') {
      box('foundation',0,.055,0,1.91,.11,1.63);
      box(color,0,.72,0,1.78,1.33,1.45);
      box('cream',0,1.37,0,1.91,.14,1.59);
      box('navy',0,1.48,0,1.69,.08,1.37);
      box('cream',0,.68,.751,1.56,.88,.055);
      box('glass',-.45,.66,.789,.53,.67,.035);
      box('glass',.44,.66,.789,.55,.67,.035);
      door(0,.50,.78,.25,.77);
      box('cream',0,1.19,.79,1.55,.18,.07);
      box('ochre',0,1.205,.834,.88,.09,.025);
      box('coral',0,1.075,.91,1.93,.11,.42,.1,0,0);
      for (let i=0;i<5;i++) box('cream',-.76+i*.38,1.081,.91,.17,.115,.425,.1,0,0);
      window(-.909,.77,-.1,.47,.49,true); window(.909,.77,-.1,.47,.49,true);
      box('leaf',-.67,.18,.96,.40,.20,.20); box('leaf',.67,.18,.96,.40,.20,.20);
    } else if (kind === 'station') {
      box('foundation',0,.085,0,2.04,.17,1.65);
      box('cream',0,.64,0,1.9,1.12,1.40);
      box(color,0,.25,.716,1.92,.24,.055);
      add(roof,roofColor,0,1.20,0,2.12,.43,1.64);
      door(0,.53,.725,.42,.79);
      window(-.63,.70,.724,.36,.51); window(.63,.70,.724,.36,.51);
      window(-.965,.70,0,.45,.50,true); window(.965,.70,0,.45,.50,true);
      box(color,0,1.58,-.06,.49,.60,.49);
      add(roof,roofColor,0,1.88,-.06,.66,.30,.65);
      add(cylinder,'cream',0,1.68,.198,.27,.032,.27,Math.PI/2,0,0);
      box('navy',0,1.69,.22,.018,.09,.018); box('navy',.028,1.657,.221,.074,.015,.018);
      box('cream',0,1.025,.88,1.78,.10,.50);
      box('navy',-.81,.48,1.055,.055,.82,.055); box('navy',.81,.48,1.055,.055,.82,.055);
    } else if (kind === 'cinema') {
      // Oversize Art Deco steps and a lit projecting marquee read at phone scale.
      box('foundation',0,.075,0,2.22,.15,1.92);
      box('coral',0,.87,-.07,2.03,1.59,1.66);
      box('cream',0,1.69,-.07,2.17,.13,1.80);
      box('turquoise',0,1.85,.55,1.58,.34,.30);
      box('cream',0,2.02,.55,1.66,.08,.36);
      box('coral',0,2.15,.55,1.10,.26,.30);
      box('cream',0,2.30,.55,1.18,.07,.36);
      box('turquoise',0,2.43,.55,.55,.23,.30);
      box('cream',0,2.57,.55,.65,.07,.36);
      for(const x of [-.83,.83]) {
        box('cream',x,.81,.795,.14,1.39,.11);
        box('navy',x,.84,.858,.08,.77,.025);
        box('ochre',x,.90,.879,.037,.47,.019);
      }
      box('navy',0,.51,.792,1.31,.76,.075);
      for(const x of [-.39,0,.39]) {
        box('glass',x,.55,.843,.31,.60,.03);
        box('cream',x-.174,.52,.866,.035,.74,.035);
        box('ochre',x+.10,.44,.869,.022,.11,.022);
      }
      box('coral',0,1.11,.98,2.15,.22,.75);
      box('ochre',0,1.22,.98,2.20,.06,.79);
      box('cream',0,1.095,1.37,2.08,.14,.045);
      box('navy',0,1.48,.817,1.57,.38,.04);
      // Solid little CINEMA letters, batched into the same cream mesh.
      const glyphs=['111,100,100,100,111','111,010,010,010,111','101,111,111,111,101','111,100,110,100,111','101,111,111,101,101','010,101,111,101,101'];
      glyphs.forEach((glyph,i)=>glyph.split(',').forEach((row,j)=>[...row].forEach((on,k)=>{if(on==='1') box('cream',-.675+i*.232+k*.055,1.60-j*.053,.846,.045,.043,.025);} )));
      for(let i=0;i<11;i++) add(sphere,'yellow',-.95+i*.19,1.08,1.404,.055,.055,.043);
      for(const x of [-1.037,1.037]) {
        window(x,.88,-.28,.53,.62,true);
        box('cream',x,1.42,-.30,.035,.06,1.05);
      }
      box('foundation',0,.09,1.14,1.37,.13,.48);
    } else if (kind === 'greenhouse') {
      // Turquoise conservatory: faceted glass gable, pale exposed roof ribs.
      box('foundation',0,.075,0,2.24,.15,2.00);
      box('turquoise',0,.31,0,2.06,.43,1.80);
      box('glassLight',0,.85,0,1.94,.78,1.70);
      box('turquoise',0,1.22,0,2.14,.13,1.89);
      add(roof,'glassLight',0,1.285,0,2.16,.63,1.96);
      const slope=Math.atan2(.63,1.08), width=Math.hypot(1.08,.63);
      for(const x of [-.54,.54]) for(const z of [-.65,0,.65]) {
        box((z===0)!==(x>0)?'glassLight':'water',x,1.609,z,width-.09,.025,.55,0,0,x>0?-slope:slope);
      }
      for(const z of [-.985,-.33,.33,.985]) {
        b.beam('cream',[-1.09,1.28,z],[0,1.93,z],.033);
        b.beam('cream',[0,1.93,z],[1.09,1.28,z],.033);
      }
      box('cream',0,1.93,0,.085,.075,2.05);
      for(const x of [-1.015,1.015]) {
        for(const z of [-.84,-.28,.28,.84]) box('cream',x,.85,z,.055,.74,.055);
        box('cream',x,.76,0,.05,.045,1.76);
        box('turquoise',x,1.15,0,.08,.08,1.88);
      }
      for(const z of [-.864,.864]) for(const x of [-.94,-.47,0,.47,.94]) box('cream',x,.87,z,.055,.69,.055);
      door(0,.49,.924,.40,.76);
      box('turquoise',0,.93,.965,.56,.11,.16);
      for(const x of [-.76,.76]) {
        box('cream',x,.23,1.02,.47,.30,.31);
        add(sphere,'leaf',x,.48,1.02,.38,.41,.31);
        add(sphere,variant%2?'pink':'yellow',x,.63,1.035,.22,.20,.23);
      }
      box('foundation',0,.09,1.04,.62,.13,.46);
    } else if (kind === 'tower') {
      const height = 2.37 + ((variant >> 2) % 2)*.20;
      box('foundation',0,.075,0,1.63,.15,1.47);
      box(color,0,height/2+.15,0,1.39,height,1.23);
      for (let row=0;row<4;row++) {
        const y=.57+row*.53;
        box('cream',0,y+.255,0,1.44,.06,1.28);
        for (const x of [-.40,0,.40]) { if(row!==0 || x!==0) window(x,y,.633,.23,.30); }
        window(-.716,y,0,.49,.30,true); window(.716,y,0,.49,.30,true);
        for (const x of [-.32,.32]) window(x,y,-.633,.29,.30);
      }
      door(0,.455,.674,.31,.65);
      box('cream',0,height+.18,0,1.53,.15,1.37);
      box('navy',0,height+.30,0,1.25,.12,1.11);
      box('slate',.25,height+.43,-.1,.45,.22,.41);
    } else {
      box('foundation',0,.07,0,1.95,.14,1.71);
      box('cream',0,.77,0,1.76,1.4,1.49);
      box(color,0,1.455,0,1.93,.18,1.66);
      add(roof,'navy',0,1.545,0,2.05,.47,1.80);
      box(color,0,.64,.761,1.2,.98,.075);
      door(0,.51,.813,.42,.78);
      for (const x of [-.71,.71]) {
        box('cream',x,.72,.855,.15,1.28,.17);
        box('foundation',x,.13,.855,.25,.16,.25);
        box('cream',x,1.33,.855,.26,.14,.27);
      }
      window(-.897,.86,-.22,.45,.53,true); window(.897,.86,-.22,.45,.53,true);
      window(-.47,.86,-.764,.36,.53); window(.47,.86,-.764,.36,.53);
      box('foundation',0,.10,.965,1.55,.10,.27);
      add(cylinder,'ochre',0,1.70,.754,.25,.04,.25,Math.PI/2,0,0);
    }
    const result = b.finish(); result.userData = { modelType:'building',kind,variant,front:'+z' }; return result;
  }
  function makeTree(variant) {
    const b=builder('miniature-tree'), {add}=b;
    add(cylinder,'bark',0,.47,0,.15,.94,.15);
    if (variant % 3 === 0) {
      add(cone,'leafDark',0,.89,0,1.00,1.04,1.00);
      add(cone,'leaf',0,1.32,0,.73,.90,.73);
    } else {
      add(sphere,variant%2 ? 'leaf' : 'leafLight',0,1.11,0,1.06,1.19,.98,0,variant*.39,0);
      add(sphere,'leaf',.18,1.42,-.035,.69,.68,.71,0,variant*.27,0);
    }
    const result=b.finish(); result.userData={modelType:'tree',variant}; return result;
  }
  function makeFloweringTree(variant) {
    const b=builder('miniature-flowering-tree'), {add,beam}=b;
    add(cylinder,'bark',0,.49,0,.17,.98,.17);
    beam('bark',[0,.64,0],[-.28,1.16,.10],.058);
    beam('bark',[0,.79,0],[.28,1.28,-.04],.055);
    const bloom=variant%3===0?'cream':'pink', accent=variant%3===0?'pink':'cream';
    const lobes=[[-.33,1.21,.04,.73],[.32,1.25,.03,.79],[0,1.51,-.11,.83],[-.05,1.19,.32,.69],[.04,1.12,-.35,.66]];
    for(const [x,y,z,d] of lobes) add(sphere,bloom,x,y,z,d,d*.82,d,0,variant*.41,0);
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4+variant*.18;
      add(sphere,accent,Math.cos(a)*.44,1.29+(i%3)*.13,Math.sin(a)*.40,.15,.14,.16);
    }
    add(sphere,'leafLight',-.29,1.00,.03,.36,.24,.35);
    const result=b.finish();result.userData={modelType:'tree',kind:'flowering',variant};return result;
  }
  function makeTrain(kind, variant) {
    const b=builder(`miniature-train-${kind}`), {box,add}=b;
    const color=['turquoise','coral','ochre'][variant%3];
    box('navy',0,.205,0,.66,.12,1.73);
    add(rounded,'cream',0,.442,0,.72,.46,1.85);
    box(color,0,.327,0,.734,.125,1.80);
    add(rounded,color,0,.70,-.02,.70,.12,1.85);
    // Four wheels have axle axes along x, and sit on the local ground plane.
    for (const z of [-.59,.59]) for (const x of [-.31,.31])
      add(cylinder,'wheel',x,.10,z,.20,.12,.20,0,0,Math.PI/2);
    for (const x of [-.369,.369]) {
      for (const z of [-.59,-.18,.23]) box('glass',x,.502,z,.022,.22,.28);
      box('navy',x,.42,.67,.028,.35,.15);
      box('glassLight',x+Math.sign(x)*.006,.51,.67,.02,.19,.11);
    }
    if (kind === 'cab') {
      box(color,0,.405,.903,.62,.18,.045);
      box('glass',0,.53,.928,.51,.19,.025);
      box('cream',0,.53,.946,.027,.19,.019);
      for(const x of [-.235,.235]) box('yellow',x,.373,.937,.095,.047,.02);
      box('navy',0,.223,.933,.50,.055,.08);
    } else {
      box('navy',0,.445,.931,.24,.37,.025); box('glass',0,.518,.949,.15,.17,.02);
      box('navy',0,.445,-.931,.24,.37,.025); box('glass',0,.518,-.949,.15,.17,.02);
    }
    box('navy',0,.19,-.951,.16,.065,.058);
    const result=b.finish(); result.userData={modelType:'trainCar',kind,variant,forward:'+z',length:1.96}; return result;
  }
  function makePark(variant) {
    const b=builder('miniature-park'), {box,add}=b;
    box('grass',0,.045,0,2.2,.09,2.2);
    box('pavement',0,.095,0,.37,.025,2.2);
    box('pavement',0,.096,0,2.2,.026,.34);
    // Low perimeter planting beds and colored, geometrical flowers.
    for(const x of [-.76,.76]) {
      box('foundation',x,.115,-.65,.42,.10,.66);
      box('leafDark',x,.19,-.65,.34,.13,.58);
      for(const z of [-.82,-.49]) add(sphere,variant%2?'pink':'yellow',x,.28,z,.16,.15,.16);
    }
    if(variant%2===0) {
      add(cylinder,'foundation',.59,.14,.53,.68,.16,.68);
      add(cylinder,'water',.59,.23,.53,.55,.06,.55);
      add(cylinder,'cream',.59,.34,.53,.10,.22,.10);
      add(sphere,'water',.59,.50,.53,.20,.20,.20);
    } else {
      add(cylinder,'bark',.63,.44,.57,.12,.67,.12);
      add(sphere,'leafLight',.63,.98,.57,.73,.83,.72);
    }
    box('bark',-.66,.34,.60,.64,.08,.27);
    box('bark',-.66,.54,.715,.64,.26,.07);
    for(const x of [-.90,-.42]) box('navy',x,.215,.60,.055,.24,.20);
    const result=b.finish(); result.userData={modelType:'park',variant}; return result;
  }
  function makeGarden(kind,variant) {
    const b=builder(`miniature-${kind}`), {box,add,beam}=b;
    function bench(x,z,ry=0) {
      // Small furniture is explicitly modeled instead of texture details.
      const c=Math.cos(ry),s=Math.sin(ry);
      function part(key,dx,y,dz,w,h,d) {box(key,x+dx*c+dz*s,y,z-dx*s+dz*c,w,h,d,0,ry,0);}
      part('bark',0,.33,0,.67,.08,.27);
      part('bark',0,.53,-.115,.67,.28,.06);
      for(const dx of [-.25,.25]) part('navy',dx,.205,0,.055,.24,.23);
    }
    function flower(x,z,color='pink',height=.34) {
      add(cylinder,'leafDark',x,.17+height*.25,z,.026,height*.50,.026);
      add(sphere,'leaf',x-.05,.20,z,.16,.09,.09);
      for(let i=0;i<5;i++) {
        const a=i*Math.PI*2/5;
        add(sphere,color,x+Math.cos(a)*.072,height,z+Math.sin(a)*.072,.13,.085,.13);
      }
      add(sphere,'yellow',x,height+.025,z,.068,.073,.068);
    }
    if(kind==='playground') {
      box('grass',0,.035,0,2.55,.07,2.55);
      box('pavement',0,.085,0,2.40,.10,2.40);
      // Roofed climbing tower with the slide projecting toward +z.
      for(const x of [-.86,-.26]) for(const z of [-.78,-.20]) box('turquoise',x,.62,z,.075,1.06,.075);
      box('coral',-.56,.95,-.49,.79,.12,.81);
      for(const z of [-.82,-.16]) box('cream',-.56,1.20,z,.78,.065,.07);
      for(const x of [-.89,-.23]) box('cream',x,1.20,-.49,.07,.065,.69);
      add(cone,'coral',-.56,1.54,-.49,1.12,.44,1.12,0,Math.PI/4,0);
      const angle=.55;
      box('yellow',-.56,.57,.46,.45,.065,1.46,angle,0,0);
      for(const x of [-.805,-.315]) box('coral',x,.64,.46,.06,.145,1.47,angle,0,0);
      box('yellow',-.56,.18,1.12,.54,.06,.24);
      // Wide ladder beside the tower, six rungs visible from the front.
      for(const z of [-.66,-.33]) beam('navy',[-.07,.16,z],[-.24,.97,z],.028);
      for(let i=0;i<5;i++) box('ochre',-.074-i*.04,.22+i*.16,-.495,.05,.035,.38);
      // Independent open climbing cube / monkey bars: no solid building mass.
      for(const x of [.34,1.04]) for(const z of [-.79,.22]) box('turquoise',x,.70,z,.067,1.13,.067);
      for(const x of [.34,1.04]) box('coral',x,1.25,-.285,.09,.09,1.17);
      for(let i=0;i<6;i++) box('yellow',.69,1.25,-.78+i*.20,.77,.065,.06);
      for(let i=0;i<4;i++) box('coral',.69,.35+i*.25,-.79,.75,.06,.06);
      add(cylinder,'turquoise',.63,.17,.77,.57,.09,.57);
      add(cylinder,'coral',1.02,.18,.83,.31,.11,.31);
    } else if(kind==='flowerGarden') {
      box('grass',0,.045,0,2.52,.09,2.52);
      box('pavement',0,.108,0,.42,.04,2.51);
      box('pavement',0,.11,0,2.51,.045,.34);
      for(const x of [-.72,.72]) for(const z of [-.69,.69]) {
        box('foundation',x,.145,z,.80,.14,.74);
        box('leafDark',x,.223,z,.71,.08,.64);
        for(let row=0;row<2;row++) for(let col=0;col<3;col++) {
          const color=['pink','yellow','coral'][(row+col+(x>0?1:0)+variant)%3];
          flower(x-.22+col*.22,z-.16+row*.30,color,.35+((row+col)%2)*.08);
        }
      }
      // Garden entry arbor, made of open cream slats and flowering vines.
      for(const x of [-.34,.34]) box('cream',x,.64,1.07,.075,1.17,.075);
      box('cream',0,1.24,1.07,.91,.095,.21);
      for(const x of [-.37,-.18,0,.18,.37]) box('cream',x,1.28,1.07,.058,.055,.44);
      for(const x of [-.35,.35]) {
        for(let i=0;i<3;i++) add(sphere,'leaf',x,.52+i*.25,1.065,.18,.23,.16);
        for(let i=0;i<2;i++) add(sphere,'pink',x+(i-.5)*.08,.78+i*.28,1.16,.15,.13,.13);
      }
      add(cylinder,'foundation',0,.15,0,.43,.08,.43);
      add(sphere,'ochre',0,.33,0,.21,.30,.21);
    } else {
      box('grass',0,.035,0,2.54,.07,2.54);
      box('pavement',0,.085,0,2.44,.10,2.44);
      // Tiered fountain with visible blue water, raised rim and solid jets.
      add(cylinder,'foundation',0,.19,-.10,1.51,.23,1.51);
      add(cylinder,'water',0,.309,-.10,1.31,.045,1.31);
      add(ring,'cream',0,.325,-.10,1.43,1.43,1.43,Math.PI/2,0,0);
      add(cylinder,'cream',0,.49,-.10,.20,.38,.20);
      add(cylinder,'cream',0,.68,-.10,.76,.10,.76);
      add(cylinder,'water',0,.743,-.10,.63,.04,.63);
      add(ring,'cream',0,.755,-.10,.71,.71,.71,Math.PI/2,0,0);
      add(cylinder,'water',0,.92,-.10,.068,.34,.068);
      add(sphere,'water',0,1.12,-.10,.20,.23,.20);
      for(let i=0;i<6;i++) {
        const a=i*Math.PI/3;
        beam('water',[Math.cos(a)*.27,.73,-.1+Math.sin(a)*.27],[Math.cos(a)*.44,.45,-.1+Math.sin(a)*.44],.022);
        add(sphere,'water',Math.cos(a)*.47,.35,-.1+Math.sin(a)*.47,.11,.085,.11);
      }
      bench(-.81,.78); bench(.81,.78);
      for(const x of [-.94,.94]) {
        box('foundation',x,.19,-.88,.34,.24,.34);
        add(sphere,'leafLight',x,.43,-.88,.40,.42,.40);
        add(sphere,variant%2?'pink':'yellow',x,.64,-.88,.17,.15,.17);
      }
    }
    const result=b.finish();result.userData={modelType:'park',kind,variant};return result;
  }
  function instance(type, kind, seed, make) {
    if(disposed) throw new Error('This railway model kit has been disposed');
    const variant=random(seed)%8, key=`${type}:${kind}:${variant}`;
    if(!prototypes.has(key)) prototypes.set(key,make(kind,variant));
    return prototypes.get(key).clone(true);
  }
  return {
    building(kind='house',seed=0) {
      if(!['house','shop','station','tower','civic','cinema','greenhouse'].includes(kind)) kind='house';
      return instance('building',kind,seed,makeBuilding);
    },
    tree(seed=0,kind='tree') {
      return kind==='flowering' ? instance('tree','flowering',seed,(_,v)=>makeFloweringTree(v)) : instance('tree','tree',seed,(_,v)=>makeTree(v));
    },
    trainCar(kind='cab',seed=0) { return instance('train',kind==='coach'?'coach':'cab',seed,makeTrain); },
    park(seed=0,kind='park') {
      return ['playground','flowerGarden','fountainPlaza'].includes(kind) ? instance('park',kind,seed,makeGarden) : instance('park','park',seed,(_,v)=>makePark(v));
    },
    dispose() {
      if(disposed) return;
      disposed=true;
      for(const geometry of geometryPool) geometry.dispose();
      for(const mat of materialPool.values()) mat.dispose();
      geometryPool.clear(); materialPool.clear(); prototypes.clear();
    },
  };
}
