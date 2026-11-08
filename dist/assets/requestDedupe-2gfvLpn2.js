const e=new Map;function o(t,s){const i=e.get(t);if(i)return i;const n=s().finally(()=>{e.get(t)===n&&e.delete(t)});return e.set(t,n),n}export{o as d};
