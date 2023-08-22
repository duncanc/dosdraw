'use strict';(function(){function*B(a,b,f,l){let g=Math.abs(f-a),e=Math.abs(l-b),h=a<f?1:-1,m=b<l?1:-1,z=g-e;for(;;){yield[a,b];if(a===f&&b===l)break;let u=2*z;u>-e&&(z-=e,a+=h);u<g&&(z+=g,b+=m)}}function*C(a,b,f,l){let g=Math.sign(f-a),e=Math.sign(l-b);if(0===g)if(0===e)yield[a,b];else for(f=b;f!==l+e;f+=e)yield[a,f];else if(0===e)for(;a!==f+g;a+=g)yield[a,b];else for(;b!==l+e;b+=e)for(let h=a;h!==f+g;h+=g)yield[h,b]}function*D(a,b,f,l){let g=Math.sign(f-a),e=Math.sign(l-b);if(0===g)if(0===e)yield[a,
b];else for(f=b;f!==l+e;f+=e)yield[a,f];else if(0===e)for(l=a;l!==f+g;l+=g)yield[l,b];else{for(let h=a;h!==f+g;h+=g)yield[h,b];for(b+=e;b!==l;b+=e)yield[a,b],yield[f,b];for(;a!==f+g;a+=g)yield[a,l]}}function I(){return new Promise((a,b)=>{let f=document.createElement("input");f.type="file";f.onchange=l=>{var g;(null===(g=f.files)||void 0===g?0:g.length)?a(f.files[0]):a(null)};f.click()})}let E=1===(new Uint8Array((new Uint16Array([1])).buffer))[0];var F;(function(a){a[a.Black=0]="Black";a[a.DarkBlue=
1]="DarkBlue";a[a.DarkGreen=2]="DarkGreen";a[a.DarkCyan=3]="DarkCyan";a[a.DarkRed=4]="DarkRed";a[a.DarkMagenta=5]="DarkMagenta";a[a.Brown=6]="Brown";a[a.LightGrey=7]="LightGrey";a[a.DarkGrey=8]="DarkGrey";a[a.Blue=9]="Blue";a[a.Green=10]="Green";a[a.Cyan=11]="Cyan";a[a.Red=12]="Red";a[a.Magenta=13]="Magenta";a[a.Yellow=14]="Yellow";a[a.White=15]="White"})(F||(F={}));let G="#000 #008 #080 #088 #800 #808 #880 #ccc #888 #00f #0f0 #0ff #f00 #f0f #ff0 #fff".split(" ");class J{constructor(a){this.drawChar=
a;this.buffer=new Uint16Array(2E3);this.canvas=document.createElement("canvas");this.canvas.width=640;this.canvas.height=400;this.ctx=this.canvas.getContext("2d");if(!this.ctx)throw Error("unable to get canvas context");}getBrush(a,b,f,l){if(!Number.isInteger(a)||!Number.isInteger(b))throw new TypeError("x and y must be integers");if(!Number.isInteger(f)||!Number.isInteger(b))throw new TypeError("width and height must be integers");if(0>a||0>b||0>f||0>l||80<a+f||25<b+l)throw new RangeError("edges exceed screen");
let g=new Uint16Array(f*l);for(let e=0;e<l;e++)g.set(this.buffer.subarray(80*(b+e)+a,80*(b+e)+a+f),e*f);return{data:g,width:f,height:l}}putBrush(a,b,f){let l,g,e=a.data;if(0>b){l=-b;if(l>=a.width)return;b=0}else l=0;g=Math.min(80-b,b+a.width);if(0>f){e=e.subarray(f*a.width);if(0===e.length)return;f=0}for(let h=0;h<a.height;h++)if(!(0>f+h)){if(25<=f+h)break;this.buffer.set(e.subarray((f+h)*a.width+l,(f+h)*a.width+g),80*f+b);for(let m=l;m<g;m++)this.updateCanvas(f+h,b+m)}}updateCanvas(a,b){let f=this.buffer[80*
b+a];this.drawChar(this.ctx,a,b,f&255,f>>8&15,f>>12&15)}getCharInfo(a,b){a=this.buffer[80*b+a];return{charCode:a&255,fgColor:a>>8&15,bgColor:a>>12&15}}putChar(a,b,f,l,g){this.buffer[80*b+a]=f|l<<8|g<<12;this.updateCanvas(a,b)}fill(a,b,f){a=a|b<<8|f<<12;for(b=0;b<this.buffer.length;b++)this.buffer[b]=a,this.updateCanvas(b%80,Math.floor(b/80))}saveBlob(){if(E)return new Blob([this.buffer]);let a=new Uint16Array(this.buffer);for(let b=0;b<a.length;b++)a[b]=a[b]>>8|a[b]<<8;return new Blob([a],{type:"application/octet-stream"})}async loadBlob(a){a=
await a.arrayBuffer();if(a.byteLength!==this.buffer.byteLength)throw Error("invalid file");a=new Uint16Array(a);if(!E)for(var b=0;b<a.length;b++)a[b]=a[b]>>8|a[b]<<8;this.buffer.set(a);for(a=0;25>a;a++)for(b=0;80>b;b++)this.updateCanvas(b,a)}}let K=fetch("./chardata.png");window.addEventListener("DOMContentLoaded",async function(){var a=await (await K).blob();let b=await createImageBitmap(a),f=b.width/9,l=(c,d,n,q,p,t)=>{c.save();c.globalCompositeOperation="source-over";c.fillStyle=G[t];c.fillRect(8*
d,16*n,8,16);c.globalCompositeOperation="destination-out";c.drawImage(b,q%f*9,16*Math.floor(q/f),8,16,8*d,16*n,8,16);c.globalCompositeOperation="destination-over";c.fillStyle=G[p];c.fillRect(8*d,16*n,8,16);c.restore()},g=new J(l),e=document.getElementById("editor"),h=e.getContext("2d");if(!h)throw Error("unable to create canvas context");let m=[7,0,0],z=document.querySelector(".palette");z.onpointerdown=c=>{if("mouse"===c.pointerType&&(0===c.button||2===c.button)){var d=0===c.button?"foreground-selected":
"background-selected";for(let n=c.target;n&&!n.classList.contains("palette");n=n.parentElement)if("value"in n.dataset){let q=z.querySelectorAll(`.${d}`);for(let p=0;p<q.length;p++)q[p].classList.remove(d);n.classList.add(d);m[c.button]=+n.dataset.value;c.preventDefault();c.stopPropagation();break}}};z.oncontextmenu=c=>{c.preventDefault()};let u=[219,0,0],H={freehand:()=>{e.onpointerdown=c=>{if("mouse"===c.pointerType){const {button:t,pointerId:x}=c;if(0===t||2===t){function y(r){r.pointerId===x&&
r.button===t&&(e.removeEventListener("pointermove",k),e.removeEventListener("pointerup",y))}function k(r){if(r.pointerId===x){var v=Math.floor(80*(r.clientX-d.x)/d.width);r=Math.floor(25*(r.clientY-d.y)/d.height);for(const [w,L]of B(q,p,v,r))g.putChar(w,L,u[t],m[0],m[2]);h.drawImage(g.canvas,0,0);q=v;p=r}}e.setPointerCapture(x);var d=e.getBoundingClientRect(),n=Math.floor(80*(c.clientX-d.x)/d.width);c=Math.floor(25*(c.clientY-d.y)/d.height);g.putChar(n,c,u[t],m[0],m[2]);h.drawImage(g.canvas,0,0);
var q=n,p=c;e.addEventListener("pointermove",k);e.addEventListener("pointerup",y)}}}},lines:()=>{e.onpointerdown=c=>{if("mouse"===c.pointerType){const {button:p,pointerId:t}=c;if(0===p||2===p){function x(k){if(k.pointerId===t&&k.button===p){var r=Math.floor(80*(k.clientX-d.x)/d.width);k=Math.floor(25*(k.clientY-d.y)/d.height);for(const [v,w]of B(n,q,r,k))g.putChar(v,w,u[p],m[0],m[2]);h.globalCompositeOperation="copy";h.drawImage(g.canvas,0,0);e.removeEventListener("pointermove",y);e.removeEventListener("pointerup",
x)}}function y(k){if(k.pointerId===t){var r=Math.floor(80*(k.clientX-d.x)/d.width);k=Math.floor(25*(k.clientY-d.y)/d.height);h.globalCompositeOperation="copy";h.drawImage(g.canvas,0,0);for(const [v,w]of B(n,q,r,k))l(h,v,w,u[p],m[0],m[2])}}e.setPointerCapture(t);var d=e.getBoundingClientRect(),n=Math.floor(80*(c.clientX-d.x)/d.width),q=Math.floor(25*(c.clientY-d.y)/d.height);l(h,n,q,u[p],m[0],m[2]);e.addEventListener("pointermove",y);e.addEventListener("pointerup",x)}}}},filledBox:()=>{e.onpointerdown=
c=>{if("mouse"===c.pointerType){const {button:p,pointerId:t}=c;if(0===p||2===p){function x(k){if(k.pointerId===t&&k.button===p){var r=Math.floor(80*(k.clientX-d.x)/d.width);k=Math.floor(25*(k.clientY-d.y)/d.height);for(const [v,w]of C(n,q,r,k))g.putChar(v,w,u[p],m[0],m[2]);h.globalCompositeOperation="copy";h.drawImage(g.canvas,0,0);e.removeEventListener("pointermove",y);e.removeEventListener("pointerup",x)}}function y(k){if(k.pointerId===t){var r=Math.floor(80*(k.clientX-d.x)/d.width);k=Math.floor(25*
(k.clientY-d.y)/d.height);h.globalCompositeOperation="copy";h.drawImage(g.canvas,0,0);for(const [v,w]of C(n,q,r,k))l(h,v,w,u[p],m[0],m[2])}}e.setPointerCapture(t);var d=e.getBoundingClientRect(),n=Math.floor(80*(c.clientX-d.x)/d.width),q=Math.floor(25*(c.clientY-d.y)/d.height);l(h,n,q,u[p],m[0],m[2]);e.addEventListener("pointermove",y);e.addEventListener("pointerup",x)}}}},emptyBox:()=>{e.onpointerdown=c=>{if("mouse"===c.pointerType){const {button:p,pointerId:t}=c;if(0===p||2===p){function x(k){if(k.pointerId===
t&&k.button===p){var r=Math.floor(80*(k.clientX-d.x)/d.width);k=Math.floor(25*(k.clientY-d.y)/d.height);for(const [v,w]of D(n,q,r,k))g.putChar(v,w,u[p],m[0],m[2]);h.globalCompositeOperation="copy";h.drawImage(g.canvas,0,0);e.removeEventListener("pointermove",y);e.removeEventListener("pointerup",x)}}function y(k){if(k.pointerId===t){var r=Math.floor(80*(k.clientX-d.x)/d.width);k=Math.floor(25*(k.clientY-d.y)/d.height);h.globalCompositeOperation="copy";h.drawImage(g.canvas,0,0);for(const [v,w]of D(n,
q,r,k))l(h,v,w,u[p],m[0],m[2])}}e.setPointerCapture(t);var d=e.getBoundingClientRect(),n=Math.floor(80*(c.clientX-d.x)/d.width),q=Math.floor(25*(c.clientY-d.y)/d.height);l(h,n,q,u[p],m[0],m[2]);e.addEventListener("pointermove",y);e.addEventListener("pointerup",x)}}}}};H.freehand();document.getElementById("tool-selector").onchange=c=>{H[c.target.value]()};e.oncontextmenu=c=>{c.preventDefault()};let A=document.getElementById("char-picker");a=A.getContext("2d");if(!a)throw Error("unable to create canvas context");
for(let c=0;256>c;c++)l(a,c%64,Math.floor(c/64),c,7,0);let M=document.querySelector(".left-pick"),N=document.querySelector(".right-pick");A.onpointerdown=c=>{if("mouse"===c.pointerType&&(0===c.button||2===c.button)){var d=A.getBoundingClientRect(),n=Math.floor(64*(c.clientX-d.x)/d.width);d=Math.floor(4*(c.clientY-d.y)/d.height);var q=2===c.button?N:M;u[c.button]=64*d+n;q.style.left=`${8*n}px`;q.style.top=`${16*d}px`}};A.oncontextmenu=c=>{c.preventDefault()};document.getElementById("save-image").onclick=
c=>{c=g.saveBlob();c=URL.createObjectURL(c);let d=document.createElement("a");d.download="dosimage.dat";d.href=c;d.click()};document.getElementById("load-image").onclick=async c=>{if(c=await I()){try{await g.loadBlob(c)}catch(d){alert(d);return}h.drawImage(g.canvas,0,0)}};document.getElementById("clear-image").onclick=c=>{g.fill(u[2],m[0],m[2]);h.drawImage(g.canvas,0,0)}},{once:!0})})()