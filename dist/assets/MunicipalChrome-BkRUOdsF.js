import{j as e,I as i}from"./index-ysDMiuoJ.js";import{R as p}from"./vendor-react-VZ-Yj73K.js";const j=({children:s,className:t=""})=>e.jsx("div",{className:`
            -mx-4 md:-mx-8 -mt-4 md:-mt-8
            min-h-[calc(100vh-4rem)] animate-fade-in
            bg-gradient-to-b from-slate-100 via-slate-50 to-white
            ${t}
        `,children:s}),E=({children:s,className:t=""})=>e.jsx("div",{className:`px-4 sm:px-6 md:px-8 pb-10 pt-5 space-y-5 ${t}`,children:s}),f={indigo:"from-indigo-500 to-indigo-600 shadow-indigo-500/30",blue:"from-blue-500 to-blue-600 shadow-blue-500/30",emerald:"from-emerald-500 to-teal-600 shadow-emerald-500/30",amber:"from-amber-500 to-orange-600 shadow-amber-500/30",violet:"from-violet-500 to-violet-600 shadow-violet-500/30",slate:"from-slate-500 to-slate-700 shadow-slate-500/30",pink:"from-pink-500 to-rose-600 shadow-pink-500/30"},N={indigo:"from-slate-900 via-indigo-950 to-indigo-800",blue:"from-slate-900 via-blue-950 to-blue-800",emerald:"from-slate-900 via-emerald-950 to-teal-800",amber:"from-slate-900 via-amber-950 to-orange-800",violet:"from-slate-900 via-violet-950 to-violet-800",slate:"from-slate-950 via-slate-900 to-slate-800",pink:"from-slate-900 via-rose-950 to-pink-800"},I=({title:s,subtitle:t,icon:a,accent:r="indigo",meta:l,actions:n})=>e.jsxs("div",{className:`
            relative overflow-hidden
            bg-gradient-to-br ${N[r]}
            px-4 sm:px-6 md:px-8 pt-6 pb-7 sm:pt-8 sm:pb-9
            text-white shadow-lg shadow-slate-900/10
        `,children:[e.jsx("div",{className:"absolute inset-0 opacity-[0.12] pointer-events-none",style:{backgroundImage:"radial-gradient(circle at 1px 1px, white 1px, transparent 0)",backgroundSize:"22px 22px"},"aria-hidden":!0}),e.jsx("div",{className:"absolute -right-16 -top-16 w-56 h-56 rounded-full bg-white/10 blur-2xl pointer-events-none","aria-hidden":!0}),e.jsx("div",{className:"absolute -left-10 -bottom-20 w-48 h-48 rounded-full bg-primary-400/20 blur-2xl pointer-events-none","aria-hidden":!0}),e.jsxs("div",{className:"relative z-10 flex items-start justify-between gap-3 sm:gap-4",children:[e.jsxs("div",{className:"flex items-start gap-3.5 min-w-0",children:[a&&e.jsx("div",{className:`
                            flex flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14
                            rounded-2xl bg-gradient-to-br ${f[r]}
                            items-center justify-center shadow-lg
                            text-white [&_svg]:w-6 [&_svg]:h-6 sm:[&_svg]:w-7 sm:[&_svg]:h-7
                            ring-2 ring-white/20
                        `,children:a}),e.jsxs("div",{className:"min-w-0 pt-0.5",children:[e.jsx("p",{className:"text-[11px] sm:text-xs font-semibold uppercase tracking-[0.16em] text-white/70 mb-1",children:"Direção Municipal"}),e.jsx("h1",{className:"text-2xl sm:text-3xl font-bold tracking-tight leading-tight text-white drop-shadow-sm",children:s}),t&&e.jsx("p",{className:"mt-1.5 text-sm sm:text-base text-white/85 leading-snug max-w-2xl",children:t}),l&&e.jsx("div",{className:"mt-3 text-white/80 [&_span]:text-white/80 [&_svg]:text-white/70",children:l})]})]}),n&&e.jsx("div",{className:"flex flex-shrink-0 items-center gap-2 [&_button]:ring-1 [&_button]:ring-white/25",children:n})]})]}),B=({onClick:s,disabled:t,label:a,children:r,variant:l="primary",className:n=""})=>{const d={primary:"bg-white text-slate-900 shadow-md shadow-black/10 hover:bg-slate-100",ghost:"bg-white/15 text-white border border-white/25 hover:bg-white/25 backdrop-blur-sm",danger:"bg-red-500 text-white shadow-sm hover:bg-red-600"};return e.jsx("button",{type:"button",onClick:s,disabled:t,"aria-label":a,title:a,className:`
                flex items-center justify-center
                min-w-[44px] min-h-[44px] p-2.5 rounded
                transition-all duration-200 active:scale-95
                disabled:opacity-50 disabled:pointer-events-none
                ${d[l]} ${n}
            `,children:r})},F=({children:s,onClick:t,disabled:a,type:r="button",form:l,variant:n="primary",fullWidth:d,icon:o,iconRight:m,className:c=""})=>{const x={primary:"bg-primary-600 text-white shadow-sm shadow-primary-600/20 hover:bg-primary-700",secondary:"bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300",ghost:"bg-slate-100 text-slate-700 hover:bg-slate-200",danger:"bg-red-600 text-white shadow-sm hover:bg-red-700",success:"bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",warning:"bg-amber-600 text-white shadow-sm hover:bg-amber-700"};return e.jsxs("button",{type:r,form:l,onClick:t,disabled:a,className:`
                inline-flex items-center justify-center gap-2
                px-4 py-2.5 min-h-[44px] rounded
                text-sm font-semibold tracking-tight
                transition-all duration-200 active:scale-[0.98]
                disabled:opacity-50 disabled:pointer-events-none
                [&_svg]:w-4 [&_svg]:h-4 [&_svg]:flex-shrink-0
                ${d?"w-full":""}
                ${x[n]} ${c}
            `,children:[o,e.jsx("span",{className:"truncate",children:s}),m]})},y=({children:s,className:t="",padding:a=!0})=>e.jsx("div",{className:`
            bg-white
            rounded-2xl border border-slate-200/80
            shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.06)]
            overflow-hidden
            ${a?"p-4 sm:p-5":""}
            ${t}
        `,children:s}),L=({title:s,value:t,icon:a,iconTone:r="from-indigo-50 to-indigo-100 text-indigo-600",subtitle:l,onClick:n})=>{const d=e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:`
                    flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl
                    bg-gradient-to-br ${r}
                    flex items-center justify-center
                `,children:a}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsx("p",{className:"text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-none tabular-nums",children:t}),e.jsx("p",{className:"text-sm text-slate-500 font-medium mt-1 truncate",children:s}),l&&e.jsx("p",{className:"text-xs text-slate-400 mt-0.5 truncate",children:l})]}),n&&e.jsx(i.ChevronRight,{className:"w-5 h-5 text-slate-300 flex-shrink-0"})]}),o=`
        w-full text-left
        bg-white rounded-2xl p-4 sm:p-5
        border border-slate-200/80
        shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_20px_rgba(15,23,42,0.05)]
        ring-1 ring-slate-900/[0.02]
        transition-all duration-200
        ${n?"cursor-pointer hover:shadow-lg hover:border-primary-200 hover:-translate-y-0.5 active:scale-[0.98]":""}
    `;return n?e.jsx("button",{type:"button",onClick:n,className:o,children:d}):e.jsx("div",{className:o,children:d})},A=({value:s,onChange:t,placeholder:a="Pesquisar...",className:r=""})=>e.jsxs("div",{className:`relative ${r}`,children:[e.jsx(i.Search,{className:"absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"}),e.jsx("input",{type:"search",value:s,onChange:l=>t(l.target.value),placeholder:a,className:`\r
                w-full pl-10 pr-3.5 py-2.5 min-h-[44px]\r
                bg-white border border-slate-200 rounded\r
                text-sm text-slate-900 placeholder:text-slate-400\r
                shadow-sm shadow-slate-900/[0.02]\r
                focus:outline-none focus:ring-2 focus:ring-primary-500/35 focus:border-primary-500\r
                transition-all duration-200\r
            `})]}),S=({label:s,active:t,onClick:a})=>e.jsx("button",{type:"button",onClick:a,className:`
            px-3.5 py-2 rounded text-sm font-medium whitespace-nowrap
            min-h-[36px] transition-all duration-200
            ${t?"bg-primary-600 text-white shadow-sm shadow-primary-600/25":"bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300"}
        `,children:s}),b=({children:s,htmlFor:t,required:a})=>e.jsxs("label",{htmlFor:t,className:"block text-sm font-medium text-slate-700 mb-1.5",children:[s,a&&e.jsx("span",{className:"text-red-500 ml-0.5",children:"*"})]}),g="w-full py-2.5 min-h-[44px] bg-white border border-slate-200 rounded text-sm text-slate-900 placeholder:text-slate-400 shadow-sm shadow-slate-900/[0.02] focus:outline-none focus:ring-2 focus:ring-primary-500/35 focus:border-primary-500 transition-all duration-200 disabled:bg-slate-50 disabled:text-slate-500",k=(s,t)=>{if(s)return s;if(t==="email")return e.jsx(i.Email,{className:"w-4 h-4"});if(t==="tel")return e.jsx(i.Phone,{className:"w-4 h-4"});if(t==="date"||t==="datetime-local"||t==="month")return e.jsx(i.Calendar,{className:"w-4 h-4"});if(t==="search")return e.jsx(i.Search,{className:"w-4 h-4"});if(t==="password")return e.jsx(i.Lock,{className:"w-4 h-4"})},z=({label:s,icon:t,className:a="",id:r,required:l,type:n,...d})=>{const o=k(t,n);return e.jsxs("div",{className:"w-full",children:[s&&e.jsx(b,{htmlFor:r,required:l,children:s}),e.jsxs("div",{className:"relative",children:[o&&e.jsx("span",{className:"absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none [&_svg]:w-4 [&_svg]:h-4",children:o}),e.jsx("input",{id:r,type:n,required:l,className:`${g} ${o?"pl-10 pr-3.5":"px-3.5"} ${a}`,...d})]})]})},M=({label:s,icon:t,className:a="",id:r,required:l,...n})=>e.jsxs("div",{className:"w-full",children:[s&&e.jsx(b,{htmlFor:r,required:l,children:s}),e.jsxs("div",{className:"relative",children:[t&&e.jsx("span",{className:"absolute left-3 top-3 text-slate-400 pointer-events-none [&_svg]:w-4 [&_svg]:h-4",children:t}),e.jsx("textarea",{id:r,required:l,className:`${g} min-h-[96px] resize-y ${t?"pl-10 pr-3.5 pt-2.5":"px-3.5"} ${a}`,...n})]})]}),P=({label:s,icon:t,className:a="",id:r,required:l,children:n,...d})=>{const o=t??e.jsx(i.List,{className:"w-4 h-4"});return e.jsxs("div",{className:"w-full",children:[s&&e.jsx(b,{htmlFor:r,required:l,children:s}),e.jsxs("div",{className:"relative",children:[e.jsx("span",{className:"absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none [&_svg]:w-4 [&_svg]:h-4",children:o}),e.jsx("select",{id:r,required:l,className:`${g} appearance-none pl-10 pr-9 cursor-pointer ${a}`,...d,children:n}),e.jsx(i.ChevronDown,{className:"absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"})]})]})},R=({children:s,tone:t="neutral"})=>{const a={success:"bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80",warning:"bg-amber-50 text-amber-700 ring-1 ring-amber-200/80",danger:"bg-red-50 text-red-700 ring-1 ring-red-200/80",neutral:"bg-slate-100 text-slate-600 ring-1 ring-slate-200/80",info:"bg-blue-50 text-blue-700 ring-1 ring-blue-200/80"};return e.jsx("span",{className:`
                inline-flex items-center px-2 py-0.5 rounded
                text-xs font-semibold tracking-tight ${a[t]}
            `,children:s})},T=({icon:s,title:t,description:a,action:r})=>e.jsxs(y,{className:"text-center py-12 sm:py-16",children:[e.jsx("div",{className:"w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 [&_svg]:w-7 [&_svg]:h-7 sm:[&_svg]:w-8 sm:[&_svg]:h-8",children:s||e.jsx(i.DocumentText,{})}),e.jsx("h3",{className:"text-base sm:text-lg font-semibold text-slate-700",children:t}),a&&e.jsx("p",{className:"mt-1.5 text-sm text-slate-500 max-w-sm mx-auto",children:a}),r&&e.jsx("div",{className:"mt-5 flex justify-center",children:r})]}),K=({label:s="A carregar..."})=>e.jsxs(j,{className:"flex flex-col items-center justify-center gap-3",children:[e.jsxs("div",{className:"relative",children:[e.jsx("div",{className:"h-11 w-11 rounded-full border-2 border-primary-100"}),e.jsx("div",{className:"absolute inset-0 h-11 w-11 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"})]}),e.jsx("p",{className:"text-sm font-medium text-slate-500",children:s})]}),X=({children:s,tone:t="error"})=>{const a={error:"bg-red-50 border-red-200/80 text-red-700",warning:"bg-amber-50 border-amber-200/80 text-amber-800",success:"bg-emerald-50 border-emerald-200/80 text-emerald-700",info:"bg-blue-50 border-blue-200/80 text-blue-700"};return e.jsxs("div",{className:`
                flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium
                ${a[t]}
            `,role:"alert",children:[e.jsx(i.ExclamationCircle,{className:"w-5 h-5 flex-shrink-0 mt-0.5"}),e.jsx("div",{className:"min-w-0",children:s})]})},_={indigo:"from-indigo-500 via-indigo-400 to-violet-400",blue:"from-blue-500 via-sky-400 to-cyan-400",emerald:"from-emerald-500 via-teal-400 to-cyan-400",amber:"from-amber-500 via-orange-400 to-rose-400",violet:"from-violet-500 via-fuchsia-400 to-pink-400",slate:"from-slate-600 via-slate-500 to-indigo-400",pink:"from-pink-500 via-rose-400 to-orange-400"},$={indigo:"shadow-indigo-500/40",blue:"shadow-blue-500/40",emerald:"shadow-emerald-500/40",amber:"shadow-amber-500/40",violet:"shadow-violet-500/40",slate:"shadow-slate-500/40",pink:"shadow-pink-500/40"},G=({title:s,description:t,children:a,className:r=""})=>e.jsxs("section",{className:`
            relative rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80
            p-4 sm:p-5 space-y-3.5
            shadow-[0_1px_2px_rgba(15,23,42,0.04)]
            transition-shadow duration-300 hover:shadow-md hover:border-slate-300/80
            ${r}
        `,children:[e.jsxs("div",{className:"flex items-start gap-2.5",children:[e.jsx("span",{className:"mt-1.5 h-1.5 w-1.5 rounded-full bg-primary-500 shadow-sm shadow-primary-500/50"}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("h3",{className:"text-sm font-semibold text-slate-900 tracking-tight",children:s}),t&&e.jsx("p",{className:"mt-0.5 text-xs text-slate-500 leading-relaxed",children:t})]})]}),e.jsx("div",{className:"space-y-3.5",children:a})]}),H=({children:s,className:t=""})=>e.jsx("div",{className:`
            flex-shrink-0 px-4 sm:px-5 py-3.5 sm:py-4
            border-t border-slate-200/80
            bg-gradient-to-t from-slate-100/90 via-slate-50/80 to-white/95
            backdrop-blur-sm
            flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end
            ${t}
        `,children:s}),J=({isOpen:s,onClose:t,title:a,subtitle:r,icon:l,accent:n="indigo",children:d,footer:o,badge:m,busy:c=!1,size:x="md",padded:h=!0})=>{if(p.useEffect(()=>{if(!s)return;const u=w=>{w.key==="Escape"&&!c&&t()};return document.addEventListener("keydown",u),document.body.style.overflow="hidden",()=>{document.removeEventListener("keydown",u),document.body.style.overflow=""}},[s,t,c]),!s)return null;const v=x==="xl"?"md:max-w-3xl":x==="lg"?"md:max-w-2xl":"md:max-w-xl";return e.jsxs("div",{className:"fixed inset-0 z-50",role:"dialog","aria-modal":"true","aria-labelledby":"Dm-modal-title",children:[e.jsx("div",{className:`\r
                    absolute inset-0 animate-fade-in\r
                    bg-slate-950/55 backdrop-blur-[3px]\r
                    bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.18),transparent_55%)]\r
                `,onClick:()=>{c||t()},"aria-hidden":"true"}),e.jsxs("div",{className:`
                    absolute inset-x-0 bottom-0 top-8 md:inset-auto
                    md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
                    ${v} md:w-full md:mx-4 md:max-h-[min(92vh,52rem)]
                    bg-white
                    rounded-t-[1.35rem] md:rounded-2xl
                    shadow-[0_-8px_40px_rgba(15,23,42,0.18),0_25px_50px_-12px_rgba(15,23,42,0.35)]
                    border border-slate-200/60
                    flex flex-col
                    animate-slide-up md:animate-scale-in
                    overflow-hidden
                `,children:[e.jsx("div",{className:"md:hidden flex justify-center pt-2.5 pb-0.5","aria-hidden":"true",children:e.jsx("span",{className:"h-1 w-10 rounded-full bg-slate-300/90"})}),e.jsx("div",{className:`h-1 w-full bg-gradient-to-r ${_[n]} flex-shrink-0`,"aria-hidden":"true"}),e.jsxs("div",{className:"flex-shrink-0 relative px-4 sm:px-5 pt-3.5 sm:pt-4 pb-3.5 border-b border-slate-100/90 bg-gradient-to-br from-white via-slate-50/40 to-white",children:[e.jsx("div",{className:"pointer-events-none absolute inset-0 opacity-[0.35]",style:{backgroundImage:"radial-gradient(circle at 12% 20%, rgba(148,163,184,0.18), transparent 42%)"},"aria-hidden":"true"}),e.jsxs("div",{className:"relative flex items-start gap-3",children:[l&&e.jsx("div",{className:`
                                    relative w-11 h-11 sm:w-12 sm:h-12 flex-shrink-0 rounded-2xl
                                    bg-gradient-to-br ${f[n]}
                                    flex items-center justify-center
                                    shadow-lg ${$[n]}
                                    text-white [&_svg]:w-5 [&_svg]:h-5 sm:[&_svg]:w-[1.35rem] sm:[&_svg]:h-[1.35rem]
                                    ring-2 ring-white/40
                                    transition-transform duration-300 hover:scale-105
                                `,children:l}),e.jsxs("div",{className:"min-w-0 flex-1 pt-0.5",children:[e.jsxs("div",{className:"flex items-center gap-2 flex-wrap",children:[e.jsx("h2",{id:"Dm-modal-title",className:"text-base sm:text-lg font-semibold text-slate-900 tracking-tight leading-snug",children:a}),m]}),r&&e.jsx("p",{className:"mt-1 text-sm text-slate-500 leading-relaxed",children:r})]}),e.jsx("button",{type:"button",onClick:t,disabled:c,"aria-label":"Fechar",className:`\r
                                group w-9 h-9 flex-shrink-0 flex items-center justify-center rounded\r
                                text-slate-400 bg-slate-100/70\r
                                hover:text-slate-700 hover:bg-slate-200/80 hover:rotate-90\r
                                active:scale-95\r
                                transition-all duration-200\r
                                disabled:opacity-50 disabled:pointer-events-none\r
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40\r
                            `,children:e.jsx(i.X,{className:"w-5 h-5 transition-transform duration-200"})})]})]}),e.jsx("div",{className:`
                        flex-1 min-h-0 overflow-y-auto overscroll-contain
                        scrollbar-thin
                        ${h?"p-4 sm:p-5 md:p-6":""}
                    `,children:d}),o]})]})},Q=({isOpen:s,onClose:t,onConfirm:a,title:r,message:l,confirmText:n="Confirmar",cancelText:d="Cancelar",variant:o="danger",loading:m=!1})=>{const c={danger:{bar:"from-red-500 via-rose-400 to-orange-400",iconBg:"from-red-500 to-red-600 shadow-red-500/35",btn:"bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-red-500/25",ring:"ring-red-100"},warning:{bar:"from-amber-500 via-orange-400 to-yellow-400",iconBg:"from-amber-500 to-orange-600 shadow-amber-500/35",btn:"bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-amber-500/25",ring:"ring-amber-100"},info:{bar:"from-blue-500 via-sky-400 to-cyan-400",iconBg:"from-blue-500 to-blue-600 shadow-blue-500/35",btn:"bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25",ring:"ring-blue-100"},success:{bar:"from-emerald-500 via-teal-400 to-cyan-400",iconBg:"from-emerald-500 to-teal-600 shadow-emerald-500/35",btn:"bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/25",ring:"ring-emerald-100"}}[o];return p.useEffect(()=>{if(!s)return;const x=h=>{h.key==="Escape"&&!m&&t()};return document.addEventListener("keydown",x),document.body.style.overflow="hidden",()=>{document.removeEventListener("keydown",x),document.body.style.overflow=""}},[s,t,m]),s?e.jsxs("div",{className:"fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fade-in",role:"dialog","aria-modal":"true","aria-labelledby":"Dm-confirm-title",onClick:x=>{x.target===x.currentTarget&&!m&&t()},children:[e.jsx("div",{className:"absolute inset-0 bg-slate-950/55 backdrop-blur-[3px]","aria-hidden":"true"}),e.jsxs("div",{className:`\r
                    relative w-full sm:max-w-md\r
                    bg-white rounded-t-2xl sm:rounded-2xl\r
                    shadow-2xl shadow-slate-900/25\r
                    border border-slate-200/70\r
                    overflow-hidden\r
                    animate-slide-up sm:animate-scale-in\r
                `,children:[e.jsx("div",{className:`h-1 w-full bg-gradient-to-r ${c.bar}`,"aria-hidden":"true"}),e.jsx("div",{className:"px-5 pt-6 pb-2 flex justify-center",children:e.jsx("div",{className:`
                            w-14 h-14 rounded-2xl bg-gradient-to-br ${c.iconBg}
                            flex items-center justify-center text-white shadow-lg
                            ring-4 ${c.ring}
                            animate-bounce-subtle
                        `,children:o==="success"?e.jsx(i.CheckCircle,{className:"w-7 h-7"}):o==="info"?e.jsx(i.Info,{className:"w-7 h-7"}):e.jsx(i.ExclamationCircle,{className:"w-7 h-7"})})}),e.jsxs("div",{className:"px-5 py-2 text-center",children:[e.jsx("h3",{id:"Dm-confirm-title",className:"text-lg font-semibold text-slate-900 tracking-tight",children:r}),e.jsx("p",{className:"mt-2 text-sm text-slate-600 leading-relaxed",children:l})]}),e.jsxs("div",{className:"px-5 pb-5 pt-4 flex flex-col-reverse sm:flex-row gap-2.5",children:[e.jsxs("button",{type:"button",onClick:t,disabled:m,className:`\r
                            flex-1 inline-flex items-center justify-center gap-2\r
                            px-4 py-2.5 min-h-[44px] rounded\r
                            bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm\r
                            transition-all duration-200 active:scale-[0.98]\r
                            disabled:opacity-50\r
                        `,children:[e.jsx(i.X,{className:"w-4 h-4"}),d]}),e.jsx("button",{type:"button",onClick:()=>{m||a()},disabled:m,className:`
                            flex-1 inline-flex items-center justify-center gap-2
                            px-4 py-2.5 min-h-[44px] rounded
                            text-white font-semibold text-sm shadow-md
                            transition-all duration-200 active:scale-[0.98]
                            disabled:opacity-50 ${c.btn}
                        `,children:m?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"}),"A processar…"]}):e.jsxs(e.Fragment,{children:[o==="danger"?e.jsx(i.Trash,{className:"w-4 h-4"}):o==="success"?e.jsx(i.Check,{className:"w-4 h-4"}):e.jsx(i.CheckCircle,{className:"w-4 h-4"}),n]})})]})]})]}):null};export{j as D,E as a,T as b,I as c,L as d,y as e,F as f,R as g,B as h,A as i,J as j,H as k,G as l,S as m,P as n,z as o,M as p,X as q,K as r,Q as s};
