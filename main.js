'use strict';(function(){function aa(a){a-=179;return!Number.isInteger(a)||0>a||a>=pa.length?0:pa[a]}function W(a){return Ca[a]||0}function qa(a,b,g,e,m,c,n){let [p,k]=a<g?[a,g]:[g,a],[h,K]=b<e?[b,e]:[e,b];a=n?32:0;n=n?16:0;if(h===K)if(p===k)c(p,h,W(15));else{c(p,h,W(aa(m(p,h))&-33|8|a));for(n=p+1;n<k;n++)c(n,h,W(aa(m(n,h))&-33|12|a));c(k,h,W(aa(m(k,h))&-33|4|a))}else if(p===k){c(p,h,W(aa(m(p,h))&-17|2|n));for(a=h+1;a<K;a++)c(p,a,W(aa(m(p,a))&-17|3|n));c(p,K,W(aa(m(p,K))&-17|1|n))}else{c(p,h,W(aa(m(p,
h))&-49|10|a|n));for(b=p+1;b<k;b++)c(b,h,W(aa(m(b,h))&-33|12|a));c(k,h,W(aa(m(k,h))&-49|6|a|n));for(b=h+1;b<K;b++)c(p,b,W(aa(m(p,b))&-17|3|n)),c(k,b,W(aa(m(k,b))&-17|3|n));c(p,K,W(aa(m(p,K))&-49|9|a|n));for(b=p+1;b<k;b++)c(b,K,W(aa(m(b,K))&-33|12|a));c(k,K,W(aa(m(k,K))&-49|5|n|a))}}function ea(){return ra=ra||new Promise((a,b)=>{let g=indexedDB.open("dosdraw",1);g.onerror=()=>{b(g.error||"unable to open db")};g.onblocked=()=>{b("blocked")};g.onupgradeneeded=({oldVersion:e})=>{1>e&&(e=g.result,e.createObjectStore("sessions",
{autoIncrement:!0,keyPath:"id"}),e=e.createObjectStore("updates",{autoIncrement:!0,keyPath:"id"}),e.createIndex("bySessionId","sessionId",{unique:!1,multiEntry:!1}),e.createIndex("byParentUpdateId","parentUpdateId",{unique:!1,multiEntry:!1}))};g.onsuccess=()=>{a(g.result)}})}function Da(a){return ea().then(b=>new Promise((g,e)=>{let m=b.transaction(["sessions","updates"],"readwrite"),c=m.objectStore("sessions"),n=m.objectStore("updates"),p={sessionId:-1,headUpdateId:-1};m.oncomplete=()=>{g(p)};m.onerror=
()=>{e(m.error||"db failure")};let k=c.add({saved:!0,headUpdateId:-1});k.onsuccess=()=>{let h=k.result;p.sessionId=h;let K=n.add({sessionId:h,parentUpdateId:-1,data:a,x:0,y:0,width:80,height:25});K.onsuccess=()=>{let D=K.result;p.headUpdateId=D;c.put({id:h,saved:!0,headUpdateId:D})}}}))}function Ea(a,b){return ea().then(g=>new Promise((e,m)=>{let c=g.transaction(["sessions"],"readwrite");c.oncomplete=()=>{e()};c.onerror=()=>{m(c.error||"db failure")};let n=c.objectStore("sessions"),p=n.get(a);p.onsuccess=
()=>{let k=p.result;k&&!k.saved&&(k.saved=!0,k.headUpdateId=b,n.put(k))}}))}function Fa(a){let b=Infinity;var g=-Infinity;let e=Infinity;var m=-Infinity;for(var c=0;80>c;c++)for(var n=0;25>n;n++)a[80*n+c]&&(b=Math.min(b,c),g=Math.max(g,c),e=Math.min(e,n),m=Math.max(m,n));if(Infinity===b)return{width:0,height:0,x:0,y:0,data:new Uint16Array(0)};g=g+1-b;m=m+1-e;c=new Uint16Array(g*m);for(n=0;n<m;n++)c.set(a.subarray(80*(e+n)+b,80*(e+n)+b+g),n*g);return{width:g,height:m,x:b,y:e,data:c}}function Y(a,b,
g,e){let m=new Uint16Array(2E3);for(let K=0;K<m.length;K++)m[K]=g[K]^e[K];let {x:c,y:n,width:p,height:k,data:h}=Fa(m);return ea().then(K=>new Promise((D,q)=>{let G=K.transaction(["sessions","updates"],"readwrite"),E=G.objectStore("sessions"),L=G.objectStore("updates"),y=E.get(a),Z=-1;G.oncomplete=()=>{D(Z)};G.onerror=()=>{q(G.error||"db failure")};y.onsuccess=()=>{let N=y.result;if(N){let U=L.add({sessionId:N.id,x:c,y:n,width:p,height:k,data:h,parentUpdateId:b});U.onsuccess=()=>{Z=U.result;N.saved=
!1;N.headUpdateId=Z;E.put(N)}}else q("session not found: "+a)}}))}function Ga(a,b,g){return ea().then(e=>new Promise((m,c)=>{let n=e.transaction(["updates","sessions"],"readwrite"),p=n.objectStore("sessions"),k=n.objectStore("updates").get(b),h=-1;n.oncomplete=()=>{m({data:g,newUpdateId:h})};n.onerror=()=>{c(n.error||"db failure")};k.onsuccess=()=>{let K=k.result;if(!K)throw Error("update not found: "+b);if(K.sessionId!==a)throw Error("wrong session id");if(-1===K.parentUpdateId)h=b;else{h=K.parentUpdateId;
var D=p.get(a);sa(g,K);D.onsuccess=()=>{let q=k.result;if(!q)throw Error("session not found: "+a);q.saved=!1;q.headUpdateId=K.parentUpdateId;p.put(q)}}}}))}function Ha(a,b,g){return ea().then(e=>new Promise((m,c)=>{let n=e.transaction(["updates","sessions"],"readwrite"),p=n.objectStore("sessions"),k=n.objectStore("updates").index("byParentUpdateId"),h=-1;n.oncomplete=()=>{m({data:g,newUpdateId:h})};n.onerror=()=>{c(n.error||"db failure")};let K=k.openCursor(b,"prev");K.onsuccess=()=>{var D=K.result;
if(D){D=D.value;if(D.sessionId!==a)throw Error("wrong session id");sa(g,D);h=D.id;p.put({id:a,headUpdateId:D.id,saved:!1})}else h=b}}))}function*fa(a,b,g,e){let m=Math.abs(g-a),c=Math.abs(e-b),n=a<g?1:-1,p=b<e?1:-1,k=m-c;for(;;){yield[a,b];if(a===g&&b===e)break;let h=2*k;h>-c&&(k-=c,a+=n);h<m&&(k+=m,b+=p)}}function*ta(a,b,g,e){let m=Math.sign(g-a),c=Math.sign(e-b);if(0===m)if(0===c)yield[a,b];else for(g=b;g!==e+c;g+=c)yield[a,g];else if(0===c)for(;a!==g+m;a+=m)yield[a,b];else for(;b!==e+c;b+=c)for(let n=
a;n!==g+m;n+=m)yield[n,b]}function*Ia(a,b,g,e){let m=Math.sign(g-a),c=Math.sign(e-b);if(0===m)if(0===c)yield[a,b];else for(g=b;g!==e+c;g+=c)yield[a,g];else if(0===c)for(e=a;e!==g+m;e+=m)yield[e,b];else{for(let n=a;n!==g+m;n+=m)yield[n,b];for(b+=c;b!==e;b+=c)yield[a,b],yield[g,b];for(;a!==g+m;a+=m)yield[a,e]}}function Ja(){return new Promise((a,b)=>{let g=document.createElement("input");g.type="file";g.onchange=e=>{var m;(null===(m=g.files)||void 0===m?0:m.length)?a(g.files[0]):a(null)};g.click()})}
function V(a,b){let g=0;for(;a&b;){var e=Math.clz32(b);e=32-Math.clz32(~b<<e>>>e);e=b>>>e<<e;e&a&&(g|=e,a&=~e);b&=~e}return g}function Ka(a,b,g,e,m,c,n){if(!(0>a||0>b||80<=a||25<=b)){var p=Math.floor(a%1*8),k=Math.floor(b%1*8);a=Math.floor(a);b=Math.floor(b);var {charCode:h,bgColor:K,fgColor:D}=g(a,b);if(K===D||32===h||255===h)h=0;var q=!!(m[h][k]&128>>>p),G=q?D:K,E=[],L=q?0:255,y=q?0:65535,Z=V(128>>>p,m[h][k]^L),N=V(32768>>>k,c[h][p]^y);a:if(0!==b){var U=Z;for(let v=k-1;0<=v;v--)if(U=V(U,m[h][v]^
L),0===U)break a;E.push({x:a,y:b-1,side:"bottom",mask:U})}a:if(24!==b){for(k+=1;8>k;k++)if(Z=V(Z,m[h][k]^L),0===Z)break a;E.push({x:a,y:b+1,side:"top",mask:Z})}a:if(0!==a){L=N;for(k=p-1;0<=k;k--)if(L=V(L,c[h][k]^y),0===L)break a;E.push({x:a-1,y:b,side:"right",mask:L})}a:if(79!==a){for(p+=1;8>p;p++)if(N=V(N,c[h][p]^y),0===N)break a;E.push({x:a+1,y:b,side:"left",mask:N})}q?e(a,b,h,n,K):e(a,b,h,D,n);for(a=new Set([`${a},${b}`]);0<E.length;){let {x:v,y:B,side:ca,mask:M}=E.pop(),{charCode:J,bgColor:Q,
fgColor:ba}=g(v,B);if(Q!==G&&ba!==G||177===J||176===J&&Q!==G||178===J&&ba!==G)a.add(`${v},${B}`);else{if(ba===Q||32===J||255===J)J=0;b=Q===G?255:0;q=Q===G?65535:0;switch(ca){case "top":for(y=N=p=0;16>y;y++){M=V(M,m[J][y]^b);if(0===M)break;M&128&&(p|=V(1<<y,c[J][0]^q));M&1&&(N|=V(1<<y,c[J][7]^q))}0<y&&(M&&24!==B&&!a.has(`${v},${B+1}`)&&E.push({x:v,y:B+1,side:"top",mask:M}),p&&0!==v&&!a.has(`${v-1},${B}`)&&E.push({x:v-1,y:B,side:"right",mask:p}),N&&79!==v&&!a.has(`${v+1},${B}`)&&E.push({x:v+1,y:B,side:"left",
mask:N}),Q===G?e(v,B,J,ba,n):e(v,B,J,n,Q),a.add(`${v},${B}`));break;case "bottom":N=p=0;for(y=15;0<=y;y--){M=V(M,m[J][y]^b);if(0===M)break;M&128&&(p|=V(1<<y,c[J][0]^q));M&1&&(N|=V(1<<y,c[J][7]^q))}15>y&&(M&&0!==B&&!a.has(`${v},${B-1}`)&&E.push({x:v,y:B-1,side:"bottom",mask:M}),p&&0!==v&&!a.has(`${v-1},${B}`)&&E.push({x:v-1,y:B,side:"right",mask:p}),N&&79!==v&&!a.has(`${v+1},${B}`)&&E.push({x:v+1,y:B,side:"left",mask:N}),Q===G?e(v,B,J,ba,n):e(v,B,J,n,Q),a.add(`${v},${B}`));break;case "left":for(y=
N=p=0;8>y;y++){M=V(M,c[J][y]^q);if(0===M)break;M&32768&&(N|=V(128>>y,m[J][15]^b));M&1&&(p|=V(128>>y,m[J][0]^b))}0<y&&(M&&79!==v&&!a.has(`${v+1},${B}`)&&E.push({x:v+1,y:B,side:"left",mask:M}),p&&0!==B&&!a.has(`${v},${B-1}`)&&E.push({x:v,y:B-1,side:"bottom",mask:p}),N&&24!==B&&!a.has(`${v},${B+1}`)&&E.push({x:v,y:B+1,side:"top",mask:N}),Q===G?e(v,B,J,ba,n):e(v,B,J,n,Q),a.add(`${v},${B}`));break;case "right":N=p=0;for(y=7;0<=y;y--){M=V(M,c[J][y]^q);if(0===M)break;M&32768&&(N|=V(128>>y,m[J][15]^b));M&
1&&(p|=V(128>>y,m[J][0]^b))}7>y&&(M&&0!==v&&!a.has(`${v-1},${B}`)&&E.push({x:v-1,y:B,side:"right",mask:M}),p&&0!==B&&!a.has(`${v},${B-1}`)&&E.push({x:v,y:B-1,side:"bottom",mask:p}),N&&24!==B&&!a.has(`${v},${B+1}`)&&E.push({x:v,y:B+1,side:"top",mask:N}),Q===G?e(v,B,J,ba,n):e(v,B,J,n,Q),a.add(`${v},${B}`))}}}}}let ua=1===(new Uint8Array((new Uint16Array([1])).buffer))[0];var X;(function(a){a[a.Tile=255]="Tile";a[a.ForegroundColor=3840]="ForegroundColor";a[a.BackgroundColor=61440]="BackgroundColor";
a[a.All=65535]="All"})(X||(X={}));var ia;(function(a){a[a.Black=0]="Black";a[a.DarkBlue=1]="DarkBlue";a[a.DarkGreen=2]="DarkGreen";a[a.DarkCyan=3]="DarkCyan";a[a.DarkRed=4]="DarkRed";a[a.DarkMagenta=5]="DarkMagenta";a[a.Brown=6]="Brown";a[a.LightGrey=7]="LightGrey";a[a.DarkGrey=8]="DarkGrey";a[a.Blue=9]="Blue";a[a.Green=10]="Green";a[a.Cyan=11]="Cyan";a[a.Red=12]="Red";a[a.Magenta=13]="Magenta";a[a.Yellow=14]="Yellow";a[a.White=15]="White"})(ia||(ia={}));let va="#000 #008 #080 #088 #800 #808 #880 #ccc #888 #00f #0f0 #0ff #f00 #f0f #ff0 #fff".split(" ");
class wa{constructor(a){this.drawChar=a;this.buffer=new Uint16Array(2E3);this.buffer.fill(1792);this.canvas=document.createElement("canvas");this.canvas.width=640;this.canvas.height=400;this.ctx=this.canvas.getContext("2d");if(!this.ctx)throw Error("unable to get canvas context");}getBrush(a,b,g,e){if(!Number.isInteger(a)||!Number.isInteger(b))throw new TypeError("x and y must be integers");if(!Number.isInteger(g)||!Number.isInteger(b))throw new TypeError("width and height must be integers");if(0>
a||0>b||0>g||0>e||80<a+g||25<b+e)throw new RangeError("edges exceed screen");let m=new Uint16Array(g*e);for(let c=0;c<e;c++)m.set(this.buffer.subarray(80*(b+c)+a,80*(b+c)+a+g),c*g);return{data:m,width:g,height:e}}putBrush(a,b,g){let e,m,c=a.data;if(0>b){e=-b;if(e>=a.width)return;b=0}else e=0;m=Math.min(80-b,b+a.width);if(0>g){c=c.subarray(g*a.width);if(0===c.length)return;g=0}for(let n=0;n<a.height;n++)if(!(0>g+n)){if(25<=g+n)break;this.buffer.set(c.subarray((g+n)*a.width+e,(g+n)*a.width+m),80*g+
b);for(let p=e;p<m;p++)this.updateCanvas(g+n,b+p)}}getRawChar(a,b){return this.buffer[80*b+a]||0}setRawChar(a,b,g){0>a||0>b||80<=a||25<=b||(this.buffer[80*b+a]=g)}updateCanvas(a,b){if(!(0>a||0>b||80<=a||25<=b)){var g=this.getRawChar(a,b);this.drawChar(this.ctx,a,b,g&255,g>>8&15,g>>12&15)}}getCharInfo(a,b){a=this.getRawChar(a,b);return{charCode:a&255,fgColor:a>>8&15,bgColor:a>>12&15}}getChar(a,b){return this.getRawChar(a,b)&255}putChar(a,b,g,e,m){this.setRawChar(a,b,g|e<<8|m<<12);this.updateCanvas(a,
b)}setChar(a,b,g,e,m,c=X.All){this.setRawChar(a,b,this.buffer[80*b+a]&~c|(g|e<<8|m<<12)&c);this.updateCanvas(a,b)}fill(a,b,g,e=X.All){a=(a|b<<8|g<<12)&e;for(b=0;25>b;b++)for(g=0;80>g;g++)this.setRawChar(g,b,this.getRawChar(g,b)&~e|a),this.updateCanvas(g,b)}putVHalf(a,b,g){var e=this.getRawChar(a,b>>1);let m=e>>>8&15,c=e>>>12&15,n=b&1;switch(e&255){case 219:case 8:case 10:e=m;break;default:e=c;break;case 220:e=1===n?c:m;break;case 223:e=1===n?m:c}e===g?this.putChar(a,b>>1,219,g,c):0===n?this.putChar(a,
b>>1,223,g,e):this.putChar(a,b>>1,220,g,e)}putHHalf(a,b,g){var e=this.getRawChar(a>>1,b);let m=e>>>8&15,c=e>>>12&15,n=a&1;switch(e&255){case 219:case 8:case 10:e=m;break;default:e=c;break;case 222:e=1===n?c:m;break;case 221:e=1===n?m:c}e===g?this.putChar(a>>1,b,219,g,c):0===n?this.putChar(a>>1,b,221,g,e):this.putChar(a>>1,b,222,g,e)}saveBlob(){if(ua)return new Blob([this.buffer]);let a=new Uint16Array(this.buffer);for(let b=0;b<a.length;b++)a[b]=a[b]>>8|a[b]<<8;return new Blob([a],{type:"application/octet-stream"})}async loadBlob(a){a=
await a.arrayBuffer();if(a.byteLength!==this.buffer.byteLength)throw Error("invalid file");a=new Uint16Array(a);if(!ua)for(var b=0;b<a.length;b++)a[b]=a[b]>>8|a[b]<<8;this.buffer.set(a);for(a=0;25>a;a++)for(b=0;80>b;b++)this.updateCanvas(b,a)}}class La extends wa{constructor(a){super(a.drawChar);this.baseScreen=a;this.mask=new Uint8Array(this.buffer.length)}reset(){this.mask.fill(0);this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height)}updateCanvas(a,b){if(!(0>a||0>b||80<=a||25<=b))if(this.mask[80*
b+a]){let g=this.buffer[80*b+a];this.drawChar(this.ctx,a,b,g&255,g>>8&15,g>>12&15)}else this.ctx.clearRect(8*a,16*b,8,16)}getRawChar(a,b){return(this.mask[80*b+a]?this.buffer:this.baseScreen.buffer)[80*b+a]||0}setRawChar(a,b,g){0>a||0>b||80<=a||25<=b||(this.buffer[80*b+a]=g,this.mask[80*b+a]=255)}clearChar(a,b){0>a||0>b||80<=a||25<=b||(this.mask[80*b+a]=0,this.updateCanvas(a,b))}commit(){for(let a=0;a<this.buffer.length;a++)this.mask[a]&&(this.baseScreen.buffer[a]=this.buffer[a],this.baseScreen.updateCanvas(a%
80,Math.floor(a/80)));this.reset()}shiftChars(a,b,g,e){let m=80*b+a,c=m+g;0>e?(this.buffer.copyWithin(m,m-e,c),this.mask.copyWithin(m,m-e,c),this.mask.fill(0,c+e,c)):(this.buffer.copyWithin(m+e,m,c-e),this.mask.copyWithin(m+e,m,c-e),this.mask.fill(0,m,m+e));for(e=0;e<g;e++)this.updateCanvas(a+e,b)}isModified(a,b){return!!this.mask[80*b+a]}}let Ca=new Uint8Array([0,193,194,179,180,217,191,180,195,192,218,195,196,193,194,197,0,208,210,186,180,189,183,182,195,211,214,199,196,208,210,215,0,180,203,179,
181,190,184,181,198,212,213,198,205,207,209,216,0,208,210,186,181,188,187,185,198,200,201,204,205,202,203,206]),pa=new Uint8Array([3,7,39,23,22,38,55,19,54,53,21,37,6,9,13,14,11,12,15,43,27,57,58,61,62,59,44,63,45,29,46,30,25,41,42,26,31,47,5,10]),sa=(a,{x:b,y:g,width:e,height:m,data:c})=>{for(let n=0;n<m;n++)for(let p=0;p<e;p++)a[80*(g+n)+b+p]^=c[n*e+p]},ra,Ma=fetch("./chardata.png"),Na=a=>{var b=document.createElement("canvas");b.width=a.width;b.height=a.height;b=b.getContext("2d");if(!b)throw Error("unable to create 2D canvas");
b.drawImage(a,0,0);var g=a.width/9;a=new Uint8Array(4096);for(let e=0;256>e;e++){const {data:m}=b.getImageData(e%g*9,16*Math.floor(e/g),8,16);for(let c=0;16>c;c++)a[16*e+c]=m[32*c+3]?128:0,a[16*e+c]|=m[4*(8*c+1)+3]?64:0,a[16*e+c]|=m[4*(8*c+2)+3]?32:0,a[16*e+c]|=m[4*(8*c+3)+3]?16:0,a[16*e+c]|=m[4*(8*c+4)+3]?8:0,a[16*e+c]|=m[4*(8*c+5)+3]?4:0,a[16*e+c]|=m[4*(8*c+5)+3]?2:0,a[16*e+c]|=m[4*(8*c+7)+3]?1:0}b=Array(256);for(g=0;256>g;g++)b[g]=a.subarray(16*g,16*(g+1));return b},Oa=a=>{const b=new Uint16Array(2048);
for(var g=0;256>g;g++)for(let e=0;8>e;e++)for(let m=0;16>m;m++)b[8*g+e]|=(a[g][m]>>>7-e&1)<<m;a=Array(256);for(g=0;256>g;g++)a[g]=b.subarray(8*g,8*(g+1));return a};ia=[0,9786,9787,9829,9830,9827,9824,8226,9688,9675,9689,9794,9792,9834,9835,9788,9658,9668,8597,8252,182,167,9644,8616,8593,8595,8594,8592,8735,8596,9650,9660,...Array.from({length:95},(a,b)=>32+b),8962,199,252,233,226,228,224,229,231,234,235,232,239,238,236,196,197,201,230,198,244,246,242,251,249,255,214,220,162,163,165,8359,402,225,237,
243,250,241,209,170,186,191,8976,172,189,188,161,171,187,9617,9618,9619,9474,9508,9569,9570,9558,9557,9571,9553,9559,9565,9564,9563,9488,9492,9524,9516,9500,9472,9532,9566,9567,9562,9556,9577,9574,9568,9552,9580,9575,9576,9572,9573,9561,9560,9554,9555,9579,9578,9496,9484,9608,9604,9612,9616,9600,945,223,915,960,931,963,181,964,934,920,937,948,8734,966,949,8745,8801,177,8805,8804,8992,8993,247,8776,176,8729,183,8730,8319,178,9632,160];let xa=new Map(ia.map((a,b)=>[String.fromCodePoint(a),b]));window.addEventListener("DOMContentLoaded",
async function(){var a=await (await Ma).blob();let b=await createImageBitmap(a),g=b.width/9;a=(d,f,r,w,t,C)=>{d.save();d.globalCompositeOperation="source-over";d.fillStyle=va[C];d.fillRect(8*f,16*r,8,16);d.globalCompositeOperation="destination-out";d.drawImage(b,w%g*9,16*Math.floor(w/g),8,16,8*f,16*r,8,16);d.globalCompositeOperation="destination-over";d.fillStyle=va[t];d.fillRect(8*f,16*r,8,16);d.restore()};let e=Na(b),m=Oa(e),c=new wa(a),{sessionId:n,headUpdateId:p}=await Da(c.buffer);document.getElementById("undo").onclick=
async()=>{var d=new Uint16Array(c.buffer);let {data:f,newUpdateId:r}=await Ga(n,p,d);c.buffer.set(f);for(d=0;25>d;d++)for(let w=0;80>w;w++)c.updateCanvas(w,d);D.globalCompositeOperation="copy";D.drawImage(c.canvas,0,0);p=r};document.getElementById("redo").onclick=async()=>{var d=new Uint16Array(c.buffer);let {data:f,newUpdateId:r}=await Ha(n,p,d);c.buffer.set(f);for(d=0;25>d;d++)for(let w=0;80>w;w++)c.updateCanvas(w,d);D.globalCompositeOperation="copy";D.drawImage(c.canvas,0,0);p=r};let k=new La(c),
h=document.getElementById("editor");var K=document.getElementById("editor-overlay");let D=h.getContext("2d"),q=K.getContext("2d"),G=new Uint16Array(2E3),E=new Uint16Array(2E3);if(!D||!q)throw Error("unable to create canvas context");let L=X.All;document.getElementById("tile").onchange=d=>{L=d.target.checked?L|X.Tile:L&~X.Tile};document.getElementById("fgcolor").onchange=d=>{L=d.target.checked?L|X.ForegroundColor:L&~X.ForegroundColor};document.getElementById("bgcolor").onchange=d=>{L=d.target.checked?
L|X.BackgroundColor:L&~X.BackgroundColor};let y=[7,0,0],Z=document.querySelector(".palette"),N=(d,f)=>{const r=f?"background-selected":"foreground-selected";var w=Z.querySelectorAll(`.${r}`);for(let t=0;t<w.length;t++)w[t].classList.remove(r);(w=Z.querySelector(`.color-cell[data-value='${d}']`))&&w.classList.add(r);y[f?2:0]=d};Z.onpointerdown=d=>{if("mouse"===d.pointerType&&(0===d.button||2===d.button)){var f=0===d.button?"foreground-selected":"background-selected";for(let r=d.target;r&&!r.classList.contains("palette");r=
r.parentElement)if("value"in r.dataset){let w=Z.querySelectorAll(`.${f}`);for(let t=0;t<w.length;t++)w[t].classList.remove(f);r.classList.add(f);y[d.button]=+r.dataset.value;d.preventDefault();d.stopPropagation();break}}};Z.oncontextmenu=d=>{d.preventDefault()};let U=[219,0,0],v=0,B=0,ca=0,M=document.querySelector(".cursor"),J=(d,f)=>{M.style.left=`${8*d}px`;M.style.top=`${16*f}px`;M.style.animation="none";M.getBoundingClientRect();M.style.removeProperty("animation");v=d;B=f},Q=document.querySelector("#editor-block"),
ba="freehand",za={freehand:()=>{ba="freehand";h.onpointerdown=d=>{if("mouse"===d.pointerType){const {button:C,pointerId:l}=d;if(0===C||2===C){async function u(z){z.pointerId===l&&z.button===C&&(G.set(c.buffer),k.commit(),E.set(c.buffer),Y(n,p,G,E).then(A=>{p=A}),q.globalCompositeOperation="copy",q.drawImage(k.canvas,0,0),D.globalCompositeOperation="copy",D.drawImage(c.canvas,0,0),h.removeEventListener("pointermove",x),h.removeEventListener("pointerup",u))}function x(z){if(z.pointerId===l){var A=Math.floor(80*
(z.clientX-f.x)/f.width);z=Math.floor(25*(z.clientY-f.y)/f.height);for(const [F,I]of fa(w,t,A,z))k.setChar(F,I,U[C],y[0],y[2],L);q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0);w=A;t=z}}d.preventDefault();h.setPointerCapture(l);var f=h.getBoundingClientRect(),r=Math.floor(80*(d.clientX-f.x)/f.width);d=Math.floor(25*(d.clientY-f.y)/f.height);k.setChar(r,d,U[C],y[0],y[2],L);q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0);var w=r,t=d;h.addEventListener("pointermove",x);h.addEventListener("pointerup",
u)}}}},vbFreehand:()=>{h.onpointerdown=d=>{if("mouse"===d.pointerType){const {button:C,pointerId:l}=d;if(0===C||2===C){function u(z){z.pointerId===l&&z.button===C&&(G.set(c.buffer),k.commit(),E.set(c.buffer),Y(n,p,G,E).then(A=>{p=A}),q.globalCompositeOperation="copy",q.drawImage(k.canvas,0,0),D.globalCompositeOperation="copy",D.drawImage(c.canvas,0,0),h.removeEventListener("pointermove",x),h.removeEventListener("pointerup",u))}function x(z){if(z.pointerId===l){var A=Math.floor(80*(z.clientX-f.x)/
f.width);z=Math.floor(50*(z.clientY-f.y)/f.height);for(const [F,I]of fa(w,t,A,z))k.putVHalf(F,I,y[C]);q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0);w=A;t=z}}d.preventDefault();h.setPointerCapture(l);var f=h.getBoundingClientRect(),r=Math.floor(80*(d.clientX-f.x)/f.width);d=Math.floor(50*(d.clientY-f.y)/f.height);k.putVHalf(r,d,y[C]);q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0);var w=r,t=d;h.addEventListener("pointermove",x);h.addEventListener("pointerup",u)}}}},hbFreehand:()=>
{h.onpointerdown=d=>{if("mouse"===d.pointerType){const {button:C,pointerId:l}=d;if(0===C||2===C){function u(z){z.pointerId===l&&z.button===C&&(G.set(c.buffer),k.commit(),E.set(c.buffer),Y(n,p,G,E).then(A=>{p=A}),q.globalCompositeOperation="copy",q.drawImage(k.canvas,0,0),D.globalCompositeOperation="copy",D.drawImage(c.canvas,0,0),h.removeEventListener("pointermove",x),h.removeEventListener("pointerup",u))}function x(z){if(z.pointerId===l){var A=Math.floor(160*(z.clientX-f.x)/f.width);z=Math.floor(25*
(z.clientY-f.y)/f.height);for(const [F,I]of fa(w,t,A,z))k.putHHalf(F,I,y[C]);q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0);w=A;t=z}}d.preventDefault();h.setPointerCapture(l);var f=h.getBoundingClientRect(),r=Math.floor(160*(d.clientX-f.x)/f.width);d=Math.floor(25*(d.clientY-f.y)/f.height);k.putHHalf(r,d,y[C]);q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0);var w=r,t=d;h.addEventListener("pointermove",x);h.addEventListener("pointerup",u)}}}},lines:()=>{ba="lines";h.onpointerdown=
d=>{if("mouse"===d.pointerType){const {button:t,pointerId:C}=d;if(0===t||2===t){function l(x){x.pointerId===C&&x.button===t&&(G.set(c.buffer),k.commit(),E.set(c.buffer),Y(n,p,G,E).then(z=>{p=z}),q.globalCompositeOperation="copy",q.drawImage(k.canvas,0,0),D.globalCompositeOperation="copy",D.drawImage(c.canvas,0,0),h.removeEventListener("pointermove",u),h.removeEventListener("pointerup",l))}function u(x){if(x.pointerId===C){var z=Math.floor(80*(x.clientX-f.x)/f.width);x=Math.floor(25*(x.clientY-f.y)/
f.height);k.reset();for(const [A,F]of fa(r,w,z,x))k.setChar(A,F,U[t],y[0],y[2],L);q.drawImage(k.canvas,0,0)}}d.preventDefault();h.setPointerCapture(C);var f=h.getBoundingClientRect(),r=Math.floor(80*(d.clientX-f.x)/f.width),w=Math.floor(25*(d.clientY-f.y)/f.height);k.setChar(r,w,U[t],y[0],y[2],L);q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0);h.addEventListener("pointermove",u);h.addEventListener("pointerup",l)}}}},filledBox:()=>{ba="filledBox";h.onpointerdown=d=>{if("mouse"===d.pointerType){const {button:t,
pointerId:C}=d;if(0===t||2===t){function l(x){x.pointerId===C&&x.button===t&&(G.set(c.buffer),k.commit(),E.set(c.buffer),Y(n,p,G,E).then(z=>{p=z}),q.globalCompositeOperation="copy",q.drawImage(k.canvas,0,0),D.globalCompositeOperation="copy",D.drawImage(c.canvas,0,0),h.removeEventListener("pointermove",u),h.removeEventListener("pointerup",l))}function u(x){if(x.pointerId===C){var z=Math.floor(80*(x.clientX-f.x)/f.width);x=Math.floor(25*(x.clientY-f.y)/f.height);k.reset();for(const [A,F]of ta(r,w,z,
x))k.setChar(A,F,U[t],y[0],y[2],L);q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0)}}d.preventDefault();h.setPointerCapture(C);var f=h.getBoundingClientRect(),r=Math.floor(80*(d.clientX-f.x)/f.width),w=Math.floor(25*(d.clientY-f.y)/f.height);k.setChar(r,w,U[t],y[0],y[2],L);q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0);h.addEventListener("pointermove",u);h.addEventListener("pointerup",l)}}}},emptyBox:()=>{ba="emptyBox";h.onpointerdown=d=>{if("mouse"===d.pointerType){const {button:t,
pointerId:C}=d;if(0===t||2===t){function l(x){x.pointerId===C&&x.button===t&&(G.set(c.buffer),k.commit(),E.set(c.buffer),Y(n,p,G,E).then(z=>{p=z}),q.globalCompositeOperation="copy",q.drawImage(k.canvas,0,0),D.globalCompositeOperation="copy",D.drawImage(c.canvas,0,0),h.removeEventListener("pointermove",u),h.removeEventListener("pointerup",l))}function u(x){if(x.pointerId===C){var z=Math.floor(80*(x.clientX-f.x)/f.width);x=Math.floor(25*(x.clientY-f.y)/f.height);k.reset();for(const [A,F]of Ia(r,w,z,
x))k.setChar(A,F,U[t],y[0],y[2],L);q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0)}}d.preventDefault();h.setPointerCapture(C);var f=h.getBoundingClientRect(),r=Math.floor(80*(d.clientX-f.x)/f.width),w=Math.floor(25*(d.clientY-f.y)/f.height);k.setChar(r,w,U[t],y[0],y[2],L);q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0);h.addEventListener("pointermove",u);h.addEventListener("pointerup",l)}}}},singleBorder:()=>{h.onpointerdown=d=>{if("mouse"===d.pointerType){const {button:t,
pointerId:C}=d;if(0===t||2===t){function l(x){x.pointerId===C&&x.button===t&&(G.set(c.buffer),k.commit(),E.set(c.buffer),Y(n,p,G,E).then(z=>{p=z}),q.globalCompositeOperation="copy",q.drawImage(k.canvas,0,0),D.globalCompositeOperation="copy",D.drawImage(c.canvas,0,0),h.removeEventListener("pointermove",u),h.removeEventListener("pointerup",l))}function u(x){if(x.pointerId===C){var z=Math.floor(80*(x.clientX-f.x)/f.width);x=Math.floor(25*(x.clientY-f.y)/f.height);k.reset();qa(r,w,z,x,(A,F)=>c.getChar(A,
F),(A,F,I)=>k.setChar(A,F,I,y[0],y[2],L),!1);q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0)}}d.preventDefault();h.setPointerCapture(C);var f=h.getBoundingClientRect(),r=Math.floor(80*(d.clientX-f.x)/f.width),w=Math.floor(25*(d.clientY-f.y)/f.height);k.setChar(r,w,W(15),y[0],y[2],L);q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0);h.addEventListener("pointermove",u);h.addEventListener("pointerup",l)}}}},doubleBorder:()=>{h.onpointerdown=d=>{if("mouse"===d.pointerType){const {button:t,
pointerId:C}=d;if(0===t||2===t){function l(x){x.pointerId===C&&x.button===t&&(G.set(c.buffer),k.commit(),E.set(c.buffer),Y(n,p,G,E).then(z=>{p=z}),q.globalCompositeOperation="copy",q.drawImage(k.canvas,0,0),D.globalCompositeOperation="copy",D.drawImage(c.canvas,0,0),h.removeEventListener("pointermove",u),h.removeEventListener("pointerup",l))}function u(x){if(x.pointerId===C){var z=Math.floor(80*(x.clientX-f.x)/f.width);x=Math.floor(25*(x.clientY-f.y)/f.height);k.reset();qa(r,w,z,x,(A,F)=>c.getChar(A,
F),(A,F,I)=>k.setChar(A,F,I,y[0],y[2],L),!0);q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0)}}d.preventDefault();h.setPointerCapture(C);var f=h.getBoundingClientRect(),r=Math.floor(80*(d.clientX-f.x)/f.width),w=Math.floor(25*(d.clientY-f.y)/f.height);k.setChar(r,w,W(15),y[0],y[2],L);q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0);h.addEventListener("pointermove",u);h.addEventListener("pointerup",l)}}}},colorFloodFill:()=>{h.onpointerdown=d=>{if("mouse"===d.pointerType){const {button:w}=
d;if(0===w||2===w){d.preventDefault();var f=h.getBoundingClientRect(),r=80*(d.clientX-f.x)/f.width;d=25*(d.clientY-f.y)/f.height;G.set(c.buffer);Ka(r,d,(t,C)=>c.getCharInfo(t,C),(t,C,l,u,x)=>c.putChar(t,C,l,u,x),e,m,y[w]);E.set(c.buffer);Y(n,p,G,E).then(t=>{p=t});D.globalCompositeOperation="copy";D.drawImage(c.canvas,0,0)}}}},pick:()=>{h.onpointerdown=d=>{if("mouse"===d.pointerType){const {button:C,pointerId:l}=d;if(0===C||2===C){function u(z){z.pointerId===l&&z.button===C&&(h.removeEventListener("pointermove",
x),h.removeEventListener("pointerup",u),da.value=ba,da.dispatchEvent(new Event("change")))}function x(z){if(z.pointerId===l){var A=h.getBoundingClientRect(),{charCode:F,fgColor:I,bgColor:R}=c.getCharInfo(Math.floor(80*(z.clientX-A.x)/A.width),Math.floor(25*(z.clientY-A.y)/A.height));L&X.Tile&&ma(F,2===C);L&X.ForegroundColor&&N(I,!1);L&X.BackgroundColor&&N(R,!0)}}d.preventDefault();h.setPointerCapture(l);var f=h.getBoundingClientRect(),{charCode:r,fgColor:w,bgColor:t}=c.getCharInfo(Math.floor(80*(d.clientX-
f.x)/f.width),Math.floor(25*(d.clientY-f.y)/f.height));L&X.Tile&&ma(r,2===C);L&X.ForegroundColor&&N(w,!1);L&X.BackgroundColor&&N(t,!0);h.addEventListener("pointermove",x);h.addEventListener("pointerup",u)}}}},text:()=>{function d(l){if("AltLeft"===l.code||"AltRight"===l.code)l.preventDefault(),l.stopPropagation();else{switch(l.key){case "Tab":return;case "ArrowDown":if(l.altKey||l.ctrlKey||l.metaKey)return;J(v,Math.min(B+1,24));l.preventDefault();l.stopPropagation();return;case "ArrowUp":if(l.altKey||
l.ctrlKey||l.metaKey)return;J(v,Math.max(B-1,0));l.preventDefault();l.stopPropagation();return;case "ArrowLeft":if(l.altKey||l.ctrlKey||l.metaKey)return;0===v?0!==B&&J(79,B-1):(v-1<ca&&(ca=v-1),J(v-1,B));l.preventDefault();l.stopPropagation();return;case "ArrowRight":if(l.altKey||l.ctrlKey||l.metaKey)return;79===v?24!==B&&J(0,B+1):J(v+1,B);l.preventDefault();l.stopPropagation();return;case "Enter":if(l.altKey||l.ctrlKey||l.metaKey)return;J(ca,Math.min(24,B+1));l.preventDefault();l.stopPropagation();
return;case "End":case "PageDown":if(l.altKey||l.ctrlKey||l.metaKey)return;J(v,24);l.preventDefault();l.stopPropagation();return;case "Home":case "PageUp":if(l.altKey||l.ctrlKey||l.metaKey)return;J(v,0);l.preventDefault();l.stopPropagation();return;case "Backspace":if(l.altKey||l.ctrlKey||l.metaKey)return;0===v?0!==B&&J(79,B-1):(v-1<ca&&(ca=v-1),J(v-1,B));k.shiftChars(v,B,80-v,-1);q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0);return;case "Delete":if(l.altKey||l.ctrlKey||l.metaKey)return;
k.shiftChars(v,B,80-v,-1);q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0);return}if(l.altKey&&!l.ctrlKey&&3===l.location&&"0"<=l.key&&"9">=l.key)C.push(l.key),l.preventDefault(),l.stopPropagation();else if(!l.ctrlKey&&!l.altKey){const u=xa.get(l.key);"number"===typeof u&&(t(u),l.preventDefault(),l.stopPropagation())}}}function f(l){if("Alt"===l.key||"AltLeft"===l.code||"AltRight"===l.code){if(0<C.length){const u=Number.parseInt(C.slice(-3).join(""))&255;C.length=0;t(u)}l.preventDefault();
l.stopPropagation()}}function r(l){var u,x;const z=null===(u=l.clipboardData)||void 0===u?void 0:u.getData("text");if(z){l.preventDefault();for(const A of z.replace(/\r\n?|\n\r/g,"\n"))"\n"===A?J(ca,Math.min(24,B+1)):t(null!==(x=xa.get(A))&&void 0!==x?x:63)}}Q.focus();let w=!1;h.onpointerdown=l=>{if("mouse"===l.pointerType){var {button:u}=l;if(0===u){l.preventDefault();u=h.getBoundingClientRect();var x=Math.floor(80*(l.clientX-u.x)/u.width);J(x,Math.floor(25*(l.clientY-u.y)/u.height));ca=x;Q.focus()}}};
const t=l=>{w=!0;let u=v;for(;k.isModified(u,B);)if(80===++u){u--;break}u>v&&k.shiftChars(v,B,u+1-v,1);k.setChar(v,B,l,y[0],y[2],L);q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0);79===v?24!==B&&J(0,B+1):J(v+1,B)};Q.onblur=function(){w&&(G.set(c.buffer),k.commit(),E.set(c.buffer),Y(n,p,G,E).then(l=>{p=l}),q.globalCompositeOperation="copy",q.drawImage(k.canvas,0,0),D.globalCompositeOperation="copy",D.drawImage(c.canvas,0,0),w=!1)};let C=[];Q.addEventListener("keydown",d);Q.addEventListener("keyup",
f);document.addEventListener("paste",r);return()=>{Q.onblur=null;w&&(G.set(c.buffer),k.commit(),E.set(c.buffer),Y(n,p,G,E).then(l=>{p=l}),q.globalCompositeOperation="copy",q.drawImage(k.canvas,0,0),D.globalCompositeOperation="copy",D.drawImage(c.canvas,0,0));Q.removeEventListener("keydown",d);Q.removeEventListener("keyup",f);document.removeEventListener("paste",r)}},gradientBox:()=>{h.onpointerdown=d=>{if("mouse"===d.pointerType){const {button:l,pointerId:u}=d;if(0===l||2===l){function x(A){A.pointerId===
u&&A.button===l&&(G.set(c.buffer),k.commit(),E.set(c.buffer),Y(n,p,G,E).then(F=>{p=F}),q.globalCompositeOperation="copy",q.drawImage(k.canvas,0,0),D.globalCompositeOperation="copy",D.drawImage(c.canvas,0,0),h.removeEventListener("pointermove",z),h.removeEventListener("pointerup",x))}function z(A){if(A.pointerId===u){var F=Math.floor(80*(A.clientX-r.x)/r.width);A=Math.floor(25*(A.clientY-r.y)/r.height);k.reset();var [I,R]=w<F?[w,F]:[F,w],[S,T]=t<A?[t,A]:[A,t];for(const [O,H]of ta(w,t,F,A)){if(0>O||
0>H||80<=O||25<=H)continue;F=C(O,H,I,R,S,T);const {charCode:P,fgColor:na,bgColor:Pa}=ya(f,F);k.setChar(O,H,P,na,Pa)}q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0)}}var f=oa();if(0!==f.length){d.preventDefault();h.setPointerCapture(u);var r=h.getBoundingClientRect(),w=Math.floor(80*(d.clientX-r.x)/r.width),t=Math.floor(25*(d.clientY-r.y)/r.height);k.setChar(w,t,219,f[0],0);q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0);d=document.getElementById("gradient-direction-selector");
var C="up"===d.value?(A,F,I,R,S,T)=>(F-T)/(S-T):"right"===d.value?(A,F,I,R,S,T)=>(A-I)/(R-I):"left"===d.value?(A,F,I,R,S,T)=>(A-R)/(I-R):(A,F,I,R,S,T)=>(F-S)/(T-S);h.addEventListener("pointermove",z);h.addEventListener("pointerup",x)}}}}},rainbowBrush:()=>{h.onpointerdown=d=>{if("mouse"===d.pointerType){const {button:x,pointerId:z}=d;if(0===x){function A(I){I.pointerId===z&&I.button===x&&(G.set(c.buffer),k.commit(),E.set(c.buffer),Y(n,p,G,E).then(R=>{p=R}),q.globalCompositeOperation="copy",q.drawImage(k.canvas,
0,0),D.globalCompositeOperation="copy",D.drawImage(c.canvas,0,0),h.removeEventListener("pointermove",F),h.removeEventListener("pointerup",A))}function F(I){if(I.pointerId===z){var R=Math.floor(80*(I.clientX-w.x)/w.width);I=Math.floor(25*(I.clientY-w.y)/w.height);if(R!==l||I!==u){let S=!0;for(const [T,O]of fa(l,u,R,I)){if(S){S=!1;continue}C=(C+.25)%r;const {charCode:H,fgColor:P,bgColor:na}=ya(f,C/r);k.setChar(T,O,H,P,na)}}q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0);l=R;u=I}}d.preventDefault();
var f=oa(),r=f.length;if(0!==r){f.push(f[0]);h.setPointerCapture(z);var w=h.getBoundingClientRect(),t=Math.floor(80*(d.clientX-w.x)/w.width);d=Math.floor(25*(d.clientY-w.y)/w.height);k.setChar(t,d,219,f[0],f[0]);var C=0;q.globalCompositeOperation="copy";q.drawImage(k.canvas,0,0);var l=t,u=d;h.addEventListener("pointermove",F);h.addEventListener("pointerup",A)}}}}},spraypaint:()=>{h.onpointerdown=d=>{const {pointerId:f,pointerType:r,button:w}=d;if("mouse"===r&&0===w){const u=oa();if(0!==u.length){function x(A){A.pointerId===
f&&A.button===w&&(G.set(c.buffer),k.commit(),E.set(c.buffer),Y(n,p,G,E).then(F=>{p=F}),q.globalCompositeOperation="copy",q.drawImage(k.canvas,0,0),D.globalCompositeOperation="copy",D.drawImage(c.canvas,0,0),h.removeEventListener("pointermove",z),h.removeEventListener("pointerup",x))}function z(A){if(A.pointerId===f){var F=performance.now(),I=F-l;l=F;F=Math.floor(80*(A.clientX-C.x)/C.width);A=Math.floor(25*(A.clientY-C.y)/C.height);var {charCode:R,fgColor:S,bgColor:T}=c.getCharInfo(F,A),O=80*A+F;if(-1===
t[O])if(S===T){var H=u.indexOf(T);t[O]=-1===H?0:H}else switch(R){case 0:case 32:case 255:H=u.indexOf(T);t[O]=-1===H?0:H;break;case 8:case 10:case 219:H=u.indexOf(S);t[O]=-1===H?0:H;break;case 176:H=u.indexOf(T);var P=u.indexOf(S);t[O]=-1===H?-1===P?0:Math.max(0,P-.5):-1===P?Math.max(0,H-.5):H===P-1?H+.25:P===H-1?P+.75:Math.max(0,Math.min(P,H)+.25);break;case 177:H=u.indexOf(T);P=u.indexOf(S);t[O]=-1===H?-1===P?0:Math.max(0,P-.5):-1===P?Math.max(0,H-.5):H===P-1?H+.5:P===H-1?P+.5:Math.max(0,Math.min(P,
H)+.5);break;case 178:H=u.indexOf(T);P=u.indexOf(S);t[O]=-1===H?-1===P?0:Math.max(0,P-.5):-1===P?Math.max(0,H-.5):H===P-1?H+.75:P===H-1?P+.25:Math.max(0,Math.min(P,H)+.5);break;default:H=u.indexOf(T),-1===H&&(H=u.indexOf(S)),t[O]=H+.5}t[O]+=Math.min(.25,I/100);t[O]>=u.length-1?(O=219,H=u[u.length-1],I=0):(I=Math.floor(t[O]),O=t[O]-I,.125>O?(O=219,H=u[I],I=0):(O=.375>O?176:.625>O?177:.875>O?178:219,H=u[I+1],I=u[I]));if(O!==R||H!==S||I!==T)k.putChar(F,A,O,H,I),q.globalCompositeOperation="copy",q.drawImage(k.canvas,
0,0)}}var t=new Float32Array(2E3);t.fill(-1);var C=h.getBoundingClientRect(),l=performance.now();h.addEventListener("pointermove",z);h.addEventListener("pointerup",x)}}}}},Aa=document.getElementById("add-gradient-slot"),Qa=document.getElementById("gradient-slot-template").content.querySelector(".gradient-slot"),Ba=document.querySelector(".gradient-slots"),ha=d=>{const f=Qa.cloneNode(!0);f.dataset.value=String(d);f.querySelector(".remove-gradient-slot").onclick=()=>{Ba.removeChild(f)};Ba.insertBefore(f,
Aa)};Aa.onclick=()=>{ha(y[0])};ha(0);ha(8);ha(7);ha(15);let oa=()=>{const d=document.querySelectorAll(".gradient-slots .gradient-slot"),f=[];for(let r=0;r<d.length;r++)f.push(Number(d[r].dataset.value));return f},ya=(d,f)=>{if(2>d.length)return{charCode:219,fgColor:d[0]||0,bgColor:0};f=Math.max(0,Math.min(1,Number(f)||0));f*=d.length-1;const r=Math.floor(f);if(r>=d.length-1)return{charCode:219,fgColor:d[d.length-1],bgColor:0};f-=r;return.125>f?{charCode:0,fgColor:d[r+1],bgColor:d[r]}:.375>f?{charCode:176,
fgColor:d[r+1],bgColor:d[r]}:.625>f?{charCode:177,fgColor:d[r+1],bgColor:d[r]}:.875>f?{charCode:178,fgColor:d[r+1],bgColor:d[r]}:{charCode:219,fgColor:d[r+1],bgColor:0}},ja;ja=za.freehand();let da=document.getElementById("tool-selector"),ka=da.value;document.body.classList.add("tool-"+ka);da.onchange=d=>{ja&&ja();ja=za[da.value]();document.body.classList.remove("tool-"+ka);ka=da.value;document.body.classList.add("tool-"+ka)};h.oncontextmenu=d=>{d.preventDefault()};let la=document.getElementById("char-picker"),
Ra=document.querySelector(".left-pick"),Sa=document.querySelector(".right-pick"),ma=(d,f)=>{const r=Math.floor(d/64),w=f?Sa:Ra;w.style.left=`${d%64*8}px`;w.style.top=`${16*r}px`;U[f?2:0]=d};K=la.getContext("2d");if(!K)throw Error("unable to create canvas context");for(let d=0;256>d;d++)a(K,d%64,Math.floor(d/64),d,7,0);la.onpointerdown=d=>{if("mouse"===d.pointerType&&(0===d.button||2===d.button)){var f=la.getBoundingClientRect();ma(64*Math.floor(4*(d.clientY-f.y)/f.height)+Math.floor(64*(d.clientX-
f.x)/f.width),2===d.button)}};la.oncontextmenu=d=>{d.preventDefault()};document.getElementById("save-image").onclick=d=>{d=c.saveBlob();d=URL.createObjectURL(d);let f=document.createElement("a");f.download="dosimage.dat";f.href=d;f.click();Ea(n,p)};document.getElementById("load-image").onclick=async d=>{if(d=await Ja()){let f=new Uint16Array(c.buffer);try{await c.loadBlob(d)}catch(r){alert(r);return}E.set(c.buffer);Y(n,p,f,E).then(r=>{p=r});D.drawImage(c.canvas,0,0)}};document.getElementById("clear-image").onclick=
d=>{G.set(c.buffer);c.fill(U[2],y[0],y[2],L);E.set(c.buffer);Y(n,p,G,E).then(f=>{p=f});D.drawImage(c.canvas,0,0)}},{once:!0})})()