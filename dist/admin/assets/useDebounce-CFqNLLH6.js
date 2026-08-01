import{l as a,j as s,r as i}from"./index-B6hllbOE.js";import{B as o}from"./Button-CNypDVTD.js";/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=a("ChevronLeft",[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=a("ChevronRight",[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]]);function x({page:e,totalPages:t,total:r,onPage:n,noun:c="طلب"}){return s.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-sm text-muted",children:[s.jsxs("span",{children:["صفحة ",e," من ",t," · ",r," ",c]}),s.jsxs("div",{className:"flex items-center gap-2",children:[s.jsxs(o,{variant:"secondary",size:"sm",disabled:e<=1,onClick:()=>n(e-1),children:[s.jsx(m,{className:"h-4 w-4"})," السابق"]}),s.jsxs(o,{variant:"secondary",size:"sm",disabled:e>=t,onClick:()=>n(e+1),children:["التالي ",s.jsx(d,{className:"h-4 w-4"})]})]})]})}function l(e,t=350){const[r,n]=i.useState(e);return i.useEffect(()=>{const c=setTimeout(()=>n(e),t);return()=>clearTimeout(c)},[e,t]),r}export{x as P,l as u};
