import{j as e,I as u}from"./index-CYUFbkBB.js";import{r as b}from"./vendor-react-VZ-Yj73K.js";const g={sm:"max-w-auth",md:"max-w-auth-md",lg:"max-w-auth-lg",xl:"max-w-[42rem]"},w={indigo:"from-indigo-500 to-indigo-600 shadow-indigo-500/20",blue:"from-blue-500 to-blue-600 shadow-blue-500/20",emerald:"from-emerald-500 to-teal-600 shadow-emerald-500/20",slate:"from-slate-600 to-slate-700 shadow-slate-500/20",amber:"from-amber-500 to-orange-600 shadow-amber-500/20",violet:"from-violet-500 to-violet-600 shadow-violet-500/20"},j=({isOpen:t,onClose:s,title:d,subtitle:r,icon:o,children:i,size:n="md",accent:m="indigo",closeOnBackdrop:c=!0,busy:l=!1,className:h=""})=>{if(b.useEffect(()=>{const a=f=>{f.key==="Escape"&&t&&!l&&s()};return t&&(document.addEventListener("keydown",a),document.body.style.overflow="hidden"),()=>{document.removeEventListener("keydown",a),document.body.style.overflow=""}},[t,s,l]),!t)return null;const x=a=>{a.target===a.currentTarget&&c&&!l&&s()};return e.jsxs("div",{className:"fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in",role:"dialog","aria-modal":"true","aria-labelledby":"form-modal-title",onClick:x,children:[e.jsx("div",{className:"absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]","aria-hidden":"true"}),e.jsxs("div",{className:`
                    form-modal-panel
                    relative w-full ${g[n]}
                    flex flex-col
                    max-h-[min(88vh,42rem)]
                    my-auto
                    bg-white rounded-xl
                    shadow-2xl shadow-slate-900/20
                    border border-slate-200
                    overflow-hidden
                    animate-modal-in
                    ${h}
                `,onClick:a=>a.stopPropagation(),children:[e.jsx("div",{className:"flex-shrink-0 px-5 pt-4 pb-3.5 border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white",children:e.jsxs("div",{className:"flex items-start gap-3",children:[o&&e.jsx("div",{className:`
                                    w-10 h-10 flex-shrink-0 rounded-lg
                                    bg-gradient-to-br ${w[m]}
                                    flex items-center justify-center shadow-md
                                `,children:e.jsx("span",{className:"text-white [&_svg]:w-5 [&_svg]:h-5",children:o})}),e.jsxs("div",{className:"min-w-0 flex-1 pt-0.5",children:[e.jsx("h3",{id:"form-modal-title",className:"text-base font-semibold text-slate-900 leading-snug tracking-tight",children:d}),r&&e.jsx("p",{className:"mt-0.5 text-sm text-slate-500 leading-snug",children:r})]}),e.jsx("button",{type:"button",onClick:s,disabled:l,"aria-label":"Fechar",className:`\r
                                w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg\r
                                text-slate-400 hover:text-slate-600 hover:bg-slate-100\r
                                transition-colors touch-feedback disabled:opacity-50\r
                            `,children:e.jsx(u.X,{className:"w-5 h-5"})})]})}),e.jsx("div",{className:"flex-1 min-h-0 overflow-y-auto overscroll-contain",children:i})]})]})};export{j as F};
